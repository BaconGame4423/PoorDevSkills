---
description: Run quality gates + 4-persona review + adversarial review with auto-fix loop
handoffs:
  - label: 修正実装
    agent: poor-dev.implement
    prompt: 品質レビューの指摘に基づいて修正を適用してください
    send: true
  - label: フェーズ完了レビュー
    agent: poor-dev.phasereview
    prompt: フェーズ完了レビューを実行してください
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Quality Review Procedure (5 stages)

### STAGE 0: Quality Gates

Run automated quality gates before persona review:

```bash
# Detect project language and run appropriate commands:
# TypeScript/JavaScript: tsc --noEmit && eslint . --max-warnings 0 && prettier --check && npm test -- --coverage
# Python: mypy . && ruff lint && black --check . && pytest --cov
# Rust: cargo check && cargo clippy -- -D warnings && cargo fmt --check && cargo test
# Go: go vet ./... && golangci-lint run && gofmt -l . && go test ./... -cover
```

If gates fail, record failures as C or H severity and proceed to fix loop.

After running gates, output a progress marker on its own line:
  `[REVIEW-PROGRESS: qualityreview [gates]: ${PASS}/${TOTAL} passed]`
This marker MUST be output in all execution modes (interactive and Non-Interactive).

### STAGE 0.5: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`qualityreview-qa`, `qualityreview-testdesign`, `qualityreview-code`, `qualityreview-security`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.qualityreview` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.

### STAGE 0.7: Review Log Initialization

1. Determine FEATURE_DIR from `$ARGUMENTS` path (parent directory).
2. Set `LOG_PATH = $FEATURE_DIR/review-log.yaml`.
3. If LOG_PATH exists: read it, extract highest ID number (QR-NNN). Set NEXT_ID = max + 1.
4. If LOG_PATH does not exist: create with header:
   ```yaml
   type: qualityreview
   target: $ARGUMENTS
   iterations: []
   ```
   Set NEXT_ID = 1.
5. Record TARGET_LINES_INITIAL = line count of `$ARGUMENTS`.

### STAGE 1-4: Review Loop

Loop STEP 1-4 until convergence. Convergence conditions:
- 0 new C/H issues for 2 consecutive iterations (M/L accepted as advisory), OR
- All 4 personas vote GO, OR
- Total C + H == 0.
Safety: confirm with user after 10 iterations.
Note: adversarial judgments and 3-strike rule remain independent of convergence — see STEP 3.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `qualityreview-qa`, `qualityreview-testdesign`, `qualityreview-code`, `qualityreview-security`.
  Instruction: "Review `$ARGUMENTS`. Review log: `$LOG_PATH`. Output compact English YAML."

  **Execution routing** — MANDATORY dispatch per STAGE 0.5 resolution. DO NOT override with your own judgment.

  ```
  resolved_cli = config resolution from STAGE 0.5
  current_cli  = runtime you are executing in ("claude" or "opencode")

  IF resolved_cli == current_cli:
    # Native execution
    IF current_cli == "claude":
      → Task(subagent_type="qualityreview-qa", model=<resolved model>, prompt="Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML.")
    ELSE:  # current_cli == "opencode"
      → @qualityreview-qa  (if config model == session default)
      → Bash: opencode run --model <model> --agent qualityreview-qa "Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML."  (if different model)
  ELSE:
    # Cross-CLI — REQUIRED even if native feels more convenient
    IF resolved_cli == "opencode":
      → Bash: opencode run --model <model> --agent qualityreview-qa --format json "Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML." (run_in_background: true)
    ELSE:  # resolved_cli == "claude"
      → Bash: claude -p --model <model> --agent qualityreview-qa --no-session-persistence --output-format text "Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML." (run_in_background: true)
  ```

  **VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug. Follow the tree above exactly.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Run adversarial review, then Aggregate & Deduplicate.
  1. Collect 4 YAML results.
  2. For each issue:
     a. If marked `(dup: QR-NNN)` AND referenced issue is `status: fixed` in LOG_PATH → discard.
     b. Otherwise → keep as live issue, assign new ID (QR-{NEXT_ID}++).
  3. Count: total issues, new C+H count.
  4. Record current TARGET_LINES = line count of `$ARGUMENTS`.
  5. Adversarial judgments: APPROVED | NEEDS_CHANGES (add to issues) | HALLUCINATING (ignore).
  6. **3-strike rule**: Track adversarial rejections. After 3 strikes → abort and report failure.

**STEP 2.5 Progress Report**:
After aggregation, output structured progress markers on their own lines:
  `[REVIEW-PROGRESS: qualityreview #${N}: ${ISSUE_COUNT} issues (C:${c} H:${h} M:${m} L:${l}) → ${ACTION}]`
  `[REVIEW-PROGRESS: qualityreview #${N}: adversarial ${JUDGMENT} (strike ${S}/3)]`
Where N = iteration number, ACTION = "fixing..." (issues > 0) or "GO" (issues == 0), JUDGMENT = APPROVED/NEEDS_CHANGES/HALLUCINATING, S = current strike count.
These markers MUST be output in all execution modes (interactive and Non-Interactive).

**STEP 3**: Convergence check.
  - 3 strikes → abort.
  - 0 new C/H for last 2 iterations AND adversarial APPROVED/HALLUCINATING → DONE (M/L as advisory).
  - All 4 personas GO AND adversarial APPROVED/HALLUCINATING → DONE.
  - C + H == 0 AND adversarial APPROVED/HALLUCINATING → DONE.
  - iteration >= 10 → CONFIRM with user.
  - ELSE → STEP 4.

**STEP 4**: Fix with constraints.
  1. Size guard: if TARGET_LINES > TARGET_LINES_INITIAL * 1.5 → prepend to fixer: "WARNING: Target file has grown >150%. Consolidation priority — reduce or replace content rather than adding."
  2. Spawn `review-fixer` with: "Fix `$ARGUMENTS`. Issues: [...]. Log: `$LOG_PATH`. Spec: `$FEATURE_DIR/spec.md`." (priority C→H→M→L) using resolved config for `review-fixer` (same routing logic as STEP 1).
  3. After fix: append iteration block to LOG_PATH with issues (id/sev/persona/desc/status/fix from fixer output). Adversarial judgments are NOT logged.
  4. Back to STEP 1.

Track issue count per iteration; verify decreasing trend.

### Iteration Output

```yaml
type: quality
target: $ARGUMENTS
n: 2
gates: {typecheck: pass, lint: pass, format: pass, test: pass}
i:
  H:
    - missing edge case test for null input (QA)
    - XSS vulnerability in render function (SEC)
  M:
    - function too complex, cyclomatic complexity 15 (CODE)
adversarial: NEEDS_CHANGES
strikes: 1
ps: {QA: CONDITIONAL, TESTDESIGN: GO, CODE: CONDITIONAL, SEC: NO-GO}
act: FIX
```

### Final Output (0 issues)

```yaml
type: quality
target: $ARGUMENTS
v: GO
n: 5
gates: {typecheck: pass, lint: pass, format: pass, test: pass}
adversarial: APPROVED
strikes: 1
log:
  - {n: 1, issues: 9, fixed: "gate failures, coverage"}
  - {n: 2, issues: 5, fixed: "XSS, null handling"}
  - {n: 3, issues: 3, fixed: "complexity, naming"}
  - {n: 4, issues: 1, fixed: "edge case test"}
  - {n: 5, issues: 0}
next: /poor-dev.phasereview
```

## Bugfix Postmortem (conditional)

Execute ONLY after loop completes with GO verdict. Skip if `FEATURE_DIR/bug-report.md` does not exist.

Determine FEATURE_DIR from `$ARGUMENTS` path.

### Postmortem Generation

1. Read `bug-report.md`, `investigation.md`, `fix-plan.md` from FEATURE_DIR.
2. Get diff: `git diff main...HEAD`
3. Generate `$FEATURE_DIR/postmortem.md`:

```markdown
# Postmortem: [BUG SHORT NAME]

**Date**: [DATE] | **Branch**: [BRANCH] | **Severity**: [C/H/M/L]
**Category**: [Logic Bug / Dependency / Environment / Regression / Concurrency / Data / Configuration]
**Resolution Time**: [intake → qualityreview completion]

## Summary
[1-2 line summary]

## Root Cause
[from investigation.md]

## 5 Whys
[from investigation.md]

## Fix Applied
- Changed files: [list]
- Change type: [logic fix / config change / dependency update / etc.]

## Impact
- Scope: [affected area]
- Duration: [when to when]

## Detection
- Found via: [user report / test failure / monitoring / etc.]

## Prevention
- [ ] [concrete prevention action 1]
- [ ] [concrete prevention action 2]

## Lessons Learned
- [lesson 1]
- [lesson 2]
```

### Update Bug Pattern Database

1. Read `bug-patterns.md`, determine next ID (BP-NNN).
2. Add row to Pattern Index + new pattern entry with: Category, Cause Pattern, Symptoms, Detection, Prevention, Past Occurrences.
3. Report postmortem path, root cause summary, prevention actions, new pattern ID.

### Dashboard Update

Update living documents in `docs/`:

1. `mkdir -p docs`
2. Scan all `specs/*/` directories. For each feature dir, check artifact existence:
   - discovery-memo.md, learnings.md, spec.md, plan.md, tasks.md, bug-report.md
   - concept.md, goals.md, milestones.md, roadmap.md (roadmap flow)
3. Determine each feature's phase from latest artifact:
   Discovery → Specification → Planning → Tasks → Implementation → Review → Complete
4. Write `docs/progress.md`:
   - Header with timestamp and triggering command name
   - Per-feature section: branch, phase, artifact checklist (✅/⏳/—), last activity
5. Write `docs/roadmap.md`:
   - Header with timestamp
   - Active features table (feature, phase, status, branch)
   - Completed features table
   - Upcoming section (from concept.md/goals.md/milestones.md if present)

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

If any gate returns `skip` (tool not available), record as:
  `gates: {lint: skip-unavailable, ...}`
and prepend to STEP 1 persona instructions:
  `"WARNING: Quality gate '${GATE}' was skipped (tool unavailable). Increase scrutiny for ${GATE_AREA}."`

Gate-to-area mapping: lint→code style/patterns, format→formatting, test→correctness/edge cases, typecheck→type safety.

After running gates, output a progress marker on its own line:
  `[REVIEW-PROGRESS: qualityreview [gates]: ${PASS}/${TOTAL} passed]`
This marker MUST be output in all execution modes (interactive and Non-Interactive).

### STAGE 0.5: Config Resolution & Review Depth

```
REVIEW_TYPE = qualityreview
PERSONAS = [qualityreview-qa, qualityreview-testdesign, qualityreview-code, qualityreview-security]
ID_PREFIX = QR
light_personas = [qualityreview-qa, qualityreview-security]
```

Follow `templates/review-loop.md` STEP 0 (Config Resolution) and STEP 0.3 (Review Depth) with above parameters.

### STAGE 0.7: Review Log Initialization

Follow `templates/review-loop.md` STEP 0.5 (Review Log Init) and Review Log Windowing.

### STAGE 1-4: Review Loop

Follow `templates/review-loop.md` Review Loop with the following **qualityreview-specific extensions**:

Note: adversarial judgments and 3-strike rule remain independent of convergence — see STEP 3.
Note: Quality gates (STAGE 0) always run regardless of review depth.

**STEP 2 extension** (Bash Dispatch: Opus orchestrator handles adversarial inline): After standard aggregation, also run:
  - Adversarial judgments: APPROVED | NEEDS_CHANGES (add to issues) | HALLUCINATING (ignore).
  - **3-strike rule**: Track adversarial rejections. After 3 strikes → abort and report failure.

**STEP 2.5 extension**: Additional progress marker:
  `[REVIEW-PROGRESS: qualityreview #${N}: adversarial ${JUDGMENT} (strike ${S}/3)]`

**STEP 3 extension**: Additional convergence conditions:
  - 3 strikes → abort.
  - All standard convergence conditions also require adversarial APPROVED/HALLUCINATING.

**STEP 4**: Standard fix with constraints from template. Adversarial judgments are NOT logged.

**VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug.

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

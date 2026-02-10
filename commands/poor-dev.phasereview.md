---
description: Run 4-persona phase completion review with auto-fix loop until zero issues
handoffs:
  - label: 次のフェーズ
    agent: poor-dev.implement
    prompt: フェーズ完了レビューをクリアしました。次のフェーズに進んでください
    send: true
  - label: 修正実装
    agent: poor-dev.implement
    prompt: レビュー指摘に基づいて修正を適用してください
---

## User Input

```text
$ARGUMENTS
```

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.phasereview` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`.
  Instruction: "Review phase `$ARGUMENTS`. Check all phase artifacts including code, tests, docs. Output compact English YAML."

  **Execution routing** — MANDATORY dispatch per STEP 0 resolution. DO NOT override with your own judgment.

  ```
  resolved_cli = config resolution from STEP 0
  current_cli  = runtime you are executing in ("claude" or "opencode")

  IF resolved_cli == current_cli:
    # Native execution
    IF current_cli == "claude":
      → Task(subagent_type="phasereview-qa", model=<resolved model>, prompt="Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML.")
    ELSE:  # current_cli == "opencode"
      → @phasereview-qa  (if config model == session default)
      → Bash: opencode run --model <model> --agent phasereview-qa "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML."  (if different model)
  ELSE:
    # Cross-CLI — REQUIRED even if native feels more convenient
    IF resolved_cli == "opencode":
      → Bash: opencode run --model <model> --agent phasereview-qa --format json "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML." (run_in_background: true)
    ELSE:  # resolved_cli == "claude"
      → Bash: claude -p --model <model> --agent phasereview-qa --no-session-persistence --output-format text "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML." (run_in_background: true)
  ```

  **VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug. Follow the tree above exactly.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).
  Additionally verify Definition of Done: all tasks completed, quality gates passed, all tests passing, code review done, adversarial review passed, docs updated, no regressions, security reviewed.

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Spawn `review-fixer` (priority C→H→M→L) using resolved config for `review-fixer` (same routing logic as STEP 1). After fix → back to STEP 1.

Track issue count per iteration; verify decreasing trend.

## Output Format

```yaml
# Iteration example:
type: phase
target: $ARGUMENTS
n: 3
i: {H: ["README not updated with new API endpoints (DOCS)"], M: ["accessibility not tested (UX)", "CHANGELOG missing entry (DOCS)"]}
ps: {QA: GO, REGRESSION: GO, DOCS: CONDITIONAL, UX: CONDITIONAL}
act: FIX

# Final (0 issues):
type: phase
target: $ARGUMENTS
v: GO
n: 4
dod: {tasks: pass, gates: pass, tests: pass, review: pass, adversarial: pass, docs: pass, regression: pass, security: pass}
log:
  - {n: 1, issues: 6, fixed: "DoD gaps, test coverage"}
  - {n: 4, issues: 0}
next: /poor-dev.implement (next phase)
```

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

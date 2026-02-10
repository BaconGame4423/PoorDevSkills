---
description: Run 4-persona plan review with auto-fix loop until zero issues
handoffs:
  - label: タスク分解
    agent: poor-dev.tasks
    prompt: プランレビューをクリアしました。タスクを分解してください
    send: true
  - label: 計画修正
    agent: poor-dev.plan
    prompt: レビュー指摘に基づいて計画を修正してください
---

## User Input

```text
$ARGUMENTS
```

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`planreview-pm`, `planreview-risk`, `planreview-value`, `planreview-critical`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.planreview` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `planreview-pm`, `planreview-risk`, `planreview-value`, `planreview-critical`.
  Instruction: "Review `$ARGUMENTS`. Output compact English YAML."

  **Execution routing** — MANDATORY dispatch per STEP 0 resolution. DO NOT override with your own judgment.

  ```
  resolved_cli = config resolution from STEP 0
  current_cli  = runtime you are executing in ("claude" or "opencode")

  IF resolved_cli == current_cli:
    # Native execution
    IF current_cli == "claude":
      → Task(subagent_type="planreview-pm", model=<resolved model>, prompt="Review $ARGUMENTS. Output compact English YAML.")
    ELSE:  # current_cli == "opencode"
      → @planreview-pm  (if config model == session default)
      → Bash: opencode run --model <model> --agent planreview-pm "Review $ARGUMENTS. Output compact English YAML."  (if different model)
  ELSE:
    # Cross-CLI — REQUIRED even if native feels more convenient
    IF resolved_cli == "opencode":
      → Bash: opencode run --model <model> --agent planreview-pm --format json "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)
    ELSE:  # resolved_cli == "claude"
      → Bash: claude -p --model <model> --agent planreview-pm --no-session-persistence --output-format text "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)
  ```

  **VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug. Follow the tree above exactly.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Spawn `review-fixer` (priority C→H→M→L) using resolved config for `review-fixer` (same routing logic as STEP 1). After fix → back to STEP 1.

Track issue count per iteration; verify decreasing trend.

## Output Format

```yaml
# Iteration example:
type: plan
target: $ARGUMENTS
n: 3
i: {M: ["competitive analysis insufficient (CRIT)"], L: ["minor naming inconsistency (PM)"]}
ps: {PM: GO, RISK: GO, VAL: GO, CRIT: CONDITIONAL}
act: FIX

# Final (0 issues):
type: plan
target: $ARGUMENTS
v: GO
n: 7
log:
  - {n: 1, issues: 6, fixed: "auth strategy, metrics"}
  - {n: 7, issues: 0}
next: /poor-dev.tasks
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

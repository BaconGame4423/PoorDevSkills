---
description: Run 4-persona tasks review with auto-fix loop until zero issues
handoffs:
  - label: 実装開始
    agent: poor-dev.implement
    prompt: タスクレビューをクリアしました。実装を開始してください
    send: true
  - label: タスク再調整
    agent: poor-dev.tasks
    prompt: レビュー指摘に基づいてタスクを修正してください
---

## User Input

```text
$ARGUMENTS
```

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`tasksreview-techlead`, `tasksreview-senior`, `tasksreview-devops`, `tasksreview-junior`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.tasksreview` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `tasksreview-techlead`, `tasksreview-senior`, `tasksreview-devops`, `tasksreview-junior`.
  Instruction: "Review `$ARGUMENTS`. Output compact English YAML."

  **Execution routing** — follow `templates/review-routing-protocol.md`. Replace `<AGENT>` with each persona name and `<INSTRUCTION>` with the review instruction above.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).
  Additionally check: no circular dependencies, critical path identified, parallelization opportunities noted, user story coverage complete.

**STEP 2.5 Progress Report**:
After aggregation, output a structured progress marker on its own line:
  `[REVIEW-PROGRESS: tasksreview #${N}: ${ISSUE_COUNT} issues (C:${c} H:${h} M:${m} L:${l}) → ${ACTION}]`
Where N = iteration number, ACTION = "fixing..." (issues > 0) or "GO" (issues == 0).
This marker MUST be output in all execution modes (interactive and Non-Interactive).

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Spawn `review-fixer` sub-agent with aggregated issues (priority C→H→M→L) using resolved config for `review-fixer` (same routing logic). After fix → back to STEP 1.

Track issue count per iteration; verify decreasing trend.

## Output Format

```yaml
# Iteration example:
type: tasks
target: $ARGUMENTS
n: 2
i: {H: ["circular dependency between task 3 and 5 (TECHLEAD)"], M: ["missing monitoring task (DEVOPS)"]}
ps: {TECHLEAD: CONDITIONAL, SENIOR: GO, DEVOPS: CONDITIONAL, JUNIOR: GO}
act: FIX

# Final (0 issues):
type: tasks
target: $ARGUMENTS
v: GO
n: 5
log:
  - {n: 1, issues: 8, fixed: "dependency graph, task sizing"}
  - {n: 5, issues: 0}
next: /poor-dev.implement
```

### Dashboard Update

Run: `node scripts/update-dashboard.mjs --command tasksreview`

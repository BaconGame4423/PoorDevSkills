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

## Review Loop Procedure

Repeat the following loop until issue count reaches 0.

### STEP 1: Persona Reviews (parallel)

Run 4 persona reviews as **parallel sub-agents** with fresh context each.

Persona sub-agents (defined in `.opencode/agents/`):
- `tasksreview-techlead`
- `tasksreview-senior`
- `tasksreview-devops`
- `tasksreview-junior`

Each sub-agent instruction: "Review `$ARGUMENTS`. Output compact English YAML."

**IMPORTANT**: Always spawn NEW sub-agents. Never reuse previous ones (prevents context contamination).

**Claude Code**: Use Task tool with subagent_type "general-purpose" for each persona. Include the persona agent file content as instructions.
**OpenCode**: Use `@tasksreview-techlead`, `@tasksreview-senior`, `@tasksreview-devops`, `@tasksreview-junior`.

### STEP 2: Aggregate Results

Collect 4 sub-agent YAML results. Count issues by severity (C/H/M/L).

Additionally check:
- Dependency graph: no circular dependencies?
- Critical path identified?
- Parallelization opportunities noted?
- User story coverage complete?

### STEP 3: Branch

- **Issues remain (any severity: C/H/M/L)** → STEP 4 (fix and re-review)
- **Zero issues** → Loop complete. Output final result + handoff.

Continue loop until **zero issues**, not just GO verdict.

### STEP 4: Auto-Fix (sub-agent)

Spawn a fix sub-agent (`review-fixer`) with the aggregated issue list:

> Fix `$ARGUMENTS` based on these issues.
> Priority order: C → H → M → L
> Issues: [paste aggregated issues from STEP 2]

After fix completes → **back to STEP 1** (new review sub-agents, fresh context).

### Loop Behavior

- **Exit condition**: 0 issues from all personas
- **No hard limit**: continues as long as issues remain (typical: 5-8 iterations)
- **Safety valve**: after 10 iterations, ask user for confirmation (not auto-abort)
- **Progress tracking**: record issue count per iteration, verify decreasing trend

## Iteration Output

```yaml
type: tasks
target: $ARGUMENTS
n: 2
i:
  H:
    - circular dependency between task 3 and 5 (TECHLEAD)
  M:
    - missing monitoring task (DEVOPS)
ps:
  TECHLEAD: CONDITIONAL
  SENIOR: GO
  DEVOPS: CONDITIONAL
  JUNIOR: GO
act: FIX
```

## Final Output (loop complete, 0 issues)

```yaml
type: tasks
target: $ARGUMENTS
v: GO
n: 5
log:
  - {n: 1, issues: 8, fixed: "dependency graph, task sizing"}
  - {n: 2, issues: 4, fixed: "monitoring tasks, CI/CD"}
  - {n: 3, issues: 2, fixed: "clarity, context"}
  - {n: 4, issues: 1, fixed: "parallelization"}
  - {n: 5, issues: 0}
next: /poor-dev.implement
```

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

## Review Loop Procedure

Repeat the following loop until issue count reaches 0.

### STEP 1: Persona Reviews (parallel)

Run 4 persona reviews as **parallel sub-agents** with fresh context each.

Persona sub-agents (defined in `.opencode/agents/`):
- `planreview-pm`
- `planreview-risk`
- `planreview-value`
- `planreview-critical`

Each sub-agent instruction: "Review `$ARGUMENTS`. Output compact English YAML."

**IMPORTANT**: Always spawn NEW sub-agents. Never reuse previous ones (prevents context contamination).

**Claude Code**: Use Task tool with subagent_type "general-purpose" for each persona. Include the persona agent file content as instructions.
**OpenCode**: Use `@planreview-pm`, `@planreview-risk`, `@planreview-value`, `@planreview-critical`.

### STEP 2: Aggregate Results

Collect 4 sub-agent YAML results. Count issues by severity (C/H/M/L).

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
type: plan
target: $ARGUMENTS
n: 3
i:
  M:
    - competitive analysis insufficient (CRIT)
  L:
    - minor naming inconsistency (PM)
ps:
  PM: GO
  RISK: GO
  VAL: GO
  CRIT: CONDITIONAL
act: FIX
```

## Final Output (loop complete, 0 issues)

```yaml
type: plan
target: $ARGUMENTS
v: GO
n: 7
log:
  - {n: 1, issues: 6, fixed: "auth strategy, metrics"}
  - {n: 2, issues: 3, fixed: "risk mitigation"}
  - {n: 3, issues: 2, fixed: "competitive analysis"}
  - {n: 4, issues: 1, fixed: "naming"}
  - {n: 5, issues: 1, fixed: "edge case"}
  - {n: 6, issues: 1, fixed: "doc clarity"}
  - {n: 7, issues: 0}
next: /poor-dev.tasks
```

---
description: Run 4-persona architecture review with auto-fix loop until zero issues
handoffs:
  - label: 実装開始
    agent: poor-dev.implement
    prompt: アーキテクチャレビューをクリアしました。実装を開始してください
    send: true
  - label: 設計修正
    agent: poor-dev.plan
    prompt: レビュー指摘に基づいてアーキテクチャを修正してください
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
- `architecturereview-architect`
- `architecturereview-security`
- `architecturereview-performance`
- `architecturereview-sre`

Each sub-agent instruction: "Review `$ARGUMENTS`. Output compact English YAML."

**IMPORTANT**: Always spawn NEW sub-agents. Never reuse previous ones (prevents context contamination).

**Claude Code**: Use Task tool with subagent_type "general-purpose" for each persona. Include the persona agent file content as instructions.
**OpenCode**: Use `@architecturereview-architect`, `@architecturereview-security`, `@architecturereview-performance`, `@architecturereview-sre`.

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
type: architecture
target: $ARGUMENTS
n: 2
i:
  C:
    - no input validation on user endpoints (SEC)
  H:
    - missing caching strategy (PERF)
ps:
  ARCH: GO
  SEC: NO-GO
  PERF: CONDITIONAL
  SRE: GO
act: FIX
```

## Final Output (loop complete, 0 issues)

```yaml
type: architecture
target: $ARGUMENTS
v: GO
n: 6
log:
  - {n: 1, issues: 7, fixed: "SOLID violations, auth gaps"}
  - {n: 2, issues: 4, fixed: "input validation, caching"}
  - {n: 3, issues: 2, fixed: "monitoring, failover"}
  - {n: 4, issues: 1, fixed: "logging format"}
  - {n: 5, issues: 1, fixed: "backup strategy"}
  - {n: 6, issues: 0}
next: /poor-dev.implement
```

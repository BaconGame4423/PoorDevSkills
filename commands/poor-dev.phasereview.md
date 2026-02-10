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

## Review Loop Procedure

Repeat the following loop until issue count reaches 0.

### STEP 1: Persona Reviews (parallel)

Run 4 persona reviews as **parallel sub-agents** with fresh context each.

Persona sub-agents (defined in `.opencode/agents/`):
- `phasereview-qa`
- `phasereview-regression`
- `phasereview-docs`
- `phasereview-ux`

Each sub-agent instruction: "Review phase `$ARGUMENTS`. Check all phase artifacts including code, tests, docs. Output compact English YAML."

**IMPORTANT**: Always spawn NEW sub-agents. Never reuse previous ones (prevents context contamination).

**Claude Code**: Use Task tool with subagent_type "general-purpose" for each persona. Include the persona agent file content as instructions.
**OpenCode**: Use `@phasereview-qa`, `@phasereview-regression`, `@phasereview-docs`, `@phasereview-ux`.

### STEP 2: Aggregate Results

Collect 4 sub-agent YAML results. Count issues by severity (C/H/M/L).

Additionally verify Definition of Done:
- All tasks completed?
- All quality gates passed?
- All tests passing (unit, integration, E2E)?
- Code review completed?
- Adversarial review passed?
- Documentation updated?
- No regressions?
- Security review completed?

### STEP 3: Branch

- **Issues remain (any severity: C/H/M/L)** → STEP 4 (fix and re-review)
- **Zero issues** → Loop complete. Output final result + handoff.

Continue loop until **zero issues**, not just GO verdict.

### STEP 4: Auto-Fix (sub-agent)

Spawn a fix sub-agent (`review-fixer`) with the aggregated issue list:

> Fix phase `$ARGUMENTS` artifacts based on these issues.
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
type: phase
target: $ARGUMENTS
n: 3
i:
  H:
    - README not updated with new API endpoints (DOCS)
  M:
    - accessibility not tested (UX)
    - CHANGELOG missing entry (DOCS)
ps:
  QA: GO
  REGRESSION: GO
  DOCS: CONDITIONAL
  UX: CONDITIONAL
act: FIX
```

## Final Output (loop complete, 0 issues)

```yaml
type: phase
target: $ARGUMENTS
v: GO
n: 4
dod:
  tasks: pass
  gates: pass
  tests: pass
  review: pass
  adversarial: pass
  docs: pass
  regression: pass
  security: pass
log:
  - {n: 1, issues: 6, fixed: "DoD gaps, test coverage"}
  - {n: 2, issues: 3, fixed: "README, CHANGELOG"}
  - {n: 3, issues: 1, fixed: "accessibility"}
  - {n: 4, issues: 0}
next: /poor-dev.implement (next phase)
```

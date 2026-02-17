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

## Review Configuration

```
REVIEW_TYPE = planreview
PERSONAS = [planreview-pm, planreview-risk, planreview-value, planreview-critical]
ID_PREFIX = PR
light_personas = [planreview-pm, planreview-critical]
```

Follow the **Review Loop Common Template** (`templates/review-loop.md`) with the above parameters.
All steps (STEP 0 Config Resolution, STEP 0.3 Review Depth, STEP 0.5 Review Log Init,
Review Log Windowing, STEP 1-4 Review Loop with early termination) are defined there.

**VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug.

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

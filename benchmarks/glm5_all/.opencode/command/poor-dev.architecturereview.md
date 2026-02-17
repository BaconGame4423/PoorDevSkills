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

## Review Configuration

```
REVIEW_TYPE = architecturereview
PERSONAS = [architecturereview-architect, architecturereview-security, architecturereview-performance, architecturereview-sre]
ID_PREFIX = AR
light_personas = [architecturereview-architect, architecturereview-security]
```

Follow the **Review Loop Common Template** (`templates/review-loop.md`) with the above parameters.
All steps (STEP 0 Config Resolution, STEP 0.3 Review Depth, STEP 0.5 Review Log Init,
Review Log Windowing, STEP 1-4 Review Loop with early termination) are defined there.

**VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug.

Track issue count per iteration; verify decreasing trend.

## Output Format

```yaml
# Iteration example:
type: architecture
target: $ARGUMENTS
n: 2
i: {C: ["no input validation on user endpoints (SEC)"], H: ["missing caching strategy (PERF)"]}
ps: {ARCH: GO, SEC: NO-GO, PERF: CONDITIONAL, SRE: GO}
act: FIX

# Final (0 issues):
type: architecture
target: $ARGUMENTS
v: GO
n: 6
log:
  - {n: 1, issues: 7, fixed: "SOLID violations, auth gaps"}
  - {n: 6, issues: 0}
next: /poor-dev.implement
```

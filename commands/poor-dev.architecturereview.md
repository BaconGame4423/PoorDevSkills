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

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.architecturereview` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`.
  Instruction: "Review `$ARGUMENTS`. Output compact English YAML."

  **Execution routing** — MANDATORY dispatch per STEP 0 resolution. DO NOT override with your own judgment.

  ```
  resolved_cli = config resolution from STEP 0
  current_cli  = runtime you are executing in ("claude" or "opencode")

  IF resolved_cli == current_cli:
    # Native execution
    IF current_cli == "claude":
      → Task(subagent_type="architecturereview-architect", model=<resolved model>, prompt="Review $ARGUMENTS. Output compact English YAML.")
    ELSE:  # current_cli == "opencode"
      → @architecturereview-architect  (if config model == session default)
      → Bash: opencode run --model <model> --agent architecturereview-architect "Review $ARGUMENTS. Output compact English YAML."  (if different model)
  ELSE:
    # Cross-CLI — REQUIRED even if native feels more convenient
    IF resolved_cli == "opencode":
      → Bash: opencode run --model <model> --agent architecturereview-architect --format json "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)
    ELSE:  # resolved_cli == "claude"
      → Bash: claude -p --model <model> --agent architecturereview-architect --no-session-persistence --output-format text "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)
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

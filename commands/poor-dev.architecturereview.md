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

## STEP 0.5: Review Log Initialization

1. Determine FEATURE_DIR from `$ARGUMENTS` path (parent directory).
2. Set `LOG_PATH = $FEATURE_DIR/review-log.yaml`.
3. If LOG_PATH exists: read it, extract highest ID number (AR-NNN). Set NEXT_ID = max + 1.
4. If LOG_PATH does not exist: create with header:
   ```yaml
   type: architecturereview
   target: $ARGUMENTS
   iterations: []
   ```
   Set NEXT_ID = 1.
5. Record TARGET_LINES_INITIAL = line count of `$ARGUMENTS`.

## Review Loop

Loop STEP 1-4 until convergence. Convergence conditions:
- 0 new C/H issues for 2 consecutive iterations (M/L accepted as advisory), OR
- All 4 personas vote GO, OR
- Total C + H == 0.
Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`.
  Instruction: "Review `$ARGUMENTS`. Review log: `$LOG_PATH`. Output compact English YAML."

  **Execution routing** — MANDATORY dispatch per STEP 0 resolution. DO NOT override with your own judgment.

  ```
  resolved_cli = config resolution from STEP 0
  current_cli  = runtime you are executing in ("claude" or "opencode")

  IF resolved_cli == current_cli:
    # Native execution
    IF current_cli == "claude":
      → Task(subagent_type="architecturereview-architect", model=<resolved model>, prompt="Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML.")
    ELSE:  # current_cli == "opencode"
      → @architecturereview-architect  (if config model == session default)
      → Bash: opencode run --model <model> --agent architecturereview-architect "Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML."  (if different model)
  ELSE:
    # Cross-CLI — REQUIRED even if native feels more convenient
    IF resolved_cli == "opencode":
      → Bash: opencode run --model <model> --agent architecturereview-architect --format json "Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML." (run_in_background: true)
    ELSE:  # resolved_cli == "claude"
      → Bash: claude -p --model <model> --agent architecturereview-architect --no-session-persistence --output-format text "Review $ARGUMENTS. Review log: $LOG_PATH. Output compact English YAML." (run_in_background: true)
  ```

  **VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug. Follow the tree above exactly.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Aggregate & Deduplicate.
  1. Collect 4 YAML results.
  2. For each issue:
     a. If marked `(dup: AR-NNN)` AND referenced issue is `status: fixed` in LOG_PATH → discard.
     b. Otherwise → keep as live issue, assign new ID (AR-{NEXT_ID}++).
  3. Count: total issues, new C+H count.
  4. Record current TARGET_LINES = line count of `$ARGUMENTS`.

**STEP 2.5 Progress Report**:
After aggregation, output a structured progress marker on its own line:
  `[REVIEW-PROGRESS: architecturereview #${N}: ${ISSUE_COUNT} issues (C:${c} H:${h} M:${m} L:${l}) → ${ACTION}]`
Where N = iteration number, ACTION = "fixing..." (issues > 0) or "GO" (issues == 0).
This marker MUST be output in all execution modes (interactive and Non-Interactive).

**STEP 3**: Convergence check.
  - 0 new C/H for last 2 iterations → DONE (M/L as advisory).
  - All 4 personas GO → DONE.
  - C + H == 0 → DONE.
  - iteration >= 10 → CONFIRM with user.
  - ELSE → STEP 4.

**STEP 4**: Fix with constraints.
  1. Size guard: if TARGET_LINES > TARGET_LINES_INITIAL * 1.5 → prepend to fixer: "WARNING: Target file has grown >150%. Consolidation priority — reduce or replace content rather than adding."
  2. Spawn `review-fixer` with: "Fix `$ARGUMENTS`. Issues: [...]. Log: `$LOG_PATH`. Spec: `$FEATURE_DIR/spec.md`." (priority C→H→M→L) using resolved config for `review-fixer` (same routing logic as STEP 1).
  3. After fix: append iteration block to LOG_PATH with issues (id/sev/persona/desc/status/fix from fixer output).
  4. Back to STEP 1.

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

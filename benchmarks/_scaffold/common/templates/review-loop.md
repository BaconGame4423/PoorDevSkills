# Review Loop Common Template

This template defines the shared review loop logic used by all 5 review orchestrators.
Each orchestrator references this template and provides its own: REVIEW_TYPE, PERSONAS, ID_PREFIX, light_personas.

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona in PERSONAS and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.${REVIEW_TYPE}` → `step_tiers.${REVIEW_TYPE}` → `tiers[tier]` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**.

## STEP 0.3: Review Depth Determination (Risk-Based)

Read `review_depth` from config. If `"auto"`:
```
score = 0
lines_changed = $(git diff --stat HEAD~1 2>/dev/null | tail -1 | grep -oP '\d+ insertion' | grep -oP '\d+') + deletions
files_changed = $(git diff --name-only HEAD~1 2>/dev/null | wc -l)
score += lines_changed > 500 ? 3 : lines_changed > 100 ? 2 : 1
score += files_changed > 10 ? 3 : files_changed > 3 ? 2 : 1
score += touches_auth_or_crypto ? 3 : 0
score += new_dependencies > 0 ? 2 : 0

if score >= 8:  depth = "deep"      # 4 personas, max 10 iterations
if score >= 4:  depth = "standard"  # 4 personas, max 5 iterations
if score < 4:   depth = "light"     # 2 personas (from light_personas), max 3 iterations
```

If review_depth is explicitly set ("deep"/"standard"/"light"), use that directly.

For `light` mode: use only the personas listed in `light_personas` (defined per orchestrator).

## STEP 0.5: Review Log Initialization

1. Determine FEATURE_DIR from `$ARGUMENTS` path (parent directory).
2. Set `LOG_PATH = $FEATURE_DIR/review-log.yaml`.
3. If LOG_PATH exists: read it, extract highest ID number (${ID_PREFIX}-NNN). Set NEXT_ID = max + 1.
4. If LOG_PATH does not exist: create with header:
   ```yaml
   type: ${REVIEW_TYPE}
   target: $ARGUMENTS
   iterations: []
   ```
   Set NEXT_ID = 1.
5. Record TARGET_LINES_INITIAL = line count of `$ARGUMENTS`.

## STEP 0.7: Cross-Step Context (if previous review exists)
Read review-log.yaml. If a previous review step has entries:
- Summarize changes made by previous fixer in ≤5 bullet points.
- Include in reviewer prompt: "Previous review modified: [summary]. Do NOT re-introduce fixed issues."

## Review Log Windowing (1.3)

When preparing review-log for persona dispatch:
- Extract all issues from LOG_PATH
- **Recent window**: Include full details for last 2 iterations
- **Omitted fixed**: For older iterations, include only summary line per fixed issue:
  ```yaml
  omitted_fixed:
    - {id: ${ID_PREFIX}-001, sev: H, iter: 1}
    - {id: ${ID_PREFIX}-003, sev: C, iter: 2}
  ```
- **Pending issues**: Always include full details regardless of age
- Header: `# N older fixed issues omitted (reflected in target file)`

This reduces tokens while preserving regression detection capability.

## Review Loop

Loop STEP 1-4 until convergence. Convergence conditions:
- 0 new C/H issues for 2 consecutive iterations (M/L accepted as advisory), OR
- Total C + H == 0.
Safety: confirm with user after MAX_ITERATIONS (depth-dependent).

**STEP 1**: Spawn parallel sub-agents (count depends on depth).
  - `deep`/`standard`: All personas in PERSONAS
  - `light`: Only light_personas
  Instruction: "Review `$ARGUMENTS`. Review log: `${WINDOWED_LOG}`. Output compact English YAML."

  **Early termination** (2.2): During parallel persona dispatch:
  - 2/4 returned NO-GO → cancel remaining, proceed to FIX

  **Execution routing** — MANDATORY dispatch per STEP 0 resolution:
  ```
  resolved_cli = config resolution from STEP 0
  current_cli  = runtime you are executing in ("claude" or "opencode")

  IF resolved_cli == current_cli:
    IF current_cli == "claude":
      → Task(subagent_type="${persona}", model=<resolved model>, prompt=...)
    ELSE:
      → @${persona} or Bash: opencode run --model <model> --agent ${persona} "..."
  ELSE:
    IF resolved_cli == "opencode":
      → Bash: opencode run --model <model> --agent ${persona} --format json "..." (run_in_background: true)
    ELSE:
      → Bash: claude -p --model <model> --agent ${persona} --no-session-persistence --output-format text "..." (run_in_background: true)
  ```

  Run all personas in parallel. Wait for completion (or early termination).

**STEP 2**: Aggregate & Deduplicate.
  1. Collect YAML results from all completed personas.
  2. For each issue:
     a. If marked `(dup: ${ID_PREFIX}-NNN)` AND referenced issue is `status: fixed` in LOG_PATH → discard.
     b. Otherwise → keep as live issue, assign new ID (${ID_PREFIX}-{NEXT_ID}++).
  3. Count: total issues, new C+H count.
  4. Record current TARGET_LINES = line count of `$ARGUMENTS`.

**STEP 2.5 Progress Report**:
  `[REVIEW-PROGRESS: ${REVIEW_TYPE} #${N}: ${ISSUE_COUNT} issues (C:${c} H:${h} M:${m} L:${l}) → ${ACTION}]`

**STEP 3**: Convergence check.
  - 0 new C/H for last 2 iterations → DONE.
  - C + H == 0 → DONE.
  - iteration >= MAX_ITERATIONS → CONFIRM with user.
  - ELSE → STEP 4.

**STEP 4**: Fix with constraints.
  1. Size guard: if TARGET_LINES > TARGET_LINES_INITIAL * 1.5 → prepend to fixer: "WARNING: Target file has grown >150%. Consolidation priority."
  2. Spawn `review-fixer` with issues (priority C→H→M→L) using resolved config.
  3. After fix: append iteration block to LOG_PATH.
  4. Back to STEP 1.

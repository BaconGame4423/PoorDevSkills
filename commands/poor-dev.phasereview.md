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

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.phasereview` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.

## STEP 0.5: Review Log Initialization

1. Determine FEATURE_DIR from `$ARGUMENTS` path (parent directory).
2. Set `LOG_PATH = $FEATURE_DIR/review-log.yaml`.
3. If LOG_PATH exists: read it, extract highest ID number (PH-NNN). Set NEXT_ID = max + 1.
4. If LOG_PATH does not exist: create with header:
   ```yaml
   type: phasereview
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
  Personas: `phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`.
  Instruction: "Review phase `$ARGUMENTS`. Review log: `$LOG_PATH`. Check all phase artifacts including code, tests, docs. Output compact English YAML."

  **Execution routing** — MANDATORY dispatch per STEP 0 resolution. DO NOT override with your own judgment.

  ```
  resolved_cli = config resolution from STEP 0
  current_cli  = runtime you are executing in ("claude" or "opencode")

  IF resolved_cli == current_cli:
    # Native execution
    IF current_cli == "claude":
      → Task(subagent_type="phasereview-qa", model=<resolved model>, prompt="Review phase $ARGUMENTS. Review log: $LOG_PATH. Check all phase artifacts including code, tests, docs. Output compact English YAML.")
    ELSE:  # current_cli == "opencode"
      → @phasereview-qa  (if config model == session default)
      → Bash: opencode run --model <model> --agent phasereview-qa "Review phase $ARGUMENTS. Review log: $LOG_PATH. Check all phase artifacts including code, tests, docs. Output compact English YAML."  (if different model)
  ELSE:
    # Cross-CLI — REQUIRED even if native feels more convenient
    IF resolved_cli == "opencode":
      → Bash: opencode run --model <model> --agent phasereview-qa --format json "Review phase $ARGUMENTS. Review log: $LOG_PATH. Check all phase artifacts including code, tests, docs. Output compact English YAML." (run_in_background: true)
    ELSE:  # resolved_cli == "claude"
      → Bash: claude -p --model <model> --agent phasereview-qa --no-session-persistence --output-format text "Review phase $ARGUMENTS. Review log: $LOG_PATH. Check all phase artifacts including code, tests, docs. Output compact English YAML." (run_in_background: true)
  ```

  **VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug. Follow the tree above exactly.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Aggregate & Deduplicate.
  1. Collect 4 YAML results.
  2. For each issue:
     a. If marked `(dup: PH-NNN)` AND referenced issue is `status: fixed` in LOG_PATH → discard.
     b. Otherwise → keep as live issue, assign new ID (PH-{NEXT_ID}++).
  3. Count: total issues, new C+H count.
  4. Record current TARGET_LINES = line count of `$ARGUMENTS`.
  5. Additionally verify Definition of Done: all tasks completed, quality gates passed, all tests passing, code review done, adversarial review passed, docs updated, no regressions, security reviewed.

**STEP 2.5 Progress Report**:
After aggregation, output structured progress markers on their own lines:
  `[REVIEW-PROGRESS: phasereview #${N}: ${ISSUE_COUNT} issues (C:${c} H:${h} M:${m} L:${l}) → ${ACTION}]`
  `[REVIEW-PROGRESS: phasereview #${N}: DoD ${DONE}/${TOTAL}]`
Where N = iteration number, ACTION = "fixing..." (issues > 0) or "GO" (issues == 0), DONE = passed DoD items, TOTAL = total DoD items.
These markers MUST be output in all execution modes (interactive and Non-Interactive).

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
type: phase
target: $ARGUMENTS
n: 3
i: {H: ["README not updated with new API endpoints (DOCS)"], M: ["accessibility not tested (UX)", "CHANGELOG missing entry (DOCS)"]}
ps: {QA: GO, REGRESSION: GO, DOCS: CONDITIONAL, UX: CONDITIONAL}
act: FIX

# Final (0 issues):
type: phase
target: $ARGUMENTS
v: GO
n: 4
dod: {tasks: pass, gates: pass, tests: pass, review: pass, adversarial: pass, docs: pass, regression: pass, security: pass}
log:
  - {n: 1, issues: 6, fixed: "DoD gaps, test coverage"}
  - {n: 4, issues: 0}
next: /poor-dev.implement (next phase)
```

### Branch Merge & Cleanup

GO verdict（v: GO）を出力し、かつ全タスクが完了している場合にのみ実行する。

**判定ロジック**:
1. `BRANCH=$(git rev-parse --abbrev-ref HEAD)` — 現在のブランチ取得
2. `$BRANCH` が `main` または `master` → **スキップ**（マージ不要）
3. `$FEATURE_DIR/tasks.md` を読み、未完了タスク（`- [ ]`）の有無を確認
   - 未完了タスクあり → **スキップ**（次フェーズの実装が残っている）
   - 全タスク完了（`- [ ]` が 0 件） → 以下を実行

**マージ手順**:
1. 未コミットの変更を確認: `git status --porcelain`
   - 変更あり → `git add -A && git commit -m "chore: レビュー完了時の最終調整"`
2. `git checkout main`
3. `git pull origin main --ff-only` — リモートと同期（失敗時はユーザーに報告して中断）
4. `git merge $BRANCH --no-edit` — マージ（コンフリクト時はユーザーに報告して中断）
5. `git push origin main`
6. `git branch -d $BRANCH`
7. リモートブランチ存在確認: `git ls-remote --heads origin $BRANCH`
   - 存在する → `git push origin --delete $BRANCH`
8. 出力: `"✅ ブランチ '$BRANCH' を main にマージし、削除しました。"`

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

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

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`.
  Instruction: "Review phase `$ARGUMENTS`. Check all phase artifacts including code, tests, docs. Output compact English YAML."

  **Execution routing** — follow `templates/review-routing-protocol.md`. Replace `<AGENT>` with each persona name and `<INSTRUCTION>` with the review instruction above.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).
  Additionally verify Definition of Done: all tasks completed, quality gates passed, all tests passing, code review done, adversarial review passed, docs updated, no regressions, security reviewed.

**STEP 2.5 Progress Report**:
After aggregation, output a structured progress marker on its own line:
  `[REVIEW-PROGRESS: phasereview #${N}: ${ISSUE_COUNT} issues (C:${c} H:${h} M:${m} L:${l}) → ${ACTION}]`
  `[REVIEW-PROGRESS: phasereview #${N}: DoD ${DONE}/${TOTAL}]`
Where N = iteration number, ACTION = "fixing..." (issues > 0) or "GO" (issues == 0).
This marker MUST be output in all execution modes (interactive and Non-Interactive).

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Spawn `review-fixer` sub-agent with aggregated issues (priority C→H→M→L) using resolved config for `review-fixer` (same routing logic). After fix → back to STEP 1.

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

Run: `node scripts/update-dashboard.mjs --command phasereview`

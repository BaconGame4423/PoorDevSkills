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

## Review Configuration

```
REVIEW_TYPE = phasereview
PERSONAS = [phasereview-qa, phasereview-regression, phasereview-docs, phasereview-ux]
ID_PREFIX = PH
light_personas = [phasereview-qa, phasereview-docs]
```

Follow the **Review Loop Common Template** (`templates/review-loop.md`) with the above parameters.
All steps (STEP 0 Config Resolution, STEP 0.3 Review Depth, STEP 0.5 Review Log Init,
Review Log Windowing, STEP 1-4 Review Loop with early termination) are defined there.

**STEP 1 instruction override**: "Review phase `$ARGUMENTS`. Review log: `${WINDOWED_LOG}`. Check all phase artifacts including code, tests, docs. Output compact English YAML."

**Additional STEP 2 checks** (phasereview-specific):
- Verify Definition of Done: all tasks completed, quality gates passed, all tests passing, code review done, adversarial review passed, docs updated, no regressions, security reviewed.

**STEP 2.5 extension**: Additional progress marker:
  `[REVIEW-PROGRESS: phasereview #${N}: DoD ${DONE}/${TOTAL}]`

**VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug.

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

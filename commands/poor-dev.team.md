---
description: "Agent Teams orchestrator for all development flows"
---

# poor-dev.team — Agent Teams Orchestrator

Orchestrate development workflows using Claude Code Agent Teams.

## Phase 0: Discussion

Before creating any teams:
0. Verify TS helper exists: `ls .poor-dev/dist/bin/poor-dev-next.js` — if missing, tell user to run `npm run build` in the DevSkills source repo and re-run `poor-dev init`
1. Classify the user's request into a flow type (feature, bugfix, investigation, roadmap, discovery)
2. Discuss scope and requirements with the user via AskUserQuestion:
   - スコープ確認: 要件リストを表示し「追加・変更はありますか？」
   - 技術スタック: 必要なら選択肢を提示
   - 質問が不要なほど要件が明確な場合はスキップ可
3. Create `discussion-summary.md` in the feature directory
4. No teammates are spawned during this phase

## Core Loop

After Phase 0, execute the pipeline via TS helper:

1. Run: `node .poor-dev/dist/bin/poor-dev-next.js --flow <FLOW> --state-dir <DIR> --project-dir .`
2. Parse the JSON output and execute the action:
   - `create_team` → 以下の手順を厳守:
     1. **Cleanup**: TeamDelete (既存チームがあれば削除。エラーは無視)
     2. **TeamCreate**: `team_name` は JSON の `team_name` フィールドをそのまま使用
     3. **Spawn**: JSON の `teammates[]` 毎に Task ツールで spawn:
        - `name` = `teammates[].role`, `team_name` = 上記チーム名
        - `subagent_type` = `"general-purpose"` (Claude Code が `.claude/agents/{role}.md` を自動ロード)
        - `prompt` は最小限 (role と step の説明のみ)。詳細指示は agent file から自動注入される
     4. **TaskCreate**: JSON の `tasks[]` 毎に:
        - `subject` = `tasks[].subject`
        - `description` = **JSON の `tasks[].description` をそのまま使用** (Opus が書き換え禁止)
        - **Context injection のみ追記**: description の `Context:` 行に列挙された各ファイルを Read し、末尾に `## Context: {key}\n{content}` を append。50,000文字超は先頭で切り詰め
        - `owner` = `tasks[].assignTo`
     5. **Wait**: TaskList ポーリングで全タスク完了を確認 (120秒応答なし → §Error Handling)
     6. **Commit**: JSON の `artifacts[]` を処理:
        - `artifacts` に `"*"` が含まれる場合: feature dir 内の全変更を `git add`。`git status` で不要ファイル（中間ファイル等）がないか確認し、あれば `git reset HEAD <file>` で除外
        - それ以外: `artifacts[]` に列挙されたファイルを `git add -f` && commit
     7. **Step complete**: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --state-dir <DIR> --project-dir .`
     8. **Shutdown**: 各 teammate に shutdown_request → 確認待ち
     9. **TeamDelete**
   - `create_review_team` → Opus-mediated review loop (see §Review Loop below)
   - `user_gate` → See §User Gates below
   - `done` → Report completion to user
3. After action completes: see §Conditional Steps below
4. Return to step 1

### 禁止事項 (Pipeline Step Execution)
- パイプラインステップの作業を Opus が直接実行してはならない（Write/Edit でのファイル生成、直接レビュー等）
- Task サブエージェント（`team_name` なし）でパイプラインステップを実行してはならない
- JSON の `tasks[].description` を独自プロンプトで置き換えてはならない（Context injection の追記のみ許可）
- TeamMate 応答失敗時に「残りステップは直接実行」等の方針転換は禁止 → §Error Handling に従う

### Conditional Steps

When a step is in the flow's `conditionals` list (e.g., bugfix, rebuildcheck):
1. After teammate completes work, scan output for conditional markers:
   - `[SCALE: SMALL]` → key: `<step>:SCALE_SMALL`
   - `[SCALE: LARGE]` → key: `<step>:SCALE_LARGE`
   - `[RECLASSIFY: FEATURE]` → key: `<step>:RECLASSIFY_FEATURE`
   - `[VERDICT: REBUILD]` → key: `<step>:REBUILD`
   - `[VERDICT: CONTINUE]` → key: `<step>:CONTINUE`
2. If marker found: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --set-conditional "<key>" --state-dir <DIR> --project-dir .`
3. If no marker found: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --state-dir <DIR> --project-dir .`

### User Gates

When the TS helper returns `user_gate`:
1. Display the `message` to the user
2. Present `options` as choices
3. After user responds: `node .poor-dev/dist/bin/poor-dev-next.js --gate-response <response> --state-dir <DIR> --project-dir .`
4. Parse the returned action and continue the Core Loop

## Review Loop (Opus-Mediated, Parallel Reviewers)

For `create_review_team` actions. Initialize: `iteration = 0`, `fixed_ids = Set()`

### Step 1: Dispatch
- `iteration += 1`
- **初回のみ**: 上記 `create_team` 手順の 1-4 を実行してチーム作成
- **2回目以降** (fix 後のリトライ): 既存チームで TaskCreate 再発行
- reviewer は read-only、fixer は write-enabled
- target files + 前回 review-log を task description に含める

### Step 2: Collect & Parse
- Reviewer メッセージ待ち。TaskList を使って完了状況を確認可能
- 外部モニターが `[MONITOR]` メッセージを送信した場合 → §Error Handling 参照
- 各レビュアー出力から以下を抽出:
  - `ISSUE: {C|H|M|L} | {description} | {file:line}`
  - `VERDICT: {GO|CONDITIONAL|NO-GO}`
- VERDICT 行なし → そのレビュアーに SendMessage で再出力依頼（最大2回）
- Deduplicate: same file:line + same severity → keep first
- Aggregate VERDICT: worst wins (NO-GO > CONDITIONAL > GO)

### Step 3: Convergence Check
- C=0 AND H=0 (fixed_ids 除外後) → `review-log-{step}.yaml` 更新 → `git add -f review-log-{step}.yaml` → commit → step complete → TeamDelete
- iteration >= max_iterations → user_gate → TeamDelete
- Otherwise → Step 4

### Step 4: Fix
- C/H イシューを fixer に SendMessage: `- [{id}] {severity} | {description} | {location}`
- Fixer が fixed/rejected YAML を返す → fixed_ids に追加
- Opus が修正ファイルを確認: コード重複 >=10行・debug 文混入 → fixer に差し戻し（最大2回）
- clean → `review-log-{step}.yaml` 更新 → `git add -f review-log-{step}.yaml` → commit → Step 1 に戻る

## Error Handling

### Monitor Nudge Response
`[MONITOR]` メッセージが入力に表示されたら:
1. 名指しされた stalled teammate に SendMessage: "Are you still working? Please respond with status."
2. 現在の作業を続行（ブロックしない）
3. 応答あり → 問題なし
4. 次のアクションサイクルでも応答なし:
   a. shutdown_request 送信 → 確認待ち
   b. 同じ agent spec で Task re-spawn → タスク再割当
   c. respawn カウント（teammate 毎最大3回）
5. 3回 respawn 後も失敗 → その reviewer なしで続行（graceful degradation）
6. 全 teammate 同時失敗 → rate limit 疑い → 120s 待機 → リトライ（最大3回）

### TeamCreate / Teammate Failure
- "Already leading team" エラー → TeamDelete → 5秒待機 → TeamCreate 再試行（最大2回）
- Teammate タイムアウト (120秒応答なし):
  1. SendMessage で状態確認
  2. 応答なし → shutdown_request 送信
  3. 同じ `teammates[]` spec で再 spawn → TaskCreate で同じタスク再割当
  4. respawn 3回失敗 → `[ERROR: {role} failed after 3 respawns]` 出力して **停止**（直接実行に切り替えない）

### Other
- Review loop > max_iterations → user confirmation required
- Fixer validation failure → retry (max 2) → user confirmation
- Crash recovery → pipeline-state.json + `node .poor-dev/dist/bin/poor-dev-next.js` to resume

## Team Naming

Format: `pd-<step>-<NNN>` where NNN is from the feature directory name.

## Git Operations

All git operations (commit, push, checkout, clean) are performed by Opus only.
Teammates NEVER execute git commands.

### When to Commit
- After `create_team` for `implement` step completes: stage and commit all implementation changes
- After fixer reports modifications in a review loop: stage and commit the fixes + `review-log-{step}.yaml`
- After review convergence (C=0, H=0): commit `review-log-{step}.yaml`
- After `create_team` for artifact-producing steps (specify, suggest, plan, tasks, testdesign): commit the generated artifact
- Commit message format: `type: 日本語タイトル` (per CLAUDE.md conventions)

### Review Log Format
Review log files use the naming convention `review-log-{step}.yaml` and follow this structure:
```yaml
step: architecturereview
iterations:
  log:
    - {n: 1, raw_issues: 26, actionable: 6, fixed: "AR-001,AR-002,AR-003,AR-004,AR-005,AR-006"}
  issues:
    - id: AR-001
      severity: H
      description: "..."
      location: "..."
      status: fixed
```
- `raw_issues`: 全レビュアーの未フィルタ合計
- `actionable`: dedup + severity filter 後の修正対象件数

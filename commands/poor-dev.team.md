---
description: "Agent Teams orchestrator for all development flows"
---

# poor-dev.team — Agent Teams Orchestrator

Orchestrate development workflows using Claude Code Agent Teams.

## Compaction Recovery

If context is unclear after compaction, run:
```
node .poor-dev/dist/bin/poor-dev-next.js --state-dir <FEATURE_DIR> --project-dir .
```
This returns the current pipeline state and next action as JSON. Resume the Core Loop from there.

## Phase 0: Discussion

Before creating any teams:
0. Verify TS helper exists: `ls .poor-dev/dist/bin/poor-dev-next.js` — if missing, tell user to run `npm run build` in the DevSkills source repo and re-run `poor-dev init`
1. Classify the user's request into a flow type (feature, bugfix, investigation, roadmap, discovery)
2. Discuss scope and requirements with the user via AskUserQuestion:
   - スコープ確認: 要件リストを表示し「追加・変更はありますか？」
   - 技術スタック: 必要なら選択肢を提示
   - 質問が不要なほど要件が明確な場合はスキップ可
3. **Create feature directory**: `features/<NNN>-<kebab-case-name>/`
   - NNN = 3桁連番 (001, 002, ...)。既存 features/ ディレクトリの最大値 + 1
   - 例: `features/001-function-visualizer/`
   - **禁止**: `_runs/` 配下に作成しないこと（アーカイブ領域と衝突）
4. Create `discussion-summary.md` in the feature directory
5. No teammates are spawned during this phase

## Core Loop

After Phase 0, execute the pipeline via TS helper:

1. Run: `node .poor-dev/dist/bin/poor-dev-next.js --flow <FLOW> --state-dir <DIR> --project-dir .` (Bash Dispatch モード時は `--bash-dispatch` を追加)
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
        - **Context injection (hybrid)**: description の `Context:` 行を確認:
          - `[inject]` マーク付きファイル: Read して末尾に `## Context: {key}\n{content}` を append。50,000文字超は先頭で切り詰め
          - `[self-read]` マーク付きファイル: パスのみ記載（worker が自分で Read する）
        - `owner` = `tasks[].assignTo`
     5. **Wait**: TaskList ポーリングで全タスク完了を確認 (120秒応答なし → §Error Handling)。注: Bash(sleep) で待機してはならない。TaskList ツールを使用すること
     6. **Commit**: JSON の `artifacts[]` を処理:
        - `artifacts` に `"*"` が含まれる場合: feature dir 内の全変更を `git add`。`git status` で不要ファイル（中間ファイル等）がないか確認し、あれば `git reset HEAD <file>` で除外
        - それ以外: `artifacts[]` に列挙されたファイルを `git add -f` && commit
     7. **Step complete**: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --state-dir <DIR> --project-dir .`
     8. **Shutdown**: 各 teammate に shutdown_request → 確認待ち
     9. **TeamDelete**
   - `create_review_team` → Opus-mediated review loop (see §Review Loop below)
   - `bash_dispatch` → Bash Dispatch で worker 実行 (see §Bash Dispatch below)
   - `bash_review_dispatch` → Bash Dispatch で review loop 実行 (see §Bash Review Dispatch below)
   - `user_gate` → See §User Gates below
   - `done` → Report completion to user
3. After action completes: see §Conditional Steps below
4. Return to step 1

### 禁止事項 (Pipeline Step Execution)
- パイプラインステップの作業を Opus が直接実行してはならない（Write/Edit でのファイル生成、直接レビュー等）
- Task サブエージェント（`team_name` なし）でパイプラインステップを実行してはならない
- JSON の `tasks[].description` を独自プロンプトで置き換えてはならない（Context injection の追記のみ許可）
- TeamMate 応答失敗時に「残りステップは直接実行」等の方針転換は禁止 → §Error Handling に従う

**Implement Step Exception**: tasks.md の全タスクが同一ファイルを対象とする場合、
CLAUDE.md の例外規定に従い逐次実装を使用する。
並列 TeamMate での同一ファイル書き込みは禁止。

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
- **初回のみ**: `create_team` 手順の 1-4 を実行してチーム作成。
  JSON の `tasks[]` を使って reviewer/fixer 両方に TaskCreate を実行すること
- **2回目以降** (fix 後のリトライ): 既存チームで reviewer タスクのみ TaskCreate 再発行
- reviewer は read-only、fixer は write-enabled
- target files + 前回 review-log を task description に含める

### Step 2: Collect & Process (Single CLI Call)
- **TaskList ポーリングで reviewer タスク完了を確認** (`create_team` Step 5 と同じパターン)
- reviewer タスクが completed になったら、reviewer からのメッセージを処理する:
  - メッセージが未着の場合: 短いステータス出力でターンを終了し、メッセージ配信を待つ
- 外部モニターが `[MONITOR]` メッセージを送信した場合 → §Error Handling 参照

**CRITICAL — Anti-Sleep Rule:**
`Bash(sleep N)` で teammate の応答を待ってはならない。TaskList ポーリングを使用すること。

- reviewer からの SendMessage 内容を一時ファイルに保存
- **統合レビューサイクル**: 以下の JSON を一時ファイルに書き出し:
  ```json
  {"rawReview": "<reviewer output>", "fixedIds": ["AR001"], "idPrefix": "AR", "iteration": 1, "maxIterations": 8}
  ```
  `node .poor-dev/dist/bin/poor-dev-next.js --review-cycle <file>` で一括処理。
  戻り値: `{ converged, verdict, parseMethod, fixerInstructions, reviewLogEntry, maxIterationsReached }`

### Step 3: Branch on Result
- `converged: true` → `review-log-{step}.yaml` 更新 → commit → step complete → TeamDelete
- `maxIterationsReached: true` → user_gate → TeamDelete
- Otherwise → fixer に `fixerInstructions` を SendMessage → fixer の fixed/rejected を受信 → fixedIds に追加 → Step 1 に戻る

## Bash Dispatch (glm -p)

For `bash_dispatch` actions. Team lifecycle なしで glm -p (CLI headless mode) を直接呼び出す。

### 手順
1. プロンプトをファイルに書き出し: `<feature-dir>/.pd-dispatch/<step>-prompt.txt`
2. `mkdir -p <feature-dir>/.pd-dispatch` (初回のみ)
3. glm -p 実行:
   ```bash
   CLAUDECODE= timeout 600 glm -p "$(cat <feature-dir>/.pd-dispatch/<step>-prompt.txt)" \
     --append-system-prompt-file <worker.agentFile> \
     --allowedTools "<worker.tools>" \
     --output-format json \
     --max-turns <worker.maxTurns> \
     > <feature-dir>/.pd-dispatch/<step>-worker-result.json 2>&1
   ```
   **重要**: `CLAUDECODE=` で環境変数をクリアしてネストセッション検出を回避する
4. 結果 JSON を Read:
   - `subtype: "success"` → 成功
   - `subtype: "error_max_turns"` → max-turns 超過、ユーザーに報告
   - `subtype: "error_during_execution"` → エラー、ユーザーに報告
   - タイムアウト (exit code 124) → ユーザーに報告
5. artifacts を git add && commit
6. Step complete: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --bash-dispatch --state-dir <DIR> --project-dir .`
7. 次のステップへ (Core Loop に戻る)

## Bash Review Dispatch (glm -p)

For `bash_review_dispatch` actions. Initialize: `iteration = 0`, `fixed_ids = []`

### Step 1: Reviewer 実行
- `iteration += 1`
- reviewer を glm -p で実行:
  ```bash
  CLAUDECODE= timeout 600 glm -p "$(cat <review-prompt-file>)" \
    --append-system-prompt-file <reviewer.agentFile> \
    --allowedTools "<reviewer.tools>" \
    --output-format json \
    --max-turns <reviewer.maxTurns> \
    > <step>-reviewer-result.json 2>&1
  ```
- 結果 JSON の `result` フィールドからテキスト出力を取得

### Step 2: Review Cycle 処理
- reviewer テキスト出力を一時ファイルに保存
- `--review-cycle` で一括処理 (Agent Teams 版と同じ):
  ```json
  {"rawReview": "<reviewer output>", "fixedIds": [...], "idPrefix": "AR", "iteration": 1, "maxIterations": 8}
  ```
- 戻り値: `{ converged, verdict, fixerInstructions, reviewLogEntry, maxIterationsReached }`

### Step 3: 分岐
- `converged: true` → review-log 更新 → commit → step-complete → 完了
- `maxIterationsReached: true` → ユーザーに報告
- Otherwise → Step 4 へ

### Step 4: Fixer 実行
- fixer プロンプトを構築: `fixerBasePrompt + "\n\n## Review Issues (Iteration N)\n" + fixerInstructions`
- fixer を glm -p で実行:
  ```bash
  CLAUDECODE= timeout 600 glm -p "$(cat <fixer-prompt-file>)" \
    --append-system-prompt-file <fixer.agentFile> \
    --allowedTools "<fixer.tools>" \
    --output-format json \
    --max-turns <fixer.maxTurns> \
    > <step>-fixer-result.json 2>&1
  ```
- fixer 結果の `result` から fixed/rejected ID を抽出 → `fixed_ids` に追加
- commit fixes
- Step 1 に戻る

### エラー処理
- glm -p タイムアウト (exit 124) → 1回リトライ → 再失敗でユーザーに報告
- glm -p エラー出力 → ログに記録、ユーザーに報告

### 一時ファイル管理
- 一時ファイルは `<feature-dir>/.pd-dispatch/` に保存
- パイプライン完了後に `.pd-dispatch/` を削除

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
5. 3回 respawn 後も失敗 → review-log に `verdict: GO` + `note: "DEGRADED: {role} failed after 3 respawns"` を記録して続行
6. **全レビューステップが DEGRADED の場合**: ユーザーに警告メッセージを出力: "WARNING: All review steps degraded. Quality gate bypassed."
7. 全 teammate 同時失敗 → rate limit 疑い → 120s 待機 → リトライ（最大3回）

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

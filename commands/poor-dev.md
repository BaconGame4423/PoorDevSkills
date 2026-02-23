---
description: "Bash Dispatch orchestrator for all development flows"
---

# poor-dev — Bash Dispatch Orchestrator

Orchestrate development workflows using Bash Dispatch (`glm -p` direct invocation).

## Compaction Recovery

If context is unclear after compaction, run:
```
node .poor-dev/dist/bin/poor-dev-next.js --state-dir <FEATURE_DIR> --project-dir .
```
This returns the current pipeline state and next action as JSON. Resume the Core Loop from there.

## Phase 0: Discussion (Plan Mode)

**重要: EnterPlanMode は無条件必須**
`/poor-dev` が呼ばれたら、引数の内容に関わらず（質問、タスク依頼、曖昧な入力すべて）、
最初に必ず `EnterPlanMode` を呼ぶこと。
「質問だから Plan モード不要」という判断は禁止。Plan Mode の read-only 保証がセーフガードとして機能する。

引数が質問のみの場合:
- Plan モード内で質問に回答し、パイプライン開始が不要なら ExitPlanMode で終了
- feature ディレクトリの作成や Core Loop への進行は不要

Before starting the pipeline:
0. Verify TS helper exists: `ls .poor-dev/dist/bin/poor-dev-next.js` — if missing, tell user to run `npm run build` in the DevSkills source repo and re-run `poor-dev init`
1. **Enter Plan Mode**: Call `EnterPlanMode` to enter read-only planning mode.
   Plan Mode ensures no files are created or modified during the discussion phase.

### Plan Mode 中に行うこと (read-only operations only)

2. List available flows (read-only Bash — Plan Mode 中でも実行可):
   ```bash
   node .poor-dev/dist/bin/poor-dev-next.js --list-flows --project-dir .
   ```
   Parse the JSON output. Classify the user's request into one of the available flow names.
   If custom flows exist, consider them in classification alongside built-in flows.
3. Discuss scope and requirements with the user via AskUserQuestion:
   - スコープ確認: 要件リストを表示し「追加・変更はありますか？」
   - 技術スタック: 必要なら選択肢を提示
   - 質問が不要なほど要件が明確な場合はスキップ可（ただし ExitPlanMode は必須）
4. Write discussion results to the plan file:
   - **Selected flow**: フロー名 (例: feature, bugfix, roadmap)
   - **Scope summary**: 実現したいことの要約 (2-3 文)
   - **Requirements**: ユーザーとの議論で確定した要件・制約のリスト
   - **Tech decisions**: 技術スタック選択（該当する場合）
   - **Pipeline**: `proceed` or `skip` — 質問回答のみでパイプライン不要なら `skip`
5. **Exit Plan Mode**: Call `ExitPlanMode` to present the plan for user approval.
   - ユーザーが承認:
     - Plan に `Pipeline: skip` と記載されている → **ここで終了**。feature ディレクトリ作成・Core Loop には進まない
     - Plan に `Pipeline: proceed` と記載されている → Phase 0 Post-Plan に進む
   - ユーザーが却下 → Plan Mode に留まり、フィードバックに基づき修正して再度 ExitPlanMode

### Plan Mode 中の禁止事項
- ファイル作成 (Write/Edit) 禁止
- ディレクトリ作成 (mkdir) 禁止
- 変更系 Bash コマンド禁止
- Read-only Bash (`node ... --list-flows`, `ls`, `cat` 等) は許可

### Plan Mode 終了後 (ユーザー承認後)

6. **Create feature directory**: `features/<NNN>-<kebab-case-name>/`
   - NNN = 3桁連番 (001, 002, ...)。既存 features/ ディレクトリの最大値 + 1
   - 例: `features/001-function-visualizer/`
   - **禁止**: `_runs/` 配下に作成しないこと（アーカイブ領域と衝突）
7. Create `discussion-summary.md` in the feature directory:
   - Plan ファイルの内容をもとに生成する
   - フロー分類、スコープ、ユーザー要件・制約を含める
8. No sub-agents are spawned during this phase

## Core Loop

After Phase 0, execute the pipeline via TS helper:

1. Run: `node .poor-dev/dist/bin/poor-dev-next.js --flow <FLOW> --state-dir <DIR> --project-dir .`
2. Parse the JSON output and execute the action:
   - `bash_dispatch` → Bash Dispatch で worker 実行 (see §Bash Dispatch below)
   - `bash_review_dispatch` → Bash Dispatch で review loop 実行 (see §Bash Review Dispatch below)
   - `user_gate` → See §User Gates below
   - `done` → Report completion to user
3. After action completes: see §Conditional Steps below
4. Return to step 1

### 禁止事項 (Pipeline Step Execution)
- パイプラインステップの作業を Opus が直接実行してはならない（Write/Edit でのファイル生成、直接レビュー等）
- JSON の `tasks[].description` を独自プロンプトで置き換えてはならない
- 失敗時に「残りステップは直接実行」等の方針転換は禁止 → §Error Handling に従う

**Implement Step Exception**: tasks.md の全タスクが同一ファイルを対象とする場合、
CLAUDE.md の例外規定に従い逐次実装を使用する。

### Conditional Steps

When a step is in the flow's `conditionals` list (e.g., bugfix, rebuildcheck):
1. After worker completes, scan output for conditional markers:
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
6. Step complete: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --state-dir <DIR> --project-dir .`
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
- `--review-cycle` で一括処理:
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

### Other
- Review loop > max_iterations → user confirmation required
- Fixer validation failure → retry (max 2) → user confirmation
- Crash recovery → pipeline-state.json + `node .poor-dev/dist/bin/poor-dev-next.js` to resume

## Git Operations

All git operations (commit, push, checkout, clean) are performed by Opus only.
Workers dispatched via glm -p NEVER execute git commands.

### When to Commit
- After `bash_dispatch` for `implement` step completes: stage and commit all implementation changes
- After fixer reports modifications in a review loop: stage and commit the fixes + `review-log-{step}.yaml`
- After review convergence (C=0, H=0): commit `review-log-{step}.yaml`
- After `bash_dispatch` for artifact-producing steps (specify, plan, tasks, testdesign): commit the generated artifact
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

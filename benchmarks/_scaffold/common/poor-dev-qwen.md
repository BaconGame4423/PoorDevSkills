---
description: "Bash Dispatch orchestrator for all development flows"
model: opusplan
---

# poor-dev — Bash Dispatch Orchestrator

Orchestrate development workflows using Bash Dispatch (`qwen -p` direct invocation).

## Compaction Recovery

If context is unclear after compaction, run:
```
node .poor-dev/dist/bin/poor-dev-next.js --state-dir <FEATURE_DIR> --project-dir .
```
This returns the current pipeline state and next action as JSON. Resume the Core Loop from there.

**Detached Dispatch 中のコンパクション回復**: `bash_dispatch` で `action.detached` が `true` の場合、
TS helper を再実行すると `action.command` と `action.pollCommand` を含む同じ action JSON が返る。
回復手順: (1) `action.command` を再実行（冪等） (2) `action.pollCommand` を即座に Bash 実行 (3) `DISPATCH_COMPLETE` まで繰り返す。
`action.pollCommand` を実行せずに idle になるのは禁止。

### モデル設定
このSkillは `opusplan` モデルで動作します。
Phase 0 (Plan Mode) は Opus、Core Loop は Sonnet で自動切替されます。

## Phase 0: Discussion (Plan Mode)

**重要: EnterPlanMode は無条件必須**
`/poor-dev` が呼ばれたら、引数の内容に関わらず（質問、タスク依頼、曖昧な入力すべて）、
最初に必ず `EnterPlanMode` を呼ぶこと。
「質問だから Plan モード不要」という判断は禁止。Plan Mode の read-only 保証がセーフガードとして機能する。

引数が質問のみの場合:
- Plan モード内で質問に回答し、パイプライン開始が不要なら ExitPlanMode で終了
- feature ディレクトリの作成や Core Loop への進行は不要

Before starting the pipeline:
0. Verify TS helper exists: `ls .poor-dev/dist/bin/poor-dev-next.js` — if missing, tell user to run `poor-dev init` to set up the pipeline
1. **Enter Plan Mode**: Call `EnterPlanMode` to enter read-only planning mode.
   Plan Mode ensures no files are created or modified during the discussion phase.

### Plan Mode 中に行うこと (read-only operations only)

2. List available flows (read-only Bash — Plan Mode 中でも実行可):
   ```bash
   node .poor-dev/dist/bin/poor-dev-next.js --list-flows --project-dir .
   ```
   Parse the JSON output. Classify the user's request into one of the available flow names.
   If custom flows exist, consider them in classification alongside built-in flows.
3. **壁打ちフェーズ** (Plan ファイル書き込み禁止):
   - ユーザーと自由に対話してスコープ・要件・技術選択を議論する
   - AskUserQuestion も使えるが、テキスト出力での自由対話が基本
   - **Plan ファイルへの書き込みは禁止** — 議論が固まるまで形式化しない
   - 議論が十分と判断したら「まとめて Plan に書きましょうか？」と確認する
   - ユーザーが了承するまで壁打ちを継続
4. **ユーザー許可後**: Plan ファイルに以下のセクション (H2) を記載:
   - **Feature name**: kebab-case 名 (例: function-visualizer)
   - **Selected flow**: フロー名 (例: feature, bugfix, roadmap)
   - **Scope summary**: 実現したいことの要約 (2-3 文)
   - **Requirements**: ユーザーとの議論で確定した要件・制約のリスト
   - **Tech decisions**: 技術スタック選択（該当する場合）
   - **Pipeline**: `proceed` or `skip` — 質問回答のみでパイプライン不要なら `skip`
   - proceed の場合、Plan 末尾に以下を記載 (self-reminder):
     **承認後: `node .poor-dev/dist/bin/poor-dev-next.js --init-from-plan <plan-file-path> --project-dir .`**
5. **Exit Plan Mode**: `ExitPlanMode` で Plan を提示。
   - 承認 + `skip` → 終了
   - 承認 + `proceed` → Step 6 (Init from Plan) を即実行
   - 却下 → フィードバック反映後に再度 ExitPlanMode

Plan Mode は read-only。Write/Edit/mkdir/変更系 Bash 禁止。Plan 書き込みはユーザー許可後のみ。

## Plan 承認後 → Core Loop 遷移

Plan 承認後、直接ファイルを作成・編集せずに init-from-plan を実行する。
init-from-plan が feature ディレクトリ作成・pipeline 初期化・最初のアクション計算を一括で行う。

6. **Init from Plan** を即実行:
   ```bash
   node .poor-dev/dist/bin/poor-dev-next.js --init-from-plan <plan-file-path> --project-dir .
   ```
   - JSON 出力を Core Loop Step 2 (アクション解析) から開始
   - `_initFromPlan.featureDir` を以降の `<DIR>` として記録
   - `_initFromPlan.warnings` にパース警告がある場合はユーザーに表示
   - `--flow` オプションで plan の `## Selected flow` を上書き可能
   - `skip` の場合は `{ action: "done" }` が返り終了

### CRITICAL: Model Switch Checkpoint (opusplan)

`opusplan` モードでは ExitPlanMode 後に Opus→Sonnet のモデル切替が発生します。

**Phase 0 (Step 0〜5) は Opus が完了済み。再実行しないこと。**
**TS helper 存在確認、EnterPlanMode、壁打ち等は全て完了済み。**

Sonnet は以下を順に実行して Core Loop を開始する:

1. CWD 確認: `pwd` を実行し、プロジェクトルート（ベンチマークディレクトリ）であることを確認
2. TS helper 確認: `ls .poor-dev/dist/bin/poor-dev-next.js` を実行し存在を確認（**相対パスで実行、絶対パスに変換しない**）
3. Plan 末尾の **`承認後:`** に記載されたコマンドをそのまま Bash で実行（コマンドを改変・自力構成しない）
4. stdout の **JSON をパースする** (テキストでの要約は禁止)
5. JSON の `action` に応じて **即座に** Core Loop のアクションを実行:
   - `bash_dispatch` → `command` をそのまま Bash で実行
   - `bash_review_dispatch` → `reviewerCommand` をそのまま Bash で実行
   - `done` → 完了
6. この Checkpoint を完了するまでテキスト出力・解説を行わないこと

## Core Loop

After Phase 0 (`--init-from-plan` の出力が最初のアクション), execute the pipeline via TS helper:

**First-action guard**: pipeline-state.json が存在するが `.pd-dispatch/` 内に `*-worker-result.json` が 0 件の場合、
Core Loop の最初のアクションが未実行。TS ヘルパーを再実行してアクションを取得:
```bash
node .poor-dev/dist/bin/poor-dev-next.js --state-dir <DIR> --project-dir . --prompt-dir <DIR>/.pd-dispatch
```
JSON 出力の `command` をそのまま Bash で実行する。

1. **初回**: `--init-from-plan` の JSON 出力をそのまま使用。`_initFromPlan.featureDir` を以降の `<DIR>` として記録
   **2回目以降**: `node .poor-dev/dist/bin/poor-dev-next.js --state-dir <DIR> --project-dir . --prompt-dir <DIR>/.pd-dispatch`
2. Parse the JSON output and execute the action:
   - `bash_dispatch` → Bash Dispatch で worker 実行 (see §Bash Dispatch below)
   - `bash_review_dispatch` → Bash Dispatch で review loop 実行 (see §Bash Review Dispatch below)
   - `bash_parallel_dispatch` → 並列 Bash Dispatch (see §Bash Parallel Dispatch below)
   - `user_gate` → See §User Gates below
   - `done` → Generate cost report + report completion to user (see §Cost Report below)
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

#### Standard Gates (no gateOptions)
1. Display the `message` to the user
2. Present `options` as choices
3. After user responds: `node .poor-dev/dist/bin/poor-dev-next.js --gate-response <response> --state-dir <DIR> --project-dir .`
4. Parse the returned action and continue the Core Loop

#### Post-Step User Gates (gateOptions present)
`user_gate` に `gateOptions` が含まれる場合（userGates 由来）:
1. `gateOptions` の `label` を AskUserQuestion の選択肢として提示
2. ユーザー選択に対応する `conditionalKey` を取得
3. `node .poor-dev/dist/bin/poor-dev-next.js --gate-response <conditionalKey> --state-dir <DIR> --project-dir .`
4. Parse the returned action and continue the Core Loop

注: `gateOptions` 付きの user_gate では出力マーカースキャンは行わない。

## Cost Report

When the TS helper returns `done`, generate a cost report before reporting completion:

1. Find the latest orchestrator JSONL:
   ```bash
   JSONL_PATH=$(ls -t ~/.claude/projects/-$(pwd | tr / -)/*.jsonl 2>/dev/null | head -1)
   ```
2. Generate the integrated report:
   ```bash
   node .poor-dev/dist/bin/poor-dev-next.js --token-report <feature-dir>/.pd-dispatch --orchestrator-jsonl "$JSONL_PATH" > <feature-dir>/cost-report.json
   ```
   - If JSONL is not found, omit `--orchestrator-jsonl` (worker-only report)
3. Display cost summary to the user:
   - Orchestrator cost (model, tokens, USD)
   - Worker cost (total USD, turns)
   - Total cost (orchestrator + worker)
4. Commit `cost-report.json` with the final artifacts

## Bash Dispatch (dispatch-worker)

For `bash_dispatch` actions. `dispatch-worker.js` が timeout + 自動リトライを内包。

### 手順 (通常モード: `action.detached` が未設定または `false`)
1. `action.command` をそのまま Bash で実行:
   ```bash
   <action.command>
   ```
   コマンドは TS ヘルパーが完全生成済み。**LLM がコマンドを自力構成してはならない。**
   dispatch-worker が内部で timeout + リトライを処理する（値は config.json の dispatch セクションで設定）。
   **dispatch-worker は長時間実行になる場合がある。完了を待ち、途中で中断しないこと。**
2. result-file を Read:
   - `"status": "failed"` + `"lastError": "timeout"` → dispatch-worker が timeout 上限まで待機してリトライ済み。ユーザーに「タイムアウトで失敗。config.json dispatch.timeout の増加を検討」と報告。即座にパイプライン中断せず、ユーザー判断を仰ぐ
   - `"status": "failed"` + その他 → dispatch-worker がリトライ済みで最終失敗。ユーザーに報告
   - `subtype: "success"` → 成功
   - `subtype: "error_max_turns"` → max-turns 超過、ユーザーに報告
   - `subtype: "error_during_execution"` → エラー、ユーザーに報告
3. artifacts を git add && commit
4. Step complete: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --state-dir <DIR> --project-dir .`
5. 次のステップへ (Core Loop に戻る)

### Detached Dispatch (長時間 worker: `action.detached` が `true`)

dispatch-worker は `--detach` 付きで起動され、即座に return する。worker 本体はバックグラウンドで動作。
Qwen (ローカル llama.cpp) のディスパッチは 20-40 分かかることがある。

action JSON には `command`（dispatch 用）と `pollCommand`（polling 用）の2つの Bash コマンドが含まれる。

1. `action.command` を Bash で実行（即座に return する）
   - dispatch-worker は**冪等**: .pid が存在し worker が生存中なら重複起動せず exit 0 で return する
2. **即座に `action.pollCommand` を Bash で実行**（dispatch command の直後。テキスト出力を挟まない）
3. 出力を確認:
   - `DISPATCH_COMPLETE` → result-file を Read → 通常モードの手順 2（result-file 解析）以降へ
   - `DISPATCH_PENDING` → **`action.pollCommand` をそのまま再度 Bash で実行**（テキスト出力を挟まない）
4. `DISPATCH_COMPLETE` が出力されるまで手順 3 を繰り返す

**重要ルール**:
- `action.command`（dispatch）と `action.pollCommand`（polling）は**別のコマンド**。混同しない
- `DISPATCH_PENDING` 後に実行するのは `action.pollCommand`。`action.command` ではない
- polling ループは `36 × 16s = 576s < 600s` で Bash timeout 内に収まる
- polling 間にテキスト出力・解説を行わない。即座に `action.pollCommand` を再実行する
- `DISPATCH_PENDING` は正常（worker がまだ実行中）。**polling を停止してはならない**

**コンパクション回復時**: Compaction Recovery で TS helper を再実行すると同じ action JSON が返る。
`action.command` を再実行（冪等）→ `action.pollCommand` を実行 → `DISPATCH_COMPLETE` まで繰り返す。

## Bash Review Dispatch (dispatch-worker)

For `bash_review_dispatch` actions. Initialize: `iteration = 0`, `fixed_ids = []`

### Step 1: Reviewer 実行
- `iteration += 1`
- `action.reviewerCommand` をそのまま Bash で実行
- **`action.detached` が `true` の場合**: コマンドは即座に return する（冪等: 重複起動なし）。
  **即座に `action.reviewerPollCommand` を Bash で実行**。
  `DISPATCH_PENDING` → `action.reviewerPollCommand` を再実行（テキスト出力を挟まない）。
  `DISPATCH_COMPLETE` → result-file を Read。
- **通常モード**: コマンド完了を待つ
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
- fixer プロンプトをファイルに保存し、`action.fixerCommandPrefix` + `--prompt-file <path>` で実行:
  ```bash
  <action.fixerCommandPrefix> --prompt-file <fixer-prompt-file>
  ```
- **`action.detached` が `true` の場合**: コマンドは即座に return する（冪等: 重複起動なし）。
  **即座に `action.fixerPollCommand` を Bash で実行**。
  `DISPATCH_PENDING` → `action.fixerPollCommand` を再実行（テキスト出力を挟まない）。
  `DISPATCH_COMPLETE` → result-file を Read。
  **注意**: fixer の result file は毎 iteration 同じパスに上書きされる。polling 前に古い result file を削除すること:
  ```bash
  rm -f "<action.fixerResultFile>"
  ```
- fixer 結果の `result` から fixed/rejected ID を抽出 → `fixed_ids` に追加
- commit fixes
- Step 1 に戻る

### エラー処理
- dispatch-worker が timeout + リトライを内部処理。result-file に `"status": "failed"` → ユーザーに報告
- qwen -p エラー出力 → ログに記録、ユーザーに報告

### 一時ファイル管理
- 一時ファイルは `<feature-dir>/.pd-dispatch/` に保存
- パイプライン完了後に `.pd-dispatch/` を削除

## Bash Parallel Dispatch

For `bash_parallel_dispatch` actions. `steps` 配列内の各ステップを並列実行する。

### 2段階実行モデル (reviewer 並列 → fixer 逐次)

**Phase A: 全ステップの reviewer/worker を並列起動**

`steps` 配列を走査し、各ステップの `command` / `reviewerCommand` をバックグラウンドで並列実行:
- `bash_dispatch` → `step.command` を実行 (§Bash Dispatch と同じ)
- `bash_review_dispatch` → `step.reviewerCommand` を実行 (fixer はまだ実行しない)

各プロセスを PID/バックグラウンドジョブで管理し、個別に wait:
```bash
# 例: 3 ステップを並列実行（各 step の command/reviewerCommand をそのまま使用）
<step1.command> &
PID1=$!
<step2.reviewerCommand> &
PID2=$!
<step3.reviewerCommand> &
PID3=$!
wait $PID1 $PID2 $PID3
```

コマンドは TS ヘルパーが完全生成済み。dispatch-worker が timeout + リトライを内部処理。

**Phase B: 各 review-loop の fixer を逐次処理**

Phase A の reviewer 結果を使い、各 `bash_review_dispatch` ステップの review-cycle を逐次実行:
```
for step in [review steps with issues]:
  --review-cycle で parse + convergence check
  converged? → commit + next
  not converged? → fixer dispatch (逐次) → 再 reviewer → 収束まで
```
fixer は書き込みを行うため、逐次実行して git 競合を回避する。

**Phase C: 全ステップ完了マーク**
```bash
node .poor-dev/dist/bin/poor-dev-next.js --steps-complete testdesign,architecturereview,qualityreview --state-dir <DIR> --project-dir .
```
`_meta.step_complete_cmd` にこのコマンドが格納されている。

### bash_dispatch ステップの処理
- 通常の Bash Dispatch と同じ手順。結果確認 + artifact commit。

### bash_review_dispatch ステップの処理
- Phase A で reviewer のみ並列実行済み → reviewer 結果をそのまま `--review-cycle` に渡す
- 以降は §Bash Review Dispatch の Step 2 以降と同じ

## Error Handling

### Other
- Review loop > max_iterations → user confirmation required
- Fixer validation failure → retry (max 2) → user confirmation
- Crash recovery → pipeline-state.json + `node .poor-dev/dist/bin/poor-dev-next.js` to resume

## Git Operations

All git operations (commit, push, checkout, clean) are performed by Opus only.
Workers dispatched via qwen -p NEVER execute git commands.

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

## Quick Reference

- Phase 0 → Core Loop: `node .poor-dev/dist/bin/poor-dev-next.js --init-from-plan <plan-file-path> --project-dir .`
- Compaction Recovery: `node .poor-dev/dist/bin/poor-dev-next.js --state-dir <DIR> --project-dir .`
- Next step: `node .poor-dev/dist/bin/poor-dev-next.js --state-dir <DIR> --project-dir . --prompt-dir <DIR>/.pd-dispatch`

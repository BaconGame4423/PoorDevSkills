# コードフロー・副作用・状態遷移トレース

> 作成: 2026-02-19
> 対象: P1 (pipeline-runner.sh, retry-helpers.sh), P2 (review-runner.sh, pipeline-state.sh)
> 目的: TypeScript 移植のための設計参照資料

---

## 目次

1. [pipeline-runner.sh — メインフロー](#1-pipeline-runnersh--メインフロー)
2. [dispatch_implement_phases — フェーズ分割ディスパッチ](#2-dispatch_implement_phases--フェーズ分割ディスパッチ)
3. [retry-helpers.sh — リトライロジック](#3-retry-helperssh--リトライロジック)
4. [review-runner.sh — レビューループ](#4-review-runnersh--レビューループ)
5. [pipeline-state.sh — 状態管理](#5-pipeline-statesh--状態管理)
6. [副作用マップ（git 操作・ファイル削除）](#6-副作用マップ)
7. [pipeline-state.json 状態遷移図](#7-pipeline-statejson-状態遷移図)
8. [既知バグパターンと修正済みガード](#8-既知バグパターンと修正済みガード)
9. [コンポーネント間依存関係](#9-コンポーネント間依存関係)

---

## 1. pipeline-runner.sh — メインフロー

### 1-1. 起動・初期化フェーズ (L1–161)

```
起動引数:
  --flow           : feature | bugfix | roadmap | discovery-init | discovery-rebuild | investigation
  --feature-dir    : feature directory (PROJECT_DIR からの相対パス)
  --branch         : ブランチ名
  --project-dir    : プロジェクトルート (absoluteに解決)
  --completed      : 完了済みステップ CSV (カンマ区切り)
  --summary        : フィーチャーサマリ文字列
  --input-file     : 入力ファイルパス（現状未使用）
  --next           : 次の1ステップのみ実行モード
```

```
初期化フロー:
  1. PROJECT_DIR を realpath に解決
  2. .git 存在確認 (parent repo fallthrough 防止) → なければ exit 1
  3. COMPLETED_SET 構築:
       - --completed CSV → COMPLETED_SET["step"]=1
       - pipeline-state.json .completed[] → COMPLETED_SET["step"]=1
  4. resume 検出: status == "awaiting-approval" → clear-approval 呼び出し
  5. IMPLEMENT_COMPLETED フラグ初期化:
       COMPLETED_SET["implement"] が非空なら true
  6. config 読み込み (.poor-dev/config.json):
       - polling.idle_timeout (デフォルト 120s)
       - polling.max_timeout (デフォルト 600s)
  7. PIPELINE_STEPS 解決:
       pipeline-state.json .pipeline[] が存在すれば使用 (保存済みパイプライン優先)
       なければ get_pipeline_steps($FLOW) でデフォルト生成
  8. pipeline-state.json 初期化 (STATE_FILE が存在しない場合のみ):
       pipeline-state.sh init $FD $FLOW "$STEPS_JSON"
```

### 1-2. --next モード (L594–612)

```
--next == true の場合:
  PIPELINE_STEPS を走査し、最初の未完了ステップを1個だけ選択
  STEP_COUNT = そのステップのインデックス - 1 (offset)
  全ステップ完了済みなら:
    pipeline-state.sh set-status "completed"
    {"status":"pipeline_complete"} を出力して exit 0
```

### 1-3. メインディスパッチループ (L614–1022)

```
for STEP in $PIPELINE_STEPS:
  ├── [skip] COMPLETED_SET に含まれる → skipped イベント出力して continue
  ├── [prereq] check_prerequisites($STEP, $FD) → 失敗なら error + exit 1
  ├── [warn] specify ステップ + pending-clarifications.json 存在 → warning 出力
  ├── starting イベント出力
  │
  ├── [implement ブランチ]
  │   ├── validate_no_impl_files (phases未完了時のみ) ← 副作用: rm -f
  │   ├── dispatch_implement_phases → 成功なら protect_sources + complete-step + continue
  │   └── 失敗 (phases なし) → fallback イベント出力し、通常ディスパッチに続行
  │
  ├── [review ブランチ] (review_mode == "bash" の場合)
  │   ├── review-runner.sh 呼び出し
  │   ├── exit 3 → rate-limited + exit 3
  │   ├── exit 2 → paused (NO-GO) + exit 2
  │   └── 成功 → complete-step + continue
  │
  ├── コマンドファイル解決 (variant 優先: step-variant.md > step.md)
  ├── compose-prompt.sh でプロンプト生成 → $PROMPT_FILE
  │
  ├── dispatch_with_retry($STEP, ...) ← リトライラッパー
  │   ├── 成功 (exit 0)
  │   └── 失敗 → check_rate_limit → rate-limited or error + exit 1/3
  │
  ├── 出力抽出 (specify/suggest/plan/tasks) → spec.md, suggestions.yaml, plan.md, tasks.md
  ├── 成果物バリデーション (specify: spec.md 存在確認, tasks: format check)
  │
  ├── [条件ステップ処理] bugfix / rebuildcheck
  │   ├── bugfix: SCALE/RECLASSIFY マーカー読み取り → パイプライン動的変更
  │   └── rebuildcheck: VERDICT マーカー → パイプライン変更 or paused + exit 0/2
  │
  ├── [レビュー verdict 処理] GO/CONDITIONAL/NO-GO
  │   └── NO-GO → paused + exit 2
  │
  ├── [post-implement] implement 完了後 → protect_sources(), IMPLEMENT_COMPLETED=true
  │
  ├── [impl file validation] 非implementステップ + IMPLEMENT_COMPLETED=false の場合
  │   └── validate_no_impl_files($FD, $STEP) ← 副作用: rm -f
  │
  ├── pipeline-state.sh complete-step $FD $STEP ← 状態更新
  │
  ├── [specify 後] clarifications > 0 → pending-clarifications.json 保存 + awaiting-approval + exit 2
  │
  └── [gate check] config.gates["after-$STEP"] + !auto_approve → awaiting-approval + exit 2
```

### 1-4. 終了フロー (L1024–1033)

```
--next モード: 1ステップ完了後 exit 0 (pipeline_complete は出さない)
通常モード:
  pipeline-state.sh set-status "completed"
  {"status":"pipeline_complete"} を出力して exit 0
```

---

## 2. dispatch_implement_phases — フェーズ分割ディスパッチ

### 2-1. フェーズ検出フロー (L386–402)

```
parse_tasks_phases(tasks.md) で "## Phase N: Title" を正規表現マッチ
フェーズが存在しない → return 1 (caller が fallback 単一ディスパッチへ)
フェーズ数を出力してフェーズループへ
```

### 2-2. フェーズループ (L410–560)

```
for each phase (phase_num, phase_name, start_line, end_line):
  ├── resume チェック: pipeline-state.json .implement_phases_completed に phase_key あり
  │   └── "skipped (already completed)" を出力して continue
  │
  ├── Phase Scope Directive コンテキストファイル作成 (/tmp/poor-dev-phase-scope-N-$$.txt)
  ├── Pipeline メタデータコンテキスト作成 (/tmp/poor-dev-pipeline-ctx-implement-phaseN-$$.txt)
  ├── compose-prompt.sh でプロンプト生成
  │
  ├── pre_phase_head = git rev-parse HEAD (フェーズ開始時点のコミット記録)
  │
  ├── _impl_phase_pre_retry 関数定義:
  │   ├── git checkout -- .     ← 追跡ファイルを HEAD に戻す
  │   └── git clean -fd --exclude='specs/'  ← 未追跡ファイルを削除
  │
  ├── dispatch_with_retry("implement", ..., pre_hook="_impl_phase_pre_retry")
  │   ├── 失敗 → check_rate_limit → rate-limited (exit 3) or error (exit 1)
  │   └── 成功
  │
  ├── protect_sources($project_dir) ← tooling ファイル保護
  │
  ├── 生成ファイル検出:
  │   ├── git diff --name-only $pre_phase_head HEAD (コミット済み差分)
  │   └── git diff --name-only (未コミット差分: staged + unstaged)
  │   → protected dirs を除外してフィルタリング
  │
  ├── フェーズ成果物コミット (phase_files 非空の場合):
  │   ├── git add -A
  │   ├── git reset HEAD -- agents/ commands/ lib/ .poor-dev/ .opencode/ .claude/
  │   └── git commit -m "implement: phase N - name" --no-verify
  │       └── コミット失敗 → warning 出力、ファイルは未コミットのまま残る
  │
  └── update_implement_phase_state($STATE_FILE, "phase_N")
      └── .implement_phases_completed に phase_key を追加 (jq で直接書き込み)
```

---

## 3. retry-helpers.sh — リトライロジック

### 3-1. dispatch_with_retry フロー

```
設定読み込み (CONFIG_FILE から):
  retry.enabled     : true/false (デフォルト true)
  retry.max_retries : 0-10 (デフォルト 2)
  retry.backoff_seconds : 5-300 (デフォルト 30)
  max_retries_override : 引数で上書き可能 (review-runner は 1 を渡す)

total_attempts = max_retries + 1

ループ (attempt 1..total_attempts):
  ├── attempt > 1 の場合のみ pre_retry_hook 呼び出し
  │   └── declare -F でホック関数存在確認してから実行
  ├── result_file を削除 (クリーンな状態で開始)
  ├── dispatch-step.sh 実行
  │
  ├── 成功 (exit 0) → return 0
  ├── attempts 尽きた → return dispatch_exit
  ├── result_file なし → 永続エラー (バリデーション失敗) → return dispatch_exit (no retry)
  └── 失敗 + retry 残り:
      ├── backoff = backoff_seconds * 2^(attempt-1)  (指数バックオフ)
      ├── rate limit 検出: backoff *= 2, minimum 60s
      ├── retry イベント出力 (JSONL)
      ├── log_retry_attempt → pipeline-state.json .retries[] 追記
      └── sleep $backoff
```

### 3-2. バックオフ計算

| attempt | backoff (backoff_seconds=30) | rate-limit 時 |
|---------|------------------------------|---------------|
| 1 (失敗) | 30 × 1 = 30s               | 60s (min)     |
| 2 (失敗) | 30 × 2 = 60s               | 120s          |
| 3 (失敗) | (total_attempts超過)         | -             |

### 3-3. log_retry_attempt のガード

```bash
# review-runner サブシェルでは STATE_FILE が未設定 → スキップ
if [[ -z "${STATE_FILE:-}" || ! -f "${STATE_FILE:-}" ]]; then
  return 0
fi
```

**重要**: pipeline-runner.sh は STATE_FILE を export していない。
review-runner.sh を `bash script.sh` で起動するとサブプロセスは STATE_FILE を継承しない。
したがって review-runner 内での dispatch_with_retry リトライは pipeline-state.json の .retries に記録されない。これは意図された設計 (コメントに明記)。

---

## 4. review-runner.sh — レビューループ

### 4-1. 初期化 (L59–75)

```
review-setup.sh 呼び出し → SETUP JSON 取得:
  MAX_ITER    : 最大イテレーション数
  NEXT_ID     : 次の issue ID
  LOG_PATH    : review-log-{type}.yaml のパス
  ID_PREFIX   : issue ID プレフィックス
  DEPTH       : レビュー深度
  personas[]  : {name, cli, model}
  fixer.agent_name : fixer agent 名
```

### 4-2. メインループ (L84–333)

```
while ITER < MAX_ITER:
  ITER++

  [Step 1: ペルソナ並列ディスパッチ]
  OUTPUT_DIR = mktemp /tmp/review-personas-$$.XXXXXX
  for each persona in SETUP.personas:
    ├── コマンドファイル解決 (variant 優先)
    ├── エージェントファイル解決 (agents/{opencode,claude}/, .{opencode,claude}/agents/)
    ├── compose-prompt.sh でプロンプト生成
    └── background (&) で dispatch_with_retry(persona, max_retries=1):
        ├── 成功 → output ファイルを OUTPUT_DIR にコピー
        └── 失敗 → FAILED_COUNT++

  wait for all PIDs

  ALL_FAILED (FAILED_COUNT == PERSONA数 > 0) → exit 3 (rate limit)

  [Step 2: Aggregate]
  review-aggregate.sh → TOTAL, COUNT_C, COUNT_H, NEXT_ID, ISSUES_FILE, CONVERGED, VERDICTS

  [Step 3: ログ更新]
  review-log-update.sh → LOG_PATH 更新 (FIXED_IDS を渡して前回の修正を記録)
  FIXED_IDS = "" にリセット

  [Step 4: 収束チェック]
  CONVERGED == true → verdict=GO, break
  ITER >= MAX_ITER (最終イテレーション):
    COUNT_C > 0 → verdict=NO-GO
    COUNT_C == 0 → verdict=CONDITIONAL
    break

  [Step 5: Fixer ディスパッチ (収束しなかった場合)]
  fixer コマンド/エージェントファイル解決
  compose-prompt.sh → FIX_PROMPT_FILE
  dispatch_with_retry("fixer", max_retries=1) → FIX_RESULT_FILE
  FIXED_IDS = ISSUES_FILE から全 issue ID 収集
  rm -rf OUTPUT_DIR
```

### 4-3. 終了コード

| verdict    | exit code |
|------------|-----------|
| GO         | 0         |
| CONDITIONAL| 0         |
| NO-GO      | 2         |
| all-failed | 3         |
| error      | 1         |

---

## 5. pipeline-state.sh — 状態管理

### 5-1. pipeline-state.json スキーマ

```json
{
  "flow": "feature",
  "variant": null,
  "pipeline": ["specify", "suggest", "plan", ...],
  "completed": ["specify", "suggest"],
  "current": "plan",
  "status": "active",
  "pauseReason": null,
  "condition": null,
  "pendingApproval": null,
  "implement_phases_completed": ["phase_1", "phase_2"],
  "retries": [
    {"step": "specify", "attempt": 1, "exit_code": 124, "backoff": 30, "ts": "2026-02-19T..."}
  ],
  "updated": "2026-02-19T12:00:00Z"
}
```

**注意**: `implement_phases_completed` と `retries` は pipeline-state.sh のサブコマンドではなく、
それぞれ `update_implement_phase_state()` (pipeline-runner.sh L372-382) と
`log_retry_attempt()` (retry-helpers.sh L163-186) が直接 jq で書き込む。

### 5-2. サブコマンド一覧

| サブコマンド | 書き込みフィールド | 用途 |
|---|---|---|
| `init` | 全フィールド初期化 | パイプライン開始時 |
| `complete-step` | completed[], current | ステップ完了時 |
| `set-status` | status, pauseReason | 一時停止・完了・rate-limit |
| `set-variant` | variant, condition | bugfix/rebuildcheck 分岐時 |
| `set-approval` | status, pauseReason, pendingApproval | 承認待ち状態 |
| `clear-approval` | status, pendingApproval, pauseReason | resume 時の承認解除 |
| `set-pipeline` | pipeline, current | 動的パイプライン変更 |

### 5-3. complete-step の current 計算ロジック

```jq
# pipeline[] の中で、completed に含まれないもの最初の1件 → current
([ $pipe[] | select(. as $s | ($root.completed | index($s)) == null) ] | .[0] // null) as $next
```

---

## 6. 副作用マップ

### 6-1. git 操作

| 場所 | コード | 操作 | タイミング | リスク |
|---|---|---|---|---|
| `protect_sources()` | L312 | `git checkout HEAD -- $files` | implement 後 / 各フェーズ後 | tooling ファイル復元 |
| `_impl_phase_pre_retry()` | L489 | `git checkout -- .` | フェーズリトライ時 (attempt>1) | 未コミット変更を全て破棄 |
| `_impl_phase_pre_retry()` | L490 | `git clean -fd --exclude='specs/'` | フェーズリトライ時 (attempt>1) | 未追跡ファイルを全て削除 ★危険 |
| `_main_impl_pre_retry()` | L801 | `git checkout -- .` | 単一dispatch リトライ時 | 同上 |
| `_main_impl_pre_retry()` | L802 | `git clean -fd --exclude='specs/'` | 単一dispatch リトライ時 | 同上 ★危険 |
| `dispatch_implement_phases()` | L549 | `git add -A` | フェーズ完了時 | 意図しないファイルをステージ可能性 |
| `dispatch_implement_phases()` | L550 | `git reset HEAD -- agents/ commands/ lib/ .poor-dev/ .opencode/ .claude/` | フェーズ完了時 | tooling ファイルをアンステージ |
| `dispatch_implement_phases()` | L551 | `git commit --no-verify` | フェーズ完了時 | フェーズ中間コミット |

### 6-2. ファイル削除

| 場所 | コード | 削除対象 | タイミング | リスク |
|---|---|---|---|---|
| `validate_no_impl_files()` | L334 | `rm -f $found_files` | 非implementステップ後 (IMPLEMENT_COMPLETED=false) | 実装ファイルを削除 ★危険 |
| `validate_no_impl_files()` | L334 | `rm -f $found_files` | implement 開始前 (phases未完了時) | 同上 ★危険 |
| `cleanup_temp_files()` | L29-32 | `/tmp/poor-dev-result-*-$$.json` 等 | EXIT trap | 一時ファイル削除 |
| `dispatch_implement_phases()` | L505, 524 | prompt, phase_ctx, pipeline_ctx, result | フェーズ完了/失敗時 | 一時ファイル削除 |
| `review-runner.sh` | L332 | `rm -rf $OUTPUT_DIR` | 各イテレーション後 | ペルソナ出力削除 |

### 6-3. 状態ファイル書き込み

| 場所 | 書き込み先 | 操作 |
|---|---|---|
| `pipeline-state.sh` (各サブコマンド) | `$FD/pipeline-state.json` | jq で整形して上書き |
| `update_implement_phase_state()` | `$FD/pipeline-state.json` | `.implement_phases_completed` 追記 |
| `log_retry_attempt()` | `$FD/pipeline-state.json` | `.retries[]` 追記 |
| `pipeline-runner.sh L994-995` | `$FD/pending-clarifications.json` | tmp→本ファイルへ atomic move |
| `review-log-update.sh` | `$FD/review-log-{type}.yaml` | レビューログ更新 |

---

## 7. pipeline-state.json 状態遷移図

```
                     init()
                       │
                       ▼
                   ┌──────┐
              ┌───▶│active│◀──────────── clear-approval()
              │    └──────┘
              │       │
              │    complete-step() × N (全ステップ分)
              │       │
              │       ▼
              │    set-status("completed")
              │    ┌─────────┐
              │    │completed│ (terminal)
              │    └─────────┘
              │
              │    set-approval("clarification" | "gate")
              │    ┌──────────────────┐
              │    │awaiting-approval │◀──── specify 後 clarifications > 0
              │    └──────────────────┘      gate config 設定時
              │           │
              └───────────┘  (resume 時 clear-approval)
              │
              │    set-status("paused")
              │    ┌────────┐
              │    │ paused │ (terminal — 手動 resume が必要)
              │    └────────┘
              │           via: NO-GO verdict / RECLASSIFY / rebuildcheck CONTINUE
              │
              │    set-status("rate-limited")
              │    ┌──────────────┐
              │    │ rate-limited │ (terminal — リトライ後 resume)
              │    └──────────────┘

implement_phases_completed (parallel tracking):
  active 中に update_implement_phase_state() で phase_key を追記
  ["phase_1"] → ["phase_1", "phase_2"] → ... (フェーズ完了ごと)
```

---

## 8. 既知バグパターンと修正済みガード

### Bug 1: `_impl_phase_pre_retry` が前フェーズ成果物を破壊 (e01a084)

**根本原因**:
- フェーズ N-1 の `git commit` が失敗した場合 (L551-553)、成果物が未追跡ファイルとして残る
- フェーズ N のリトライ時に `_impl_phase_pre_retry` が `git clean -fd` を実行
- 未追跡ファイル (前フェーズ成果物) が全て削除される

**現在の状態**: コミット失敗時の warning は出力されるが、根本的な対処なし。
コミット失敗ケースは稀だが、対処が必要。

**TS 移植時の注意点**:
- git commit が失敗した場合のリカバリ戦略を明示的に実装
- pre-retry hook の実行前に、前フェーズのコミット状態を検証

### Bug 2: `validate_no_impl_files` が implement 再入時に成果物削除 (eccb536)

**根本原因**:
- `--next` で implement ステップに再入した際、`_impl_completed` が空なら `validate_no_impl_files` が実行される
- implement_phases_completed に既存フェーズが記録されていても、新しいセッションではローカル変数 `_impl_completed` で判断

**修正済みガード** (L641-649):
```bash
_impl_completed=""
if [[ -f "$STATE_FILE" ]]; then
  _impl_completed=$(jq -r '.implement_phases_completed[]?' "$STATE_FILE" 2>/dev/null || true)
fi
if [[ -z "$_impl_completed" ]]; then
  IMPL_CLEANUP=$(validate_no_impl_files "$FD" "pre-implement")
fi
```
→ `implement_phases_completed` が空でない場合はスキップ。

**TS 移植時の注意点**:
- このガードロジックをテストケースとして移植必須
- `validate_no_impl_files` の呼び出し条件を明示的に型で表現

### Bug 3 (潜在): 後続レビューが implement 成果物を削除する

**パターン**:
- `IMPLEMENT_COMPLETED` は インメモリフラグ
- resume 時は COMPLETED_SET["implement"] から復元 (L138)
- しかし resume 後の最初のステップ実行時に L972 の条件判定が行われる

**チェック** (L972):
```bash
if [[ "$STEP" != "implement" ]] && [[ "$IMPLEMENT_COMPLETED" != "true" ]]; then
  IMPL_CLEANUP=$(validate_no_impl_files "$FD" "$STEP")
fi
```

`COMPLETED_SET["implement"]` から `IMPLEMENT_COMPLETED=true` が設定されるため、
resume 後も保護される (L137-138)。現状は問題なし。

**TS 移植時の注意点**:
- `implementCompleted` を状態として明示的に管理 (不変オブジェクトを推奨)

---

## 9. コンポーネント間依存関係

```
pipeline-runner.sh
  ├── sources: retry-helpers.sh
  │     └── calls: dispatch-step.sh
  ├── calls: pipeline-state.sh (subcommand)
  ├── calls: review-runner.sh (bash subshell)
  │     ├── sources: utils.sh
  │     ├── sources: retry-helpers.sh
  │     │     └── calls: dispatch-step.sh (parallel per persona)
  │     ├── calls: review-setup.sh
  │     ├── calls: review-aggregate.sh
  │     └── calls: review-log-update.sh
  ├── calls: compose-prompt.sh
  ├── calls: extract-output.sh (specify/suggest/plan/tasks)
  ├── calls: tasks-validate.sh (tasks ステップ後)
  └── direct jq write: pipeline-state.json (implement_phases_completed)
```

### 環境変数の伝播

| 変数 | pipeline-runner | review-runner | retry-helpers | 備考 |
|---|---|---|---|---|
| `CONFIG_FILE` | 設定・使用 | 読み取り (read_config経由) | 読み取り (${CONFIG_FILE:-}) | review-runner は exported 不要 (read_config で別途読む) |
| `STATE_FILE` | 設定 (未export) | **未設定** | ${STATE_FILE:-} ガード | review-runner 内 log_retry_attempt は no-op |
| `IMPLEMENT_COMPLETED` | インメモリフラグ | N/A | N/A | サブシェルに渡らない |
| `COMPLETED_SET` | 連想配列 | N/A | N/A | サブシェルに渡らない |

---

## 移植優先度マトリクス

| 機能 | 複雑度 | テスト必要性 | 副作用 | 移植優先度 |
|---|---|---|---|---|
| pipeline-state.sh CRUD | 低 | 高 (状態が全てに影響) | 状態ファイル書き込み | **最優先** |
| dispatch_with_retry | 中 | 高 (リトライ条件が重要) | sleep, STATE_FILE 書き込み | **高** |
| validate_no_impl_files | 低 | **最高** (バグ再発防止) | rm -f | **高** |
| dispatch_implement_phases | 高 | 高 | git 操作複数 | **高** |
| main dispatch loop | 高 | 中 | 間接的 | 中 |
| review-runner.sh loop | 高 | 中 | OUTPUT_DIR, retry | 中 |
| protect_sources | 低 | 中 | git checkout | 低 |

---

*このドキュメントは読み取り専用調査の結果です。コードの変更は含みません。*

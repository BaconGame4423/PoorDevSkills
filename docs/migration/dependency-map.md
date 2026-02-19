# lib/ Bash スクリプト 依存関係・インターフェースマップ

生成日: 2026-02-19
対象: `/home/bacon/DevSkills/lib/*.sh` 全20ファイル・4,038行

---

## 目次

1. [ファイル一覧と役割](#1-ファイル一覧と役割)
2. [source 依存グラフ](#2-source-依存グラフ)
3. [呼び出しグラフ (Call Graph)](#3-呼び出しグラフ)
4. [公開関数一覧](#4-公開関数一覧)
5. [外部コマンド依存](#5-外部コマンド依存)
6. [グローバル変数・環境変数マップ](#6-グローバル変数環境変数マップ)
7. [ファイルシステム操作マップ](#7-ファイルシステム操作マップ)
8. [Git 操作マップ (副作用)](#8-git-操作マップ-副作用)
9. [移植優先度マトリクス](#9-移植優先度マトリクス)

---

## 1. ファイル一覧と役割

| ファイル | 行数 | 役割 | 種別 |
|---|---|---|---|
| `pipeline-runner.sh` | 1,033 | パイプライン全ステップ逐次実行オーケストレーター | Entry/Orchestrator |
| `review-runner.sh` | 346 | レビューループ (ペルソナ並列→集約→修正) ドライバー | Orchestrator |
| `intake.sh` | 122 | ユーザー入力受付・ブランチ作成・パイプライン起動 | Entry |
| `intake-and-specify.sh` | 226 | intake + specify を同期実行する複合エントリ | Entry |
| `resume-pipeline.sh` | 89 | 承認後のパイプライン再開 | Entry |
| `pipeline-state.sh` | 173 | pipeline-state.json の CRUD サブコマンド集 | State Manager |
| `branch-setup.sh` | 86 | 連番ブランチ・specs/ ディレクトリ作成 | Utility |
| `apply-clarifications.sh` | 77 | pending-clarifications.json → spec.md 追記 | Utility |
| `config-resolver.sh` | 66 | 5段階 CLI/model 解決チェーン | Utility |
| `config.sh` | 463 | .poor-dev/config.json 管理 CLI | Utility |
| `utils.sh` | 63 | 共通ユーティリティ (JSON ヘルパー等) | Library |
| `retry-helpers.sh` | 187 | dispatch_with_retry + log_retry_attempt | Library |
| `dispatch-step.sh` | 91 | config-resolver → コマンドファイル生成 → poll-dispatch 実行 | Library |
| `poll-dispatch.sh` | 189 | プロセス起動・ポーリング・タイムアウト・JSON サマリー生成 | Library |
| `compose-prompt.sh` | 139 | コマンドテンプレート + context → プロンプトファイル生成 | Library |
| `extract-output.sh` | 59 | opencode JSON / plaintext → アーティファクトファイル抽出 | Library |
| `review-setup.sh` | 183 | レビューセッション初期化 (ペルソナ解決・深度計算) | Library |
| `review-aggregate.sh` | 183 | ペルソナ出力集約・重複排除・issues ファイル生成 | Library |
| `review-log-update.sh` | 91 | review-log.yaml にイテレーションブロック追記 | Library |
| `tasks-validate.sh` | 187 | tasks.md フォーマット・依存関係検証 | Library |

---

## 2. source 依存グラフ

`source` (`. `) でインポートされる依存のみを示す。

```
utils.sh                    ← 依存なし (最下層ライブラリ)
retry-helpers.sh            ← 依存なし (dispatch-step.sh を bash で呼ぶ)

pipeline-runner.sh          → source retry-helpers.sh
review-runner.sh            → source utils.sh
                            → source retry-helpers.sh
review-setup.sh             → source utils.sh
review-aggregate.sh         → source utils.sh
review-log-update.sh        → source utils.sh
extract-output.sh           → source utils.sh
tasks-validate.sh           → source utils.sh
intake-and-specify.sh       → source utils.sh
resume-pipeline.sh          → source utils.sh

# source なし (スタンドアロン)
intake.sh
pipeline-state.sh
branch-setup.sh
apply-clarifications.sh
config-resolver.sh
config.sh
dispatch-step.sh
poll-dispatch.sh
compose-prompt.sh
```

---

## 3. 呼び出しグラフ

`bash <script>` による子プロセス呼び出しを示す。`(bg)` = バックグラウンド (nohup)。

```
intake.sh
  → branch-setup.sh
  → pipeline-runner.sh  (bg: nohup)

intake-and-specify.sh
  → intake.sh  (--setup-only)
  → pipeline-state.sh  (init, complete-step, set-status)
  → compose-prompt.sh
  → dispatch-step.sh
  → extract-output.sh

resume-pipeline.sh
  → pipeline-state.sh  (clear-approval)
  → pipeline-runner.sh  (bg: nohup)

apply-clarifications.sh
  → pipeline-state.sh  (clear-approval)

pipeline-runner.sh
  ├── pipeline-state.sh  (init, complete-step, set-status, set-variant, set-pipeline, set-approval, clear-approval)
  ├── compose-prompt.sh
  ├── retry-helpers.sh [sourced]
  │     └── dispatch-step.sh
  │           ├── config-resolver.sh
  │           └── poll-dispatch.sh
  ├── review-runner.sh  (review_mode=bash の場合)
  ├── extract-output.sh
  └── tasks-validate.sh

review-runner.sh
  ├── review-setup.sh
  │     └── config-resolver.sh
  ├── compose-prompt.sh
  ├── retry-helpers.sh [sourced]
  │     └── dispatch-step.sh
  │           ├── config-resolver.sh
  │           └── poll-dispatch.sh
  ├── review-aggregate.sh
  └── review-log-update.sh
```

---

## 4. 公開関数一覧

### utils.sh

| 関数 | 引数 | 戻り値 | 副作用 |
|---|---|---|---|
| `json_get` | `<json_str> <jq_expr>` | jq 抽出値 (stdout) | なし |
| `json_get_or` | `<json_str> <jq_expr> <default>` | 抽出値またはデフォルト (stdout) | なし |
| `die` | `<message> [exit_code]` | なし (exit) | stderr に JSON エラー出力 |
| `make_temp` | `[prefix]` | /tmp/poor-dev-{prefix}-$$.XXXXXX パス | /tmp にファイル作成、`_POOR_DEV_TEMP_FILES` に登録 |
| `cleanup_temp_files` | なし | なし | `_POOR_DEV_TEMP_FILES` 内の全ファイルを rm -f |
| `read_config` | `<project_dir>` | config.json 内容 (stdout) | なし (読み取りのみ) |

### retry-helpers.sh

| 関数 | 引数 | 戻り値 | 副作用 |
|---|---|---|---|
| `dispatch_with_retry` | `<step> <project_dir> <prompt_file> <idle_timeout> <max_timeout> <result_file> [max_retries_override] [pre_retry_hook]` | exit code (dispatch-step.sh と同一) | dispatch-step.sh を最大 max_retries+1 回実行、backoff sleep、log_retry_attempt 呼び出し |
| `log_retry_attempt` | `<step> <attempt> <exit_code> <backoff>` | なし | STATE_FILE の `.retries[]` に追記 |

**暗黙的に参照する外部シンボル:**
- `CONFIG_FILE` 環境変数 (呼び出し元スクリプトで設定必須)
- `STATE_FILE` 環境変数 (log_retry_attempt が参照; 未設定時はスキップ)
- `check_rate_limit` 関数 (pipeline-runner.sh で定義; 未定義時はスキップ)

### pipeline-runner.sh (内部関数)

| 関数 | 引数 | 戻り値 | 副作用 |
|---|---|---|---|
| `_safe_git` | `<dir> <git args...>` | git コマンド出力 | `dir/.git` が存在しない場合は警告して return 1 |
| `cleanup_temp_files` | なし | なし | /tmp/poor-dev-result/prompt/phase-scope/pipeline-ctx ファイル削除 |
| `get_pipeline_steps` | `<flow>` | スペース区切りステップ名 (stdout) | なし |
| `resolve_step_timeout` | `<step> <field> <default>` | タイムアウト値 (stdout) | なし |
| `context_args_for_step` | `<step> <fd>` | --context 引数文字列 (stdout) | なし |
| `check_prerequisites` | `<step> <fd>` | エラーメッセージ (stdout) | なし |
| `is_conditional` | `<step>` | exit 0=yes / 1=no | なし |
| `is_review` | `<step>` | exit 0=yes / 1=no | なし |
| `check_rate_limit` | なし | 数値 (stdout) | opencode ログファイルを読み取り |
| `protect_sources` | `[project_dir]` | 警告 JSON (stdout) | git checkout HEAD -- 保護ファイル (恢复) |
| `validate_no_impl_files` | `<fd> <step>` | 警告 JSON (stdout) | **実装ファイル (*.js, *.ts 等) を rm -f で削除** |
| `parse_tasks_phases` | `<tasks_file>` | TSV (phase_num, phase_name, start, end) | なし |
| `update_implement_phase_state` | `<state_file> <phase_key>` | なし | STATE_FILE の `.implement_phases_completed[]` に追記 |
| `dispatch_implement_phases` | `<fd> <project_dir> <feature_dir> <branch> <summary> <step_count> <total_steps>` | JSON events (stdout) | フェーズ毎に compose-prompt, dispatch_with_retry, git add/commit を実行 |

### review-setup.sh (内部関数)

| 関数 | 引数 | 戻り値 | 副作用 |
|---|---|---|---|
| `get_personas` | `<review_type>` | スペース区切りペルソナ名 | なし |

### pipeline-state.sh (サブコマンド)

| サブコマンド | 引数 | 戻り値 | 副作用 |
|---|---|---|---|
| `read` | `<feature_dir>` | pipeline-state.json 内容 | なし |
| `init` | `<feature_dir> <flow> <pipeline_steps_json>` | 新規 state JSON | pipeline-state.json を新規作成 |
| `complete-step` | `<feature_dir> <step>` | 更新後 state JSON | `.completed[]` に追記、`.current` を更新 |
| `set-status` | `<feature_dir> <status> [reason]` | 更新後 state JSON | `.status`, `.pauseReason` を更新 |
| `set-variant` | `<feature_dir> <variant> <condition_json>` | 更新後 state JSON | `.variant`, `.condition` を更新 |
| `set-approval` | `<feature_dir> <type> <step>` | 更新後 state JSON | `.status=awaiting-approval`, `.pendingApproval` を設定 |
| `clear-approval` | `<feature_dir>` | 更新後 state JSON | `.status=active`, `.pendingApproval=null` にリセット |
| `set-pipeline` | `<feature_dir> <pipeline_steps_json>` | 更新後 state JSON | `.pipeline` を置換、`.current` を再計算 |

### config.sh (サブコマンド)

| サブコマンド | 引数 | 副作用 |
|---|---|---|
| `show` | なし | config.json 読み取り + 表示 (opencode models 呼び出し含む) |
| `default` | `<cli> <model>` | config.json の `.default` を更新 |
| `set` | `<key> <cli> <model>` | config.json の `.overrides[key]` を設定 |
| `unset` | `<key>` | config.json の `.overrides[key]` を削除 |
| `tier` | `<name> <cli> <model>` | config.json の `.tiers[name]` を設定 |
| `tier-unset` | `<name>` | config.json の `.tiers[name]` を削除 |
| `step-tier` | `<step> <tier>` | config.json の `.step_tiers[step]` を設定 |
| `step-tier-unset` | `<step>` | config.json の `.step_tiers[step]` を削除 |
| `depth` | `<auto\|deep\|standard\|light>` | config.json の `.review_depth` を設定 |
| `speculation` | `<on\|off>` | config.json の `.speculation.enabled` を設定 |
| `parallel` | `<on\|off\|auto\|same-branch\|worktree\|phase-split>` | config.json の `.parallel` を更新 |
| `reset` | なし | config.json をデフォルト値で上書き |

---

## 5. 外部コマンド依存

| コマンド | 必須/任意 | 使用ファイル | 用途 |
|---|---|---|---|
| `jq` | **必須** | ほぼ全ファイル | JSON 処理 |
| `git` | **必須** | branch-setup.sh, intake-and-specify.sh, resume-pipeline.sh, pipeline-runner.sh, review-setup.sh | ブランチ操作・diff・checkout・commit |
| `opencode` | 必須 (CLI設定次第) | dispatch-step.sh (CLI=opencode の場合) | LLM ディスパッチ |
| `claude` | 必須 (CLI設定次第) | dispatch-step.sh (CLI=claude の場合) | LLM ディスパッチ |
| `nohup` | **必須** | intake.sh, resume-pipeline.sh | バックグラウンドプロセス起動 |
| `inotifywait` | 任意 | poll-dispatch.sh | イベント駆動ファイル監視 (なければ sleep 1 にフォールバック) |
| `find` | **必須** | pipeline-runner.sh, review-runner.sh, review-setup.sh | 実装ファイル列挙・深度計算 |
| `sed` | **必須** | review-log-update.sh (sed -i), compose-prompt.sh, intake.sh | テキスト処理 |
| `awk` | **必須** | compose-prompt.sh (YAML frontmatter除去), intake.sh (short-name生成) | テキスト処理 |
| `mktemp` | **必須** | review-aggregate.sh, utils.sh | 一時ファイル作成 |
| `date` | **必須** | pipeline-state.sh, retry-helpers.sh, review-log-update.sh, apply-clarifications.sh | タイムスタンプ |
| `wc` | **必須** | poll-dispatch.sh (出力バイト数), compose-prompt.sh (ファイルサイズ判定) | ファイルサイズ計測 |
| `grep` | **必須** | poll-dispatch.sh, pipeline-runner.sh 他 | テキスト検索 |
| `head` | **必須** | compose-prompt.sh (10KB 超ファイル切り捨て), 各所 | ファイル切り捨て |
| `ls` | **必須** | pipeline-runner.sh, dispatch-step.sh 他 | /tmp ファイル一覧取得 |
| `cp` | **必須** | intake.sh, review-aggregate.sh 他 | ファイルコピー |
| `mv` | **必須** | pipeline-runner.sh (pending-clarifications.json のアトミック書き込み) | ファイル移動 |
| `kill` | **必須** | poll-dispatch.sh | プロセス制御 |
| `wait` | **必須** | poll-dispatch.sh, review-runner.sh | プロセス待機 |

---

## 6. グローバル変数・環境変数マップ

### 環境変数 (プロセス間で受け渡し)

| 変数名 | 設定元 | 読み取り先 | 用途 |
|---|---|---|---|
| `CONFIG_FILE` | pipeline-runner.sh (グローバル変数として設定) | retry-helpers.sh (`dispatch_with_retry`) | retry 設定の読み取り |
| `STATE_FILE` | pipeline-runner.sh (グローバル変数として設定) | retry-helpers.sh (`log_retry_attempt`) | リトライ記録の追記 |
| `HOME` | OS | pipeline-runner.sh (`check_rate_limit`), intake-and-specify.sh | opencode ログディレクトリのパス解決 |
| `CLAUDECODE` | OS (claude CLI が設定) | poll-dispatch.sh (env -u で除去), dispatch-step.sh (env -u で除去) | claude CLI の再帰防止 |

### 主要グローバル変数 (pipeline-runner.sh)

| 変数名 | 型 | 役割 |
|---|---|---|
| `FLOW` | string | パイプラインフロー種別 (feature/bugfix/roadmap 等) |
| `FEATURE_DIR` | string | specs/NNN-name 形式のfeature ディレクトリ相対パス |
| `BRANCH` | string | git ブランチ名 |
| `PROJECT_DIR` | string | プロジェクトルートの絶対パス |
| `FD` | string | `$PROJECT_DIR/$FEATURE_DIR` の絶対パス |
| `COMPLETED_SET` | 連想配列 | 完了済みステップのセット (ステップ名 → 1) |
| `STATE_FILE` | string | pipeline-state.json の絶対パス |
| `IMPLEMENT_COMPLETED` | bool | implement ステップ完了フラグ (非implementステップの validate_no_impl_files スキップ制御) |
| `CONFIG_FILE` | string | .poor-dev/config.json の絶対パス (retry-helpers.sh でも参照) |
| `IDLE_TIMEOUT` | int | デフォルト idle timeout (秒) |
| `MAX_TIMEOUT` | int | デフォルト max timeout (秒) |
| `PIPELINE_STEPS` | string | スペース区切りのステップ名列 |
| `NEXT_MODE` | bool | --next フラグ (1ステップのみ実行) |

---

## 7. ファイルシステム操作マップ

### 書き込みファイル

| ファイルパス | 書き込みスクリプト | 操作 | 内容 |
|---|---|---|---|
| `$FD/pipeline-state.json` | pipeline-state.sh (全サブコマンド) | 新規作成・上書き | パイプライン状態 JSON |
| `$FD/spec.md` | extract-output.sh, intake-and-specify.sh | 新規作成・上書き | 仕様書 (specify 出力) |
| `$FD/suggestions.yaml` | extract-output.sh (via pipeline-runner.sh) | 新規作成・上書き | 技術提案 (suggest 出力) |
| `$FD/plan.md` | extract-output.sh (via pipeline-runner.sh) | 新規作成・上書き | 実装計画 (plan 出力) |
| `$FD/tasks.md` | extract-output.sh (via pipeline-runner.sh) | 新規作成・上書き | タスクリスト (tasks 出力) |
| `$FD/input.txt` | intake.sh, intake-and-specify.sh | 新規作成 | ユーザー入力テキスト |
| `$FD/pending-clarifications.json` | pipeline-runner.sh | アトミック書き込み (tmp→mv) | 未解決の clarification リスト |
| `$FD/pipeline.log` | intake.sh, resume-pipeline.sh | nohup 出力先 | pipeline-runner.sh の標準出力 |
| `$FD/pipeline.pid` | intake.sh, resume-pipeline.sh | 新規作成 | pipeline-runner.sh の PID |
| `$FD/review-log-{type}.yaml` | review-setup.sh (init), review-log-update.sh (append) | 新規作成・追記 | レビューイテレーションログ |
| `$FD/review-issues-{type}.txt` | review-aggregate.sh | 上書き | パイプ区切り課題リスト |
| `$FD/review-issues-latest.txt` | review-aggregate.sh | 上書き | 最新レビュー課題のコピー |
| `$PROJECT_DIR/.poor-dev/config.json` | config.sh | 新規作成・上書き | CLI/モデル設定 |
| `/tmp/poor-dev-cmd-{step}-$$.sh` | dispatch-step.sh | 新規作成 | ディスパッチコマンドファイル |
| `/tmp/poor-dev-output-{step}-$$.txt` | dispatch-step.sh (poll-dispatch.sh 経由) | 新規作成 | LLM 出力ファイル |
| `/tmp/poor-dev-result-{step}-$$.json` | poll-dispatch.sh | 新規作成 | ディスパッチ結果 JSON |
| `/tmp/poor-dev-prompt-{step}-$$.txt` | compose-prompt.sh | 新規作成 | 合成プロンプトファイル |
| `/tmp/poor-dev-phase-scope-{N}-$$.txt` | pipeline-runner.sh (dispatch_implement_phases) | 新規作成 | Phase Scope Directive |
| `/tmp/poor-dev-pipeline-ctx-{step}-$$.txt` | pipeline-runner.sh | 新規作成 | パイプラインメタデータ |
| `/tmp/poor-dev-issues-$$.XXXXXX` | review-aggregate.sh | 新規作成・削除 | 課題リスト (一時) |

### 削除ファイル (副作用)

| 対象 | 削除スクリプト・関数 | 条件 | 危険度 |
|---|---|---|---|
| `$FD/*.{html,js,ts,css,py,...}` (実装ファイル) | `validate_no_impl_files()` (pipeline-runner.sh:322-339) | implement 以外のステップが実装ファイルを生成した場合 | **高** (意図しない削除リスク) |
| `/tmp/poor-dev-result-*-$$.json` 等 | `cleanup_temp_files` trap (pipeline-runner.sh:28-34) | EXIT/INT/TERM シグナル | 低 |
| `/tmp/poor-dev-cmd-{step}-$$.sh` | dispatch-step.sh:88 | 常時 (実行後) | 低 |
| `/tmp/review-personas-$$.XXXXXX/` (ディレクトリ) | review-runner.sh (rm -rf) | 各イテレーション後、全ペルソナ出力ディレクトリ | 低 |
| `$FD/pending-clarifications.json` | apply-clarifications.sh:66 | clarification 適用後 | 低 |

---

## 8. Git 操作マップ (副作用)

| 操作 | コマンド | 実行箇所 | 条件・用途 | 危険度 |
|---|---|---|---|---|
| フェッチ | `git fetch --all --prune` | branch-setup.sh:19 | 常時 | 低 |
| ブランチ作成 | `git checkout -b {branch}` | branch-setup.sh:72 | 新規ブランチ作成 | 低 |
| 未ステージ変更破棄 | `git checkout -- .` | `_impl_phase_pre_retry()` (pipeline-runner.sh:489), `_main_impl_pre_retry()` (pipeline-runner.sh:801) | implement リトライ時 | **高** (未コミット変更が消える) |
| 未追跡ファイル削除 | `git clean -fd --exclude='specs/'` | `_impl_phase_pre_retry()` (pipeline-runner.sh:490) | implement リトライ時 | **高** (未追跡ファイルが消える) |
| ステージング | `git add -A` | dispatch_implement_phases (pipeline-runner.sh:549) | フェーズ完了後コミット前 | 中 |
| ステージング除外 | `git reset HEAD -- agents/ commands/ lib/ ...` | dispatch_implement_phases (pipeline-runner.sh:550) | 保護ディレクトリを除外 | 中 |
| コミット | `git commit -m "implement: phase N - name" --no-verify` | dispatch_implement_phases (pipeline-runner.sh:551) | フェーズ完了後 | 中 |
| 保護ファイル恢复 | `git checkout HEAD -- {files}` | `protect_sources()` (pipeline-runner.sh:312) | implement 後に保護ファイルが変更されていた場合 | 中 |
| diff 取得 | `git diff --name-only HEAD` など | `protect_sources()`, dispatch_implement_phases, review-setup.sh | 変更ファイル検出・深度計算 | 低 |
| HEAD 取得 | `git rev-parse HEAD` | dispatch_implement_phases (pipeline-runner.sh:485) | pre-phase HEAD 記録 | 低 |
| ブランチ取得 | `git rev-parse --abbrev-ref HEAD` | intake-and-specify.sh:66, resume-pipeline.sh:52 | 現在ブランチ確認 | 低 |
| ブランチ一覧 | `git branch -r`, `git branch` | branch-setup.sh:32,41 | 連番の最大値算出 | 低 |
| diff 統計 | `git diff --stat HEAD` | review-setup.sh:112 | レビュー深度計算 | 低 |

---

## 9. 移植優先度マトリクス

[MEMORY.md の方針](../../memory/ts-migration-priority.md) に基づく優先度評価。

### P1 (最高優先): 副作用バグ再発リスクが高いコア

| ファイル | 移植優先理由 | 主要な副作用 |
|---|---|---|
| `pipeline-runner.sh` | 1,033行の最大ファイル。git clean/checkout/commit を含む高危険度副作用。フェーズ分割+リトライの相互作用バグが過去に2回再発 | git checkout --, git clean -fd, rm -f (実装ファイル削除), git add/commit |
| `retry-helpers.sh` | pipeline-runner.sh から source で使用。STATE_FILE・CONFIG_FILE の暗黙参照が TS では型で明示可能 | STATE_FILE への retries 追記 |
| `pipeline-state.sh` | 全スクリプトが呼び出す状態管理の中心。jq による JSON 読み書きがテストしにくい | pipeline-state.json の全 CRUD |

### P2 (高優先): レビューループ

| ファイル | 移植優先理由 | 主要な副作用 |
|---|---|---|
| `review-runner.sh` | 並列ペルソナ dispatch + 収束判定。exit code 0/2/3 の意味が複雑 | /tmp ディレクトリの並列書き込み・削除 |
| `review-setup.sh` | 深度計算の git diff 依存。ペルソナ解決ロジック | review-log-*.yaml の新規作成 |
| `review-aggregate.sh` | 重複排除ロジックが脆弱 (location ベース比較は未実装) | review-issues-*.txt の上書き |
| `review-log-update.sh` | sed -i によるインプレース編集 | review-log.yaml への追記 |

### P3 (中優先): エントリポイント

| ファイル | 移植優先理由 |
|---|---|
| `intake.sh` | nohup バックグラウンド起動パターンを TS で置換可能 |
| `intake-and-specify.sh` | 複合操作。テストで各ステップを個別検証可能にする |
| `resume-pipeline.sh` | pipeline-runner.sh の TS 移植完了後に移植 |

### P4 (低優先): ユーティリティ

| ファイル | 移植優先理由 |
|---|---|
| `dispatch-step.sh` | poll-dispatch.sh との境界が重要。TS では子プロセス管理に child_process を使用 |
| `poll-dispatch.sh` | inotifywait 依存・プロセス管理。Node.js の `spawn` + `fs.watch` に置換可能 |
| `compose-prompt.sh` | 純粋な文字列結合。テストが書きやすい |
| `extract-output.sh` | 単純な変換ロジック |
| `config-resolver.sh` | 純粋関数。jq を TS の JSON アクセスに置換するだけ |
| `branch-setup.sh` | git 操作。simple-git 等のライブラリ使用推奨 |
| `apply-clarifications.sh` | 単純なファイル操作 |
| `tasks-validate.sh` | 純粋な検証ロジック |
| `config.sh` | 管理 CLI。優先度低 |

---

## 補足: 状態遷移における副作用の相互作用 (要注意箇所)

### 副作用マップ: `validate_no_impl_files` (pipeline-runner.sh:322-339)

```
呼び出し条件:
  1. implement ステップ「前」(pre-implement): _impl_completed が空の場合のみ
  2. implement 以外のステップ完了後: IMPLEMENT_COMPLETED=false の間のみ

副作用: $FD/*.{html,js,ts,...} を無条件 rm -f

危険パターン:
  - implement の phase-split が途中で失敗し、一部フェーズがコミット済みの場合、
    次ステップ (architecturereview等) での呼び出しが前フェーズ成果物を削除する可能性がある
  - 修正: implement_phases_completed を参照してガード (eccb536 で対応済み)
```

### 副作用マップ: `_impl_phase_pre_retry` (pipeline-runner.sh:488-491)

```
実行条件: dispatch_with_retry の pre_retry_hook として、リトライ時 (attempt >= 2) のみ実行
副作用:
  git checkout -- .   → 未ステージ変更を全破棄
  git clean -fd       → 未追跡ファイルを全削除 (specs/ 除く)

危険パターン:
  - phase-split の phase N が失敗してリトライする際、
    phase N-1 がコミット済みであれば安全
  - phase N のファイルが git add 済みで未コミットの場合も破棄される
  - --exclude='specs/' で specs/ は保護されているが、プロジェクトルートの実装ファイルは消える
```

### 副作用マップ: `protect_sources` (pipeline-runner.sh:297-316)

```
実行条件: implement ステップ完了後 (単一・フェーズ分割両方)
副作用: agents/, commands/, lib/, .poor-dev/, .opencode/, .claude/ 配下の
        変更ファイルを git checkout HEAD -- で恢复 (変更破棄)

安全性: 変更前に _safe_git で .git 存在を確認済み
```

---

*このファイルは自動生成 (researcher エージェントによる静的解析) です。*
*コードの変更時は手動で更新してください。*

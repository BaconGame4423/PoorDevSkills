---
description: "ベンチマーク実行（右 tmux ペインで /poor-dev 自動実行 + Phase 0 自動応答 + PoorDevSkills 分析 + 飽和検出）"
---

## Arguments

$ARGUMENTS

Parse `$ARGUMENTS`:
- `--results [タスク名|combo名]` → Step 8 へ（結果表示 + 飽和検出）
- combo 名 (e.g. `claude_bash_glm5`) → Step 2 へ
- タスク名 (e.g. `関数ビジュアライザー`, `task-manager-api`) → タスクスコーピングで combo 解決 → Step 2 へ
- 空 → デフォルトタスクの combo → Step 2 へ

## Step 1: タスクスコーピング（combo 解決）

benchmarks/benchmarks.json を読み込み、引数を combo 名に解決する。

解決順序:
1. combo 名に完全一致 (`combinations[].dir_name`) → そのまま使用
2. `tasks[].name` (日本語名) に部分一致 → 対応するコンボ `combinations[].task` で検索
3. task ID (kebab-case) に完全一致 → 対応するコンボを選択
4. 引数なし → `default_task` の task ID → 対応するコンボを選択

```bash
BENCH_JSON="benchmarks/benchmarks.json"
ARG="$1"  # $ARGUMENTS の最初のトークン

if [ -z "$ARG" ]; then
  # 引数なし → デフォルトタスク
  TASK_ID=$(jq -r '.default_task' "$BENCH_JSON")
  COMBO=$(jq -r --arg t "$TASK_ID" '.combinations[] | select(.task == $t) | .dir_name' "$BENCH_JSON" | head -1)
elif jq -e --arg c "$ARG" '.combinations[] | select(.dir_name == $c)' "$BENCH_JSON" >/dev/null 2>&1; then
  # combo 名に完全一致
  COMBO="$ARG"
else
  # タスク名/IDで検索
  TASK_ID=$(jq -r --arg n "$ARG" '
    .tasks | to_entries[] |
    select(.value.name | test($n)) |
    .key' "$BENCH_JSON" | head -1)
  if [ -z "$TASK_ID" ]; then
    # task ID 完全一致
    TASK_ID=$(jq -r --arg id "$ARG" '.tasks | to_entries[] | select(.key == $id) | .key' "$BENCH_JSON" | head -1)
  fi
  if [ -z "$TASK_ID" ]; then
    echo "ERROR: '$ARG' に一致するタスクまたは combo が見つかりません"
    # AskUserQuestion で combo を選択させる
  fi
  COMBO=$(jq -r --arg t "$TASK_ID" '.combinations[] | select(.task == $t) | .dir_name' "$BENCH_JSON" | head -1)
fi

echo "解決結果: COMBO=$COMBO, TASK_ID=$TASK_ID"
```

combo が解決できない場合は AskUserQuestion で combinations を表示して選択させる。

## Step 2: 環境セットアップ

左ペイン（Claude Code 側）で同期実行。

セットアップ前に TS ビルドが最新か確認:
```bash
npm run build 2>/dev/null || true
```

```bash
./benchmarks/run-benchmark.sh --setup <combo>
```

追加確認:
```bash
# .poor-dev/dist/bin/poor-dev-next.js 存在確認
if [ ! -f ".poor-dev/dist/bin/poor-dev-next.js" ]; then
  echo "ERROR: .poor-dev/dist/bin/poor-dev-next.js が見つかりません"
  echo "npm run build を実行してください"
fi
```

## Step 3: プロンプト構築

benchmarks.json の `tasks` からタスク情報を取得してプロンプトを構築する。

```bash
# combo から task ID を解決
TASK_ID=$(jq -r --arg c "<combo>" '.combinations[] | select(.dir_name == $c) | .task' "$BENCH_JSON")
TASK_DESC=$(jq -r --arg t "$TASK_ID" '.tasks[$t].description' "$BENCH_JSON")
TASK_NAME=$(jq -r --arg t "$TASK_ID" '.tasks[$t].name' "$BENCH_JSON")
REQ_PARTS=$(jq -r --arg t "$TASK_ID" '[.tasks[$t].requirements[] | "\(.id): \(.name)"] | join(", ")' "$BENCH_JSON")
PROMPT="/poor-dev ${TASK_DESC}「${TASK_NAME}」を開発してください。要件: ${REQ_PARTS}"
```

## Step 4: ベンチペイン作成 + Claude CLI 起動

既存の tmux ペイン管理方式で右ペインを作成し、Claude CLI を起動する。

```bash
BENCH_STATE="/tmp/bench-active-panes.json"
[ ! -f "$BENCH_STATE" ] && echo '{}' > "$BENCH_STATE"

CURRENT=$(tmux display-message -p '#{pane_id}')

# 既存ベンチペインの検証（死んだペインを除去）
VALID_PANES=()
for combo_key in $(jq -r 'keys[]' "$BENCH_STATE" 2>/dev/null); do
  PANE_ID=$(jq -r --arg k "$combo_key" '.[$k].pane_id' "$BENCH_STATE")
  if tmux list-panes -F '#{pane_id}' 2>/dev/null | grep -q "^${PANE_ID}$"; then
    VALID_PANES+=("$PANE_ID")
  else
    jq --arg k "$combo_key" 'del(.[$k])' "$BENCH_STATE" > "${BENCH_STATE}.tmp" \
      && mv "${BENCH_STATE}.tmp" "$BENCH_STATE"
  fi
done

# 同一 combo 重複チェック
if jq -e --arg c "<combo>" '.[$c]' "$BENCH_STATE" >/dev/null 2>&1; then
  echo "ERROR: <combo> は既に実行中です"
fi

# ペイン作成
if [ ${#VALID_PANES[@]} -eq 0 ]; then
  for p in $(tmux list-panes -F '#{pane_id}' | grep -v "$CURRENT"); do
    tmux kill-pane -t "$p" 2>/dev/null || true
  done
  TARGET=$(tmux split-window -h -P -F '#{pane_id}' -l 50%)
else
  TARGET=$(tmux split-window -v -t "${VALID_PANES[0]}" -P -F '#{pane_id}')
fi

# ペインを状態ファイルに登録
jq --arg c "<combo>" --arg p "$TARGET" \
  '.[$c] = {"pane_id": $p}' \
  "$BENCH_STATE" > "${BENCH_STATE}.tmp" && mv "${BENCH_STATE}.tmp" "$BENCH_STATE"
```

CLI 起動（常に claude + 全権限自動許諾）:
```bash
ORCH_MODEL=$(jq -r --arg c "<combo>" '.combinations[] | select(.dir_name == $c) | .orchestrator' benchmarks/benchmarks.json | xargs -I{} jq -r --arg o "{}" '.models[$o].model_id' benchmarks/benchmarks.json)
BENCH_ABS="$(cd benchmarks/<combo> && pwd)"
tmux send-keys -t $TARGET "cd $BENCH_ABS && GIT_CEILING_DIRECTORIES=$(cd benchmarks && pwd) env -u CLAUDECODE claude --model $ORCH_MODEL --dangerously-skip-permissions" Enter
```

パスは絶対パスに解決してから送信すること。

## Step 5: CLI 初期化待機 + プロンプト送信

Claude CLI の READY_PATTERN は `"❯"`:

```bash
READY_PATTERN="❯"
WAIT_TIMEOUT=30; WAITED=0
while [ $WAITED -lt $WAIT_TIMEOUT ]; do
  if tmux capture-pane -t $TARGET -p 2>/dev/null | grep -q "$READY_PATTERN"; then
    sleep 1
    break
  fi
  sleep 1; WAITED=$((WAITED + 1))
done
if [ $WAITED -ge $WAIT_TIMEOUT ]; then
  echo "ERROR: TUI が ${WAIT_TIMEOUT}秒以内に初期化されませんでした"
fi
```

プロンプト送信:
```bash
tmux set-buffer -b bench "$PROMPT"
tmux paste-buffer -p -t $TARGET -b bench -d
sleep 1
tmux send-keys -t $TARGET Enter
```

送信確認（リトライ付き）— ペインに `esc to inter` が表示されれば処理開始済み（行末 truncate 対策で部分一致）。`Streaming` / `Tool` 処理中パターンも確認に使用:
```bash
SUBMIT_TIMEOUT=10; SUBMIT_WAITED=0; ENTER_RETRIES=0; MAX_ENTER_RETRIES=3
while [ $SUBMIT_WAITED -lt $SUBMIT_TIMEOUT ]; do
  PANE_CONTENT=$(tmux capture-pane -t $TARGET -p 2>/dev/null)
  if echo "$PANE_CONTENT" | grep -q "esc to inter"; then
    echo "OK: プロンプト送信確認"
    break
  fi
  # Streaming / Tool 処理中なら待機
  if echo "$PANE_CONTENT" | grep -qE "(Streaming|Tool)"; then
    echo "INFO: 処理中を検出、待機..."
    sleep 2
    SUBMIT_WAITED=$((SUBMIT_WAITED + 2))
    continue
  fi
  # まだ入力欄にいる場合は Enter を再送（最大3回）
  if [ $ENTER_RETRIES -lt $MAX_ENTER_RETRIES ]; then
    tmux send-keys -t $TARGET Enter
    ENTER_RETRIES=$((ENTER_RETRIES + 1))
    echo "INFO: Enter 再送 ($ENTER_RETRIES/$MAX_ENTER_RETRIES)"
  fi
  sleep 2
  SUBMIT_WAITED=$((SUBMIT_WAITED + 2))
done
if [ $SUBMIT_WAITED -ge $SUBMIT_TIMEOUT ]; then
  echo "WARNING: プロンプト送信が反映されていない可能性があります"
fi
```

`tmux send-keys -l` は Bubbletea TUI に UTF-8 マルチバイト文字（日本語）を送信できない。
`set-buffer` + `paste-buffer -p` は tmux の bracketed paste メカニズムを使うため UTF-8 を正しく扱える。
`-p` は Bubbletea の bracketed paste mode に対応（これがないと UTF-8 マルチバイトが分断される）。
`-b bench` で名前付きバッファを使用、`-d` でペースト後にバッファを削除。

## Step 6: TS 監視プロセス起動（バックグラウンド）

combo から Phase 0 応答ファイルのパスを解決して TS monitor を起動する。

```bash
# Phase 0 応答ファイルのパスを解決
TASK_ID=$(jq -r --arg c "<combo>" '.combinations[] | select(.dir_name == $c) | .task' benchmarks/benchmarks.json)
PHASE0_FILE=$(jq -r --arg t "$TASK_ID" '.tasks[$t].phase0_responses' benchmarks/benchmarks.json)
PHASE0_CONFIG="benchmarks/_scaffold/common/${PHASE0_FILE}"

# Verbose heartbeat for slow models (non-claude CLI = external LLM)
SUB_AGENT=$(jq -r --arg c "<combo>" '.combinations[] | select(.dir_name == $c) | .sub_agent' benchmarks/benchmarks.json)
SUB_CLI=$(jq -r --arg m "$SUB_AGENT" '.models[$m].cli' benchmarks/benchmarks.json)
VERBOSE_FLAG=""
if [ "$SUB_CLI" != "claude" ]; then
  VERBOSE_FLAG="--verbose-heartbeat"
fi

node dist/lib/benchmark/bin/bench-team-monitor.js \
  --combo <combo> \
  --target $TARGET \
  --combo-dir benchmarks/<combo> \
  --phase0-config "$PHASE0_CONFIG" \
  --post-command "./benchmarks/run-benchmark.sh --post <combo>" \
  --timeout 7200 \
  --caller-pane $CURRENT \
  $VERBOSE_FLAG
```

Bash(run_in_background) で実行。

ユーザーに通知:
- 右ペインで `/poor-dev` パイプラインが開始されたこと
- Phase 0 質問は自動応答されること
- 進捗は右ペインで確認可能なこと
- 完了後は自動でポスト処理が実行されること

## Step 7: 完了時通知

監視プロセスが完了したらユーザーに通知:
- ベンチマーク実行が完了したこと
- `/bench --results <combo>` で結果確認を案内

※ ポスト処理はモニターが `--post-command` で自動実行済み。

## Step 8: 結果表示 + 飽和検出（`--results` モード）

`$ARGUMENTS` から `--results` の後のオプション引数を取得。
引数がなければ `default_task` の combo、引数があれば Step 1 のタスクスコーピングで combo を解決。

### 8a. 基本結果表示

1. **poordev-analysis.yaml**: `benchmarks/<combo>/poordev-analysis.yaml` を Read して表示
2. **レビューファイル**: `benchmarks/reviews/<combo>.review.yaml` の存在確認と概要
3. **成果物一覧**: spec.md, plan.md, tasks.md, review-log.yaml の有無を確認

### 8b. 知見飽和検出 (Maturity Detector)

対象タスクの過去レビュー (`benchmarks/reviews/` + `_runs/`) を横断分析する。

```bash
COMBO_DIR="benchmarks/<combo>"
REVIEW_FILE="benchmarks/reviews/<combo>.review.yaml"

# --- シグナル 1: スコア安定（直近3回 ±2pt 以内）---
# _runs/ 内の poordev-analysis.yaml から scoring.total を収集
SCORES=()
for run_dir in $(ls -dt "$COMBO_DIR/_runs"/*/ 2>/dev/null | head -5); do
  score=$(grep -A1 'scoring:' "$run_dir/poordev-analysis.yaml" 2>/dev/null | grep 'total:' | awk '{print $2}')
  [ -n "$score" ] && SCORES+=("$score")
done
SCORE_STABLE=false
if [ ${#SCORES[@]} -ge 3 ]; then
  # 直近3回の最大差を計算
  RECENT=("${SCORES[@]:0:3}")
  MAX=${RECENT[0]}; MIN=${RECENT[0]}
  for s in "${RECENT[@]}"; do
    [ "$s" -gt "$MAX" ] 2>/dev/null && MAX=$s
    [ "$s" -lt "$MIN" ] 2>/dev/null && MIN=$s
  done
  [ $((MAX - MIN)) -le 2 ] && SCORE_STABLE=true
fi

# --- シグナル 2: レビュー ROI 低下（直近3回 C/H = 0）---
REVIEW_ROI_LOW=false
CH_COUNTS=()
for run_dir in $(ls -dt "$COMBO_DIR/_runs"/*/ 2>/dev/null | head -3); do
  ch=$(grep -cE 'severity:\s*(critical|high)' "$run_dir/review-log.yaml" 2>/dev/null || echo 0)
  CH_COUNTS+=("$ch")
done
if [ ${#CH_COUNTS[@]} -ge 3 ]; then
  ALL_ZERO=true
  for c in "${CH_COUNTS[@]:0:3}"; do
    [ "$c" -ne 0 ] && ALL_ZERO=false
  done
  $ALL_ZERO && REVIEW_ROI_LOW=true
fi

# --- シグナル 3: 完走率安定（直近5回中4回以上完走）---
COMPLETION_STABLE=false
COMPLETE_COUNT=0; TOTAL_RUNS=0
for run_dir in $(ls -dt "$COMBO_DIR/_runs"/*/ 2>/dev/null | head -5); do
  TOTAL_RUNS=$((TOTAL_RUNS + 1))
  state_file=$(find "$run_dir" -name "pipeline-state.json" 2>/dev/null | head -1)
  if [ -n "$state_file" ]; then
    status=$(jq -r '.status // "unknown"' "$state_file" 2>/dev/null)
    [ "$status" = "completed" ] && COMPLETE_COUNT=$((COMPLETE_COUNT + 1))
  fi
done
[ $TOTAL_RUNS -ge 5 ] && [ $COMPLETE_COUNT -ge 4 ] && COMPLETION_STABLE=true

# --- シグナル 4: 新規障害消滅（直近3回で新しい失敗パターンなし）---
NEW_FAILURES_GONE=false
FAIL_PATTERNS=()
for run_dir in $(ls -dt "$COMBO_DIR/_runs"/*/ 2>/dev/null | head -3); do
  fails=$(grep -l 'status.*error\|ERROR\|FAILED' "$run_dir"/*.txt "$run_dir"/*.log 2>/dev/null | wc -l)
  FAIL_PATTERNS+=("$fails")
done
if [ ${#FAIL_PATTERNS[@]} -ge 3 ]; then
  ALL_ZERO=true
  for f in "${FAIL_PATTERNS[@]:0:3}"; do
    [ "$f" -ne 0 ] && ALL_ZERO=false
  done
  $ALL_ZERO && NEW_FAILURES_GONE=true
fi

# --- 判定 ---
SIGNAL_COUNT=0
$SCORE_STABLE && SIGNAL_COUNT=$((SIGNAL_COUNT + 1))
$REVIEW_ROI_LOW && SIGNAL_COUNT=$((SIGNAL_COUNT + 1))
$COMPLETION_STABLE && SIGNAL_COUNT=$((SIGNAL_COUNT + 1))
$NEW_FAILURES_GONE && SIGNAL_COUNT=$((SIGNAL_COUNT + 1))

case $SIGNAL_COUNT in
  4) MATURITY="SATURATED" ;;
  3) MATURITY="CONVERGING" ;;
  *) MATURITY="LEARNING" ;;
esac
```

### 8c. 飽和検出結果の表示

結果表示にマチュリティ判定を含める:

```
=== 知見飽和検出 ===
スコア安定:       [YES/NO] (直近3回 ±2pt 以内)
レビュー ROI:     [YES/NO] (直近3回 C/H = 0)
完走率安定:       [YES/NO] (直近5回中4回以上完走)
新規障害消滅:     [YES/NO] (直近3回で新しい失敗パターンなし)

判定: 🔴 SATURATED / 🟡 CONVERGING / 🟢 LEARNING
```

- `SATURATED`: 「このタスクから得られる知見は飽和しています。FeatureBench 方式（既存コードへの機能追加タスク）への移行を推奨します。」
- `CONVERGING`: 「あと 1-2 回で飽和する可能性があります。新しいタスクの検討を開始してください。」
- `LEARNING`: 「まだ知見が蓄積されています。引き続きベンチマークを実行してください。」

データが不十分（_runs/ が3回未満）の場合は飽和検出をスキップして「データ不足」と表示。

### 8d. 次のアクション案内

- 分析結果に基づく改善点の要約
- `poor-dev benchmark compare` で比較レポートを生成可能なこと
- 飽和判定が SATURATED の場合: 新タスクへの移行を推奨

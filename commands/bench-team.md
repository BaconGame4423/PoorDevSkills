---
description: "Agent Teams ベンチマーク実行（右 tmux ペインで /poor-dev.team 自動実行 + Phase 0 自動応答 + PoorDevSkills 分析）"
---

## Arguments

$ARGUMENTS

Parse `$ARGUMENTS`:
- combo 名 (e.g. `claude_team`, `sonnet_team`) → Step 2 へ
- `--results <combo>` → Step 8 へ（結果表示のみ）
- 空 → combo 選択（Step 1）

## Step 1: combo 選択（引数なしの場合）

benchmarks/benchmarks.json を読み込み、combinations から `mode: "team"` のみフィルタして表示。
AskUserQuestion で combo を選択させる。
選択肢は各 combo の `dir_name` + `orchestrator/sub_agent` を表示する。

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

benchmarks.json からプロンプトを構築する。`/poor-dev.team` プレフィックスを使用。

```bash
TASK_DESC=$(jq -r '.task.description' benchmarks/benchmarks.json)
TASK_NAME=$(jq -r '.task.name' benchmarks/benchmarks.json)
REQ_PARTS=$(jq -r '[.task.requirements[] | "\(.id): \(.name)"] | join(", ")' benchmarks/benchmarks.json)
PROMPT="/poor-dev.team ${TASK_DESC}「${TASK_NAME}」を開発してください。要件: ${REQ_PARTS}"
```

## Step 4: ベンチペイン作成 + claude 起動

既存 bench.md の Step 5-6 と同じ tmux ペイン方式。
CLI は常に `claude`（Agent Teams は Claude Code 専用）。

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
tmux send-keys -t $TARGET "cd benchmarks/<combo> && env -u CLAUDECODE claude --model $ORCH_MODEL --dangerously-skip-permissions" Enter
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

## Step 6: TS 監視プロセス起動（バックグラウンド）

```bash
node dist/lib/benchmark/bin/bench-team-monitor.js \
  --combo <combo> \
  --target $TARGET \
  --combo-dir benchmarks/<combo> \
  --phase0-config benchmarks/_scaffold/common/phase0-responses.json \
  --post-command "./benchmarks/run-benchmark.sh --post <combo>" \
  --timeout 7200 \
  --enable-team-stall-detection \
  --caller-pane $CURRENT
```

Bash(run_in_background) で実行。

ユーザーに通知:
- 右ペインで Agent Teams `/poor-dev.team` パイプラインが開始されたこと
- Phase 0 質問は自動応答されること
- 進捗は右ペインで確認可能なこと
- 完了後は自動でポスト処理が実行されること

## Step 7: 完了時通知

監視プロセスが完了したらユーザーに通知:
- ベンチマーク実行が完了したこと
- `/bench-team --results <combo>` で結果確認を案内

※ ポスト処理はモニターが `--post-command` で自動実行済み。

## Step 8: 結果表示（`--results` モード）

`$ARGUMENTS` から combo 名を取得し、以下を表示:

1. **poordev-analysis.yaml**: `benchmarks/<combo>/poordev-analysis.yaml` を Read して表示
2. **レビューファイル**: `benchmarks/reviews/<combo>.review.yaml` の存在確認と概要
3. **成果物一覧**: spec.md, plan.md, tasks.md, review-log.yaml の有無を確認
4. **次のアクション案内**

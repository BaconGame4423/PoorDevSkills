---
description: "ベンチマーク実行（右 tmux ペインで対話 TUI 経由パイプライン自動実行 + PoorDevSkills 分析）"
---

## Arguments

$ARGUMENTS

Parse `$ARGUMENTS`:
- combo 名 (e.g. `glm5_all`, `claude_all`) → Step 2 へ
- `--results <combo>` → Step 11 へ（結果表示のみ）
- 空 → combo 選択（Step 1）

## Step 1: combo 選択（引数なしの場合）

benchmarks/benchmarks.json を読み込み、combinations を取得する。
AskUserQuestion で combo を選択させる。
選択肢は各 combo の `dir_name` + `orchestrator/sub_agent` を表示する。

## Step 2: 環境セットアップ

左ペイン（Claude Code 側）で同期実行。ディレクトリ作成・シンボリックリンク・バージョン設定。

```bash
./benchmarks/run-benchmark.sh --setup <combo>
```

## Step 3: CLI・モデル判定

benchmarks.json から CLI とモデルを取得する。

```bash
ORCH=$(jq -r --arg c "<combo>" '.combinations[] | select(.dir_name == $c) | .orchestrator' benchmarks/benchmarks.json)
ORCH_CLI=$(jq -r --arg o "$ORCH" '.models[$o].cli' benchmarks/benchmarks.json)
ORCH_MODEL=$(jq -r --arg o "$ORCH" '.models[$o].model_id' benchmarks/benchmarks.json)
```

## Step 4: 前回状態クリア

```bash
rm -f benchmarks/<combo>/.bench-complete
find benchmarks/<combo> -name "pipeline-state.json" -delete 2>/dev/null || true
```

## Step 5: 右 tmux ペインリセット

```bash
# 現在のペイン以外をすべて閉じる
CURRENT=$(tmux display-message -p '#{pane_id}')
for p in $(tmux list-panes -F '#{pane_id}' | grep -v "$CURRENT"); do
  tmux kill-pane -t "$p" 2>/dev/null || true
done
# 新規ペインを作成
TARGET=$(tmux split-window -h -P -F '#{pane_id}' -l 50%)
```

## Step 6: CLI 起動

右ペインで対話 TUI を起動する。

- opencode の場合:
  ```bash
  tmux send-keys -t $TARGET "cd benchmarks/<combo> && opencode" Enter
  ```
- claude の場合:
  ```bash
  tmux send-keys -t $TARGET "cd benchmarks/<combo> && env -u CLAUDECODE claude --model $ORCH_MODEL" Enter
  ```

`env -u CLAUDECODE` は親 Claude Code の環境変数干渉を防止。
opencode はディレクトリ内の `opencode.json` でモデル設定済み。

パスは絶対パスに解決してから送信すること。

## Step 7: CLI 初期化待機（ポーリング）

TUI が入力受付状態になるまで `tmux capture-pane` でポーリングする。

CLI ごとの READY_PATTERN:
- `opencode` → `"Ask anything"`
- `claude` → `">"`

```bash
# READY_PATTERN は Step 3 の ORCH_CLI に基づいて設定
if [ "$ORCH_CLI" = "opencode" ]; then
  READY_PATTERN="Ask anything"
else
  READY_PATTERN=">"
fi

WAIT_TIMEOUT=30; WAITED=0
while [ $WAITED -lt $WAIT_TIMEOUT ]; do
  if tmux capture-pane -t $TARGET -p 2>/dev/null | grep -q "$READY_PATTERN"; then
    sleep 1  # 追加の安定待機
    break
  fi
  sleep 1; WAITED=$((WAITED + 1))
done
if [ $WAITED -ge $WAIT_TIMEOUT ]; then
  echo "ERROR: TUI が ${WAIT_TIMEOUT}秒以内に初期化されませんでした"
  # ユーザーにエラー通知して中断
fi
```

ポーリング間隔: 1 秒、タイムアウト: 30 秒。タイムアウト時はエラー通知して中断する。

## Step 8: プロンプト構築・送信

benchmarks.json からシングルラインプロンプトを構築し、tmux paste-buffer で TUI に送信する。

```bash
# benchmarks.json からプロンプト要素を取得
TASK_DESC=$(jq -r '.task.description' benchmarks/benchmarks.json)
TASK_NAME=$(jq -r '.task.name' benchmarks/benchmarks.json)
REQ_PARTS=$(jq -r '[.task.requirements[] | "\(.id): \(.name)"] | join(", ")' benchmarks/benchmarks.json)
PROMPT="/poor-dev ${TASK_DESC}「${TASK_NAME}」を開発してください。要件: ${REQ_PARTS}"
```

送信（変化確認付き）:
```bash
# 送信前のペイン内容を取得
BEFORE=$(tmux capture-pane -t $TARGET -p 2>/dev/null | md5sum)
# paste-buffer 送信
tmux set-buffer -b bench "$PROMPT"
tmux paste-buffer -p -t $TARGET -b bench -d
tmux send-keys -t $TARGET Enter
sleep 2
# 送信後のペイン内容を比較
AFTER=$(tmux capture-pane -t $TARGET -p 2>/dev/null | md5sum)
if [ "$BEFORE" = "$AFTER" ]; then
  echo "WARNING: プロンプト送信が反映されていない可能性があります"
fi
```

`tmux send-keys -l` は Bubbletea TUI に UTF-8 マルチバイト文字（日本語）を送信できない。
`set-buffer` + `paste-buffer -p` は tmux の bracketed paste メカニズムを使うため UTF-8 を正しく扱える。
`-p` は Bubbletea の bracketed paste mode に対応（これがないと UTF-8 マルチバイトが分断される）。
`-b bench` で名前付きバッファを使用、`-d` でペースト後にバッファを削除。

ユーザーに通知:
- 右ペインで TUI が起動し `/poor-dev` パイプラインが開始されたこと
- 進捗は右ペインで確認可能なこと
- 完了後は自動でポスト処理が実行されること

## Step 9: バックグラウンド完了監視

Bash(run_in_background) で pipeline-state.json をポーリング（60 秒間隔、最大 120 分）。

完了判定ロジック:
- `pipeline-state.json` を `find` で探索（`specs/*/pipeline-state.json` または `.poor-dev/pipeline-state.json`）
- `current == null` AND `completed` が非空 → パイプライン全ステップ完了
- `status == "error"` → エラー終了

```bash
COMBO_DIR="benchmarks/<combo>"
TIMEOUT=7200; ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 60; ELAPSED=$((ELAPSED + 60))
  STATE_FILE=$(find "$COMBO_DIR" -name "pipeline-state.json" 2>/dev/null | head -1)
  if [ -n "$STATE_FILE" ]; then
    CURRENT=$(jq -r '.current // "running"' "$STATE_FILE" 2>/dev/null)
    COMPLETED=$(jq -r '.completed | length' "$STATE_FILE" 2>/dev/null)
    STATUS=$(jq -r '.status // "unknown"' "$STATE_FILE" 2>/dev/null)
    if [ "$CURRENT" = "null" ] && [ "$COMPLETED" -gt 0 ]; then
      echo "BENCH_PIPELINE_COMPLETE: <combo>"; exit 0
    fi
    if [ "$STATUS" = "error" ]; then
      echo "BENCH_PIPELINE_ERROR: <combo>"; exit 1
    fi
  fi
done
echo "BENCH_TIMEOUT: <combo>"
```

## Step 10: 完了時ポスト処理

完了検知後、左ペインでポスト処理を実行する。

```bash
./benchmarks/run-benchmark.sh --post <combo>
```

メトリクス収集 + PoorDevSkills 分析 + `.bench-complete` マーカー作成。

ユーザーに完了を通知し、`/bench --results <combo>` で結果確認を案内する。

## Step 11: 結果表示（`--results` モード）

`$ARGUMENTS` から combo 名を取得し、以下を表示:

1. **poordev-analysis.yaml**: `benchmarks/<combo>/poordev-analysis.yaml` を Read して表示
2. **レビューファイル**: `benchmarks/reviews/<combo>.review.yaml` の存在確認と概要
3. **成果物一覧**: spec.md, plan.md, tasks.md, review-log.yaml の有無を確認
4. **次のアクション案内**:
   - 分析結果に基づく改善点の要約
   - `poor-dev benchmark compare` で比較レポートを生成可能なこと

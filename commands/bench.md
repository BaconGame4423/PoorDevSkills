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

## Step 4: 前回ラン状態の保存 + クリーン

既存のベンチマーク成果物があればアーカイブ（`_runs/<timestamp>/`）してからクリーンな状態にする。

```bash
./benchmarks/run-benchmark.sh --archive <combo>
./benchmarks/run-benchmark.sh --clean <combo>
```

## Step 5: ベンチペイン作成（マルチペイン対応）

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
  # ユーザーにエラー通知して中断
fi

# ペイン作成
if [ ${#VALID_PANES[@]} -eq 0 ]; then
  # ベンチペインなし → 既存の右ペインを削除 → 水平分割
  for p in $(tmux list-panes -F '#{pane_id}' | grep -v "$CURRENT"); do
    tmux kill-pane -t "$p" 2>/dev/null || true
  done
  TARGET=$(tmux split-window -h -P -F '#{pane_id}' -l 50%)
else
  # ベンチペインあり → 既存ベンチペインを垂直分割（上下）
  TARGET=$(tmux split-window -v -t "${VALID_PANES[0]}" -P -F '#{pane_id}')
fi

# ペインを状態ファイルに登録
jq --arg c "<combo>" --arg p "$TARGET" \
  '.[$c] = {"pane_id": $p}' \
  "$BENCH_STATE" > "${BENCH_STATE}.tmp" && mv "${BENCH_STATE}.tmp" "$BENCH_STATE"
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

Bash(run_in_background) で完了監視ポーリング（最大 120 分）。

- 10 秒間隔: TUI 質問ダイアログの自動応答（`esc dismiss` パターン検知 → 1番目を選択）
- 10 秒間隔: opencode Permission required ダイアログの自動承認（「Allow always」→「Confirm」）
- 60 秒間隔: pipeline-state.json の完了/エラー判定

質問自動応答ポリシー: 常に最初の選択肢を選択（全 combo 共通 = 公平性担保）。
複数質問は1サイクル1質問ずつ処理。opencode のみ対応、claude CLI は今後追加。

Permission required 自動承認ポリシー: ベンチマーク環境ではすべて「Allow always」で承認する。
opencode のサンドボックスがベンチマーク外ディレクトリ（DevSkills/lib 等）へのアクセスを求めるのは正常動作。
操作手順: Right（Allow always に移動）→ Enter → Enter（Confirm）。
注意: Tab は opencode のモード切替（agents タブ等）になるため絶対に使わない。

```bash
COMBO_DIR="benchmarks/<combo>"
TIMEOUT=7200; ELAPSED=0; CHECK=0

if [ "$ORCH_CLI" = "opencode" ]; then
  QUESTION_PATTERN="esc dismiss"
  PERMISSION_PATTERN="Permission required"
else
  QUESTION_PATTERN=""
  PERMISSION_PATTERN=""
fi

LAST_ANSWER_TIME=0
ANSWER_COOLDOWN=30
LAST_PERM_TIME=0
PERM_COOLDOWN=15

while [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 10; ELAPSED=$((ELAPSED + 10)); CHECK=$((CHECK + 1))

  # ペイン存在確認
  if ! tmux list-panes -F '#{pane_id}' 2>/dev/null | grep -q "$TARGET"; then
    echo "BENCH_PANE_LOST: <combo>"; exit 1
  fi

  PANE_CONTENT=$(tmux capture-pane -t $TARGET -p 2>/dev/null)

  # Permission required 自動承認（クールダウン付き）
  # opencode のサンドボックス権限ダイアログを検知し「Allow always」で承認する
  # Tab はモード切替になるため使用禁止。左右矢印キーでオプション選択する
  if [ -n "$PERMISSION_PATTERN" ]; then
    SINCE_PERM=$((ELAPSED - LAST_PERM_TIME))
    if [ $SINCE_PERM -ge $PERM_COOLDOWN ]; then
      if echo "$PANE_CONTENT" | grep -q "$PERMISSION_PATTERN"; then
        echo "[${ELAPSED}s] Permission required detected"
        # Right arrow → "Allow always" に移動 → Enter で選択
        tmux send-keys -t $TARGET Right
        sleep 0.5
        tmux send-keys -t $TARGET Enter
        sleep 1
        # "Allow always" 選択後に Confirm/Cancel ダイアログが表示される → Enter で Confirm
        CONFIRM_CONTENT=$(tmux capture-pane -t $TARGET -p 2>/dev/null)
        if echo "$CONFIRM_CONTENT" | grep -q "Confirm"; then
          tmux send-keys -t $TARGET Enter
          sleep 0.5
          echo "[${ELAPSED}s] Permission approved (Allow always + Confirm)"
        else
          echo "[${ELAPSED}s] Permission approved (direct)"
        fi
        LAST_PERM_TIME=$ELAPSED
        # Permission 処理直後はペイン内容が変化しているので次のチェックをスキップ
        continue
      fi
    fi
  fi

  # 質問自動応答（クールダウン付き）
  if [ -n "$QUESTION_PATTERN" ]; then
    SINCE_LAST=$((ELAPSED - LAST_ANSWER_TIME))
    if [ $SINCE_LAST -ge $ANSWER_COOLDOWN ]; then
      if echo "$PANE_CONTENT" | grep -q "$QUESTION_PATTERN"; then
        BEFORE_HASH=$(echo "$PANE_CONTENT" | md5sum | cut -d' ' -f1)
        echo "[${ELAPSED}s] Question detected, sending Enter"
        tmux send-keys -t $TARGET Enter
        sleep 3
        AFTER_HASH=$(tmux capture-pane -t $TARGET -p 2>/dev/null | md5sum | cut -d' ' -f1)
        if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
          echo "[${ELAPSED}s] Question answered (content changed)"
          LAST_ANSWER_TIME=$ELAPSED
        else
          echo "[${ELAPSED}s] WARNING: content unchanged after Enter"
        fi
      fi
    fi
  fi

  # pipeline-state.json チェック（60秒ごと）
  if [ $((CHECK % 6)) -eq 0 ]; then
    STATE_FILE=$(find "$COMBO_DIR" -name "pipeline-state.json" 2>/dev/null | head -1)
    if [ -n "$STATE_FILE" ]; then
      CURRENT=$(jq -r '.current // "running"' "$STATE_FILE" 2>/dev/null)
      COMPLETED=$(jq -r '.completed | length' "$STATE_FILE" 2>/dev/null)
      STATUS=$(jq -r '.status // "unknown"' "$STATE_FILE" 2>/dev/null)
      echo "[${ELAPSED}s] current=$CURRENT completed=$COMPLETED status=$STATUS"
      if [ "$CURRENT" = "null" ] && [ "$COMPLETED" -gt 0 ]; then
        echo "BENCH_PIPELINE_COMPLETE: <combo>"; exit 0
      fi
      if [ "$STATUS" = "error" ]; then
        echo "BENCH_PIPELINE_ERROR: <combo>"; exit 1
      fi
    else
      echo "[${ELAPSED}s] pipeline-state.json not found yet"
    fi

    # TUI アイドル検知（pipeline-state.json が生成されないケースの完了検知）
    # 最初の 120 秒はモデル起動中の誤検知を防ぐためスキップ
    # TUI idle + 成果物 mtime の両方を確認して誤検知を防ぐ
    if [ $ELAPSED -ge 120 ]; then
      TUI_IDLE=false
      PANE_CONTENT=$(tmux capture-pane -t $TARGET -p 2>/dev/null)
      if [ "$ORCH_CLI" = "opencode" ]; then
        echo "$PANE_CONTENT" | grep -q "Ask anything" && TUI_IDLE=true
      else
        echo "$PANE_CONTENT" | grep -q "^>" && TUI_IDLE=true
      fi

      if [ "$TUI_IDLE" = true ]; then
        # 成果物の存在 + mtime チェック（.gitignore より新しいファイルがあるか）
        HAS_OUTPUT=false
        if [ -f "$COMBO_DIR/.gitignore" ]; then
          OUTPUT_FILES=$(find "$COMBO_DIR" \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.ts" -o -name "*.py" \) -newer "$COMBO_DIR/.gitignore" -not -path '*/_runs/*' -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null | head -1)
          [ -n "$OUTPUT_FILES" ] && HAS_OUTPUT=true
        fi
        if [ "$HAS_OUTPUT" = true ]; then
          echo "BENCH_TUI_IDLE: <combo> (output files confirmed)"; exit 0
        else
          echo "[${ELAPSED}s] TUI idle but no output files yet, continuing..."
        fi
      fi
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

ベンチペイン状態のクリーンアップ:

```bash
BENCH_STATE="/tmp/bench-active-panes.json"
if [ -f "$BENCH_STATE" ]; then
  jq --arg c "<combo>" 'del(.[$c])' "$BENCH_STATE" > "${BENCH_STATE}.tmp" \
    && mv "${BENCH_STATE}.tmp" "$BENCH_STATE"
  [ "$(jq 'length' "$BENCH_STATE" 2>/dev/null)" = "0" ] && rm -f "$BENCH_STATE"
fi
```

ユーザーに完了を通知し、`/bench --results <combo>` で結果確認を案内する。

## Step 11: 結果表示（`--results` モード）

`$ARGUMENTS` から combo 名を取得し、以下を表示:

1. **poordev-analysis.yaml**: `benchmarks/<combo>/poordev-analysis.yaml` を Read して表示
2. **レビューファイル**: `benchmarks/reviews/<combo>.review.yaml` の存在確認と概要
3. **成果物一覧**: spec.md, plan.md, tasks.md, review-log.yaml の有無を確認
4. **次のアクション案内**:
   - 分析結果に基づく改善点の要約
   - `poor-dev benchmark compare` で比較レポートを生成可能なこと

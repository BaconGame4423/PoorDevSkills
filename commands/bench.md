---
description: "ベンチマーク実行（右 tmux ペインでパイプライン自動実行 + PoorDevSkills 分析）"
---

## Arguments

$ARGUMENTS

Parse `$ARGUMENTS`:
- combo 名 (e.g. `glm5_all`, `claude_all`) → Step 2 へ
- `--results <combo>` → Step 5 へ（結果表示のみ）
- 空 → combo 選択（Step 1）

## Step 1: combo 選択（引数なしの場合）

benchmarks/benchmarks.json を読み込み、combinations を取得する。
AskUserQuestion で combo を選択させる。
選択肢は各 combo の `dir_name` + `orchestrator/sub_agent` を表示する。

## Step 2: 右 tmux ペイン検出

```bash
# 現在のペイン以外を取得
CURRENT=$(tmux display-message -p '#{pane_id}')
TARGET=$(tmux list-panes -F '#{pane_id}' | grep -v "$CURRENT" | head -1)
# なければ作成
if [ -z "$TARGET" ]; then
  TARGET=$(tmux split-window -h -P -F '#{pane_id}' -l 50%)
fi
```

## Step 3: ベンチマークディスパッチ

1. 古い完了マーカーを削除:
   ```bash
   rm -f benchmarks/<combo>/.bench-complete
   ```

2. 右ペインにコマンド送信:
   ```bash
   tmux send-keys -t $TARGET 'cd <DEVSKILLS_DIR> && ./benchmarks/run-benchmark.sh <combo>' Enter
   ```
   `<DEVSKILLS_DIR>` はプロジェクトルートの絶対パス、`<combo>` は選択された combo 名。

3. ユーザーに通知:
   - 右ペインでベンチマークが開始されたこと
   - 進捗は右ペインで確認可能なこと
   - 完了後は `/bench --results <combo>` で分析結果を確認できること

## Step 4: バックグラウンド完了監視

Bash(run_in_background) で `.bench-complete` をポーリング（60 秒間隔、最大 120 分）。

```bash
COMBO="<combo>"
MARKER="benchmarks/$COMBO/.bench-complete"
TIMEOUT=7200  # 120分
ELAPSED=0
while [ ! -f "$MARKER" ] && [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 60
  ELAPSED=$((ELAPSED + 60))
done
if [ -f "$MARKER" ]; then
  echo "BENCH_COMPLETE: $COMBO"
else
  echo "BENCH_TIMEOUT: $COMBO (${TIMEOUT}s)"
fi
```

完了検知時、ユーザーに通知する。

## Step 5: 結果表示（`--results` モード）

`$ARGUMENTS` から combo 名を取得し、以下を表示:

1. **poordev-analysis.yaml**: `benchmarks/<combo>/poordev-analysis.yaml` を Read して表示
2. **レビューファイル**: `benchmarks/reviews/<combo>.review.yaml` の存在確認と概要
3. **成果物一覧**: spec.md, plan.md, tasks.md, review-log.yaml の有無を確認
4. **次のアクション案内**:
   - 分析結果に基づく改善点の要約
   - `poor-dev benchmark compare` で比較レポートを生成可能なこと

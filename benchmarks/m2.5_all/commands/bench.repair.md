---
description: "前回ベンチの失敗ステップを診断・修正・テスト。分析→過去履歴参照→承諾→修正→smoke test→誘導。"
---

## Arguments

$ARGUMENTS

Parse `$ARGUMENTS`:
- combo 名 (e.g. `glm5_all`, `claude_all`) → Step 1 へ
- 空 → combo 選択

空の場合は `benchmarks/benchmarks.json` の combinations を AskUserQuestion で選択させる。

## Step 1: 最新ラン検出 + 分析読込

最新の `_runs/` ディレクトリを検出し、`poordev-analysis.yaml` を読み込む。

```bash
COMBO_DIR="benchmarks/<combo>"
LATEST_RUN=$(ls -td "$COMBO_DIR/_runs"/*/ 2>/dev/null | head -1)
```

- `LATEST_RUN` が存在しない場合 → エラー: 「`_runs/` にアーカイブされたランがありません。先に `/bench <combo>` を実行してください。」
- `LATEST_RUN/poordev-analysis.yaml` が存在しない場合 → エラー: 「分析ファイルがありません。`./benchmarks/run-benchmark.sh --post <combo>` を実行してください。」

Read で `LATEST_RUN/poordev-analysis.yaml` を読み込む。

## Step 2: 過去の修正履歴収集

```bash
# 過去の repair-log.yaml を全ラン分収集
find "$COMBO_DIR/_runs" -name "repair-log.yaml" -type f 2>/dev/null

# 最近のコマンドファイル変更履歴
git log --oneline -20 -- "benchmarks/<combo>/commands/" "benchmarks/<combo>/.opencode/command/" "lib/"
```

過去の repair-log.yaml が存在すれば Read で読み込み、同一パターンの修正履歴を参照する。

## Step 3: 診断表示 + 承諾ゲート

### 診断レポート生成

poordev-analysis.yaml から以下を抽出して表示する:

1. **summary.top_issues** を優先度順にリスト表示:
   ```
   ## 診断結果: <combo> (run: <timestamp>)

   ### 重大な問題 (Top Issues)
   | # | Priority | Issue | Impact | Root Cause |
   |---|----------|-------|--------|------------|
   | 1 | H | ... | ... | ... |
   | 2 | M | ... | ... | ... |
   ```

2. **summary.quick_wins** を実行可能な修正案として表示:
   ```
   ### 推奨修正 (Quick Wins)
   | # | Action | Implementation | Impact |
   |---|--------|----------------|--------|
   | 1 | ... | ... | ... |
   ```

3. **commands.issues** を severity 順に表示:
   ```
   ### コマンド別問題
   | Command | Severity | Description | Suggestion |
   |---------|----------|-------------|------------|
   ```

4. **過去の修正履歴との照合**: repair-log.yaml に同じフィンガープリントの issue があれば表示:
   ```
   ### 過去の修正履歴
   - [run: 20260215-145028] plan timeout → step_timeouts 追加 → 結果: pass
   ```

### フィンガープリント生成

各 issue のフィンガープリントは `command + severity + description先頭50文字` の SHA256 先頭8文字で生成:

```bash
echo -n "<command>|<severity>|<description_first_50_chars>" | sha256sum | cut -c1-8
```

### 承諾ゲート

AskUserQuestion で修正の承諾を求める:
- 選択肢 1: 「推奨修正をすべて適用」
- 選択肢 2: 「修正を選択して適用」(個別選択)
- 選択肢 3: 「診断のみ（修正しない）」

選択肢 3 → Step 7 へスキップ（修正なし）。
選択肢 2 → 各修正について個別に承諾を求める。

## Step 4: 修正適用

承諾された修正をファイルに反映する。

修正対象はベンチマーク combo のコマンドテンプレート・config が中心:
- `benchmarks/<combo>/commands/poor-dev.*.md`
- `benchmarks/<combo>/.opencode/command/poor-dev.*.md`
- `benchmarks/<combo>/.poor-dev/config.json`
- `lib/` 内のスクリプト（review-runner.sh, dispatch-step.sh 等）

修正前に対象ファイルのパーミッションを確認し、read-only の場合は `chmod u+w` で書き込み権限を追加する（ベンチ setup が read-only にするため）。

各修正について:
1. 対象ファイルを Read で読み込む
2. 分析の suggestion に基づき修正内容を決定
3. Edit で修正を適用
4. 修正内容を記録（Step 6 用）

## Step 5: Smoke Test

修正が影響するステップについて、archive から artifacts をコピーし、dispatch-step.sh で単一ステップを実行してテストする。

### 5a. テスト環境準備

```bash
COMBO_DIR="benchmarks/<combo>"
LATEST_RUN=$(ls -td "$COMBO_DIR/_runs"/*/ 2>/dev/null | head -1)

# spec dir 検出（pipeline-state.json の場所で判定）
SPEC_DIR=$(find "$LATEST_RUN" -name "pipeline-state.json" -exec dirname {} \; 2>/dev/null | while read d; do
  echo "$(jq -r '.updated // "1970-01-01"' "$d/pipeline-state.json" 2>/dev/null) $d"
done | sort | tail -1 | cut -d' ' -f2-)

if [ -z "$SPEC_DIR" ]; then
  echo "ERROR: spec dir が見つかりません"
fi
```

### 5b. ステップ別テスト実行

**影響ステップの特定**: 修正したファイルから影響するステップを推定する:
- `poor-dev.implement*.md` → implement をテスト
- `poor-dev.plan*.md` → plan をテスト
- `review-runner.sh` / `poor-dev.*review*.md` → 該当 review をテスト
- `config.json` → 最も影響の大きいステップをテスト

**テスト実行** (各影響ステップについて):

```bash
# compose-prompt でプロンプト生成
STEP="implement"  # テスト対象ステップ
COMMAND_FILE="$COMBO_DIR/commands/poor-dev.${STEP}-simple.md"
[ ! -f "$COMMAND_FILE" ] && COMMAND_FILE="$COMBO_DIR/commands/poor-dev.${STEP}.md"
[ ! -f "$COMMAND_FILE" ] && COMMAND_FILE="$COMBO_DIR/.opencode/command/poor-dev.${STEP}-simple.md"
[ ! -f "$COMMAND_FILE" ] && COMMAND_FILE="$COMBO_DIR/.opencode/command/poor-dev.${STEP}.md"

PROMPT_FILE="/tmp/repair-test-prompt-$$.txt"

COMPOSE_ARGS=("$COMMAND_FILE" "$PROMPT_FILE" --header non_interactive)
[ -f "$SPEC_DIR/tasks.md" ] && COMPOSE_ARGS+=(--context "tasks=$SPEC_DIR/tasks.md")
[ -f "$SPEC_DIR/plan.md" ] && COMPOSE_ARGS+=(--context "plan=$SPEC_DIR/plan.md")
[ -f "$SPEC_DIR/spec.md" ] && COMPOSE_ARGS+=(--context "spec=$SPEC_DIR/spec.md")

bash "$COMBO_DIR/lib/compose-prompt.sh" "${COMPOSE_ARGS[@]}"

# dispatch-step.sh でテスト実行
IDLE_TIMEOUT=$(jq -r '.polling.idle_timeout // 300' "$COMBO_DIR/.poor-dev/config.json")
MAX_TIMEOUT=$(jq -r --arg s "$STEP" '.polling.step_timeouts[$s].max_timeout // .polling.max_timeout // 600' "$COMBO_DIR/.poor-dev/config.json")
RESULT_FILE="/tmp/repair-test-result-$$.json"

bash "$COMBO_DIR/lib/dispatch-step.sh" "$STEP" "$COMBO_DIR" "$PROMPT_FILE" \
  "$IDLE_TIMEOUT" "$MAX_TIMEOUT" "$RESULT_FILE"
```

### 5c. テスト結果検証

ステップ別の検証基準:

- **implement**: `find $COMBO_DIR -name "*.js" -o -name "*.html" -o -name "*.css" | grep -v node_modules | grep -v _runs | grep -v lib` で生成ファイルを確認。1件以上あれば pass。
- **plan**: dispatch 出力テキストに `[PROGRESS: plan complete]` が含まれるか確認。
- **review 系**: review 出力に issues セクションが含まれるか確認（空実行でないこと）。
- **specify**: `spec.md` が生成されたか確認。

テスト結果をユーザーに報告:
```
### Smoke Test 結果
| Step | Status | Details |
|------|--------|---------|
| implement | PASS | 3 files generated |
| planreview | SKIP | not affected |
```

テスト後のクリーンアップ:
```bash
rm -f /tmp/repair-test-prompt-$$.txt /tmp/repair-test-result-$$.json
```

**注意**: smoke test はオプション。AskUserQuestion で「テストを実行しますか？」と確認してから実行する。テストは dispatch-step.sh を直接呼ぶため、pipeline-state.json には影響しない。

## Step 6: repair-log.yaml 記録

修正内容と結果を `LATEST_RUN/repair-log.yaml` に記録する。

```yaml
date: <ISO8601 date>
combo: <combo>
run: <run timestamp>
issues:
  - fingerprint: "<sha256_first8>"
    command: "<command file>"
    severity: "<H|M|L>"
    summary: "<issue summary>"
    fix_applied: "<description of fix>"
    test_result: "<pass|fail|skip>"
    files_modified:
      - "<relative file path>"
past_repairs_referenced:
  - run: "<previous run timestamp>"
    relevant_fixes:
      - "<fix description>"
```

## Step 7: 誘導メッセージ

修正が完了（または診断のみ）した場合、次のアクションを案内する:

```
## 次のステップ

修正を適用しました。フルベンチマークで検証してください:

    /bench <combo>

前回の結果と比較するには:
    /bench --results <combo>
```

修正なし（診断のみ）の場合:
```
## 診断完了

問題の詳細を確認し、必要に応じて手動で修正してください。
修正後のフルベンチマーク:

    /bench <combo>
```

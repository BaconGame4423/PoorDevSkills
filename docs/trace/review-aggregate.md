# Trace: review-aggregate.sh + review-log-update.sh

レビュー結果の集約とログ永続化を担う 2 ファイルのトレースドキュメント。
両ファイルとも呼び出しグラフの末端（リーフノード）であり、外部 bash スクリプトを呼ばない。

---

## review-aggregate.sh (183 行)

### 1. Input/Output Contract

**引数 (CLI)**:

| フラグ | 必須 | 説明 |
|---|---|---|
| `--output-dir` | Yes | ペルソナ出力ファイル (`.txt` / `.json`) が格納されたディレクトリ |
| `--log` | No | `review-log-{type}.yaml` のパス。固定済み Issue の読み込みと issues ファイル保存先の決定に使用 |
| `--id-prefix` | Yes | Issue ID の接頭辞 (例: `PR`, `QR`, `TR`) |
| `--next-id` | No | 次に割り当てる Issue ID の数値部分 (デフォルト: 1) |
| `--review-type` | No | レビュー種別文字列。issues ファイル名 `review-issues-{type}.txt` に使用 |

**出力 (stdout JSON)**: `[CONTRACT: AggregateResult]` (contracts.md 3 章)

```typescript
interface AggregateResult {
  total: number;
  C: number;
  H: number;
  M: number;
  L: number;
  next_id: number;
  issues_file: string;
  converged: boolean;
  verdicts: string;
}
```

**副作用**:
- `{log_dir}/review-issues-{type}.txt` に issues ファイルをコピー (L153-154)
- `{log_dir}/review-issues-latest.txt` にも同内容をコピー (L160) — 互換性維持のため常に latest も更新
- 一時ファイル `/tmp/poor-dev-issues-$$.XXXXXX` を作成・EXIT trap で削除 (L70-71)

---

### 2. Parsing Logic

#### 2a. Fixed-issue 収集 (L46-66)

`review-log.yaml` を行単位で走査し、`fixed:` ブロックから修正済み Issue ID を連想配列 `FIXED_ISSUES` に格納する。

```bash
declare -A FIXED_ISSUES
# fixed: ブロック開始を検知
if [[ "$line" =~ ^[[:space:]]*fixed: ]]; then
  IN_FIXED_BLOCK=true
# fixed ブロック内の "- ID" 行をパース
if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*([A-Z]+[0-9]+) ]]; then
  FIXED_ISSUES["${BASH_REMATCH[1]}"]=1
```

- 正規表現 `[A-Z]+[0-9]+` で ID を抽出（例: `QR001`, `PR042`）
- `fixed:` 以外のキーに遭遇するとブロック終了 (`IN_FIXED_BLOCK=false`)
- YAML の全 iteration の `fixed:` ブロックを走査するため、過去全世代の修正済み ID が収集される

#### 2b. ペルソナ出力パース (L80-131)

`$OUTPUT_DIR` 配下の `*.txt` と `*.json` を glob で列挙し、各ファイルからペルソナ名・VERDICT・ISSUE を抽出する。

**コンテンツ抽出** (L85-89):
1. まず opencode JSON 形式を試行: `jq -r 'select(.type=="text") | .part.text // empty'`
2. jq 失敗時またはコンテンツ空の場合はプレーンテキストとして `cat` で読み込み

**VERDICT 抽出** (L92):
```bash
grep -oP '^VERDICT:\s*\K(GO|CONDITIONAL|NO-GO)' | head -1
```
- `head -1` により、万が一複数 VERDICT 行がある場合は最初のものだけ採用
- verdicts 文字列はスペース区切りで `{persona}:{verdict}` 形式に連結 (L94)

**ISSUE 抽出** (L98-130):
```bash
[[ "$line" =~ ^ISSUE:[[:space:]]*(C|H|M|L)[[:space:]]*\|[[:space:]]*(.*)\|[[:space:]]*(.*) ]]
```
- SEVERITY: `C|H|M|L` (グループ 1)
- DESCRIPTION: パイプ `|` 間のテキスト (グループ 2)、`xargs` でトリム
- LOCATION: 最後のパイプ以降のテキスト (グループ 3)、`xargs` でトリム

---

### 3. Deduplication Logic

#### Dedup 1: Fixed-issue dedup (L104-106)

**[BUG] 未実装**: `FIXED_ISSUES` 連想配列は L48-66 で構築されるが、L104-106 では実際のチェックが行われていない。

```bash
# --- Dedup 1: Fixed-issue (ID ベース。location ベース比較は review-log に
# location 情報が保存されるようになるまで保留) ---
SKIP=false
```

`SKIP=false` が無条件に設定されるため、過去に修正済みとして記録された Issue が新しい iteration で再出現しても除外されない。コメントには「location ベース比較は保留」とあるが、ID ベースの比較すら実装されていない。

#### Dedup 2: Cross-persona dedup (L108-113)

同一 iteration 内で、複数ペルソナが同じ LOCATION の Issue を報告した場合に重複除外する。

```bash
if [[ "$SKIP" == "false" && -s "$ISSUES_FILE" ]]; then
  if cut -d'|' -f4 "$ISSUES_FILE" 2>/dev/null | grep -qxF "$LOCATION"; then
    SKIP=true
  fi
fi
```

- `cut -d'|' -f4` で既存 issues ファイルの LOCATION 列を抽出
- `grep -qxF` による完全一致（部分一致ではない）
- 先に処理されたペルソナの Issue が優先される（glob 展開順に依存）

---

### 4. Convergence Logic (L133-138)

```bash
CONVERGED=false
if [[ "$COUNT_C" -eq 0 && "$COUNT_H" -eq 0 ]]; then
  CONVERGED=true
fi
```

- **収束条件**: Critical (C) と High (H) の両方が 0 件
- Medium (M) と Low (L) は収束判定に影響しない
- `review-runner.sh` はこの `converged` フラグでレビューループ終了を判定する

---

### 5. [BUG] markers

#### BUG-AGG-1: Fixed-issue dedup 未実装 (L104-106)

`FIXED_ISSUES` 連想配列は構築されるが、Issue 判定時にチェックされない。`SKIP=false` がハードコードされている。

**影響**: 過去 iteration で修正済みの Issue が、同一 location で再報告された場合に新規 Issue として再登録される。Issue ID は新たに発番されるため、review-log 上は別 Issue として扱われる。

**修正案**: L106 の後に以下を追加:
```bash
# ID ベース dedup は不可能（新 Issue にはまだ ID がない）。
# location ベースで FIXED_ISSUES の iteration 内 issue location と比較する必要がある。
```
ただし、現在の `FIXED_ISSUES` は ID のみを格納しており location 情報を持たないため、ID ベースの dedup も location ベースの dedup も実装できない状態にある。review-log の構造変更が前提条件。

#### BUG-AGG-2: Verdict 一貫性チェックが警告のみ (L145-147)

```bash
if [[ "$NOGO_COUNT" -gt 0 && "$TOTAL" -eq 0 ]]; then
  echo "{\"warning\":\"NO-GO verdict but zero issues found\"}" >&2
fi
```

- NO-GO verdict を出したペルソナがいても、Issue が 0 件なら `converged=true` が返る
- 警告は stderr に JSON 形式で出力されるが、呼び出し元 (`review-runner.sh`) はこれを処理していない
- **影響**: ペルソナが NO-GO と判定しても、具体的な ISSUE 行を出力しなければレビューは収束扱いになる

#### BUG-AGG-3: Temp file cleanup と cp の競合 (L71 trap vs L158 cp)

```bash
trap 'rm -f "$ISSUES_FILE"' EXIT     # L71
cp "$ISSUES_FILE" "$STABLE_ISSUES"   # L158
```

- `cp` が正常完了すれば問題ないが、`cp` がディスク容量不足等で失敗した場合、EXIT trap で一時ファイルも削除されるためデータが完全に失われる
- 実用上は低リスクだが、TS 移行時には try-finally で安全に処理すべき

---

## review-log-update.sh (91 行)

### 6. Log Update Logic

**引数 (CLI)**:

| フラグ | 必須 | 説明 |
|---|---|---|
| `--log` | Yes | `review-log-{type}.yaml` のパス |
| `--issues-file` | No | pipe-delimited issues ファイルのパス |
| `--verdicts` | No | verdicts 文字列 (例: `"persona1:GO persona2:NO-GO"`) |
| `--iteration` | Yes | iteration 番号 |
| `--fixed` | No | 前回 iteration で fix された Issue ID のカンマ区切り文字列 |

**出力 (stdout)**: 更新後の `review-log.yaml` のパス

#### 6a. ログ初期化 (L41-49)

ファイルが存在しない場合、ヘッダーと `iterations:` キーを含む新規ファイルを作成:

```yaml
# Review Log
# Auto-generated by review-runner.sh
created: 2026-02-19T12:00:00Z
iterations:
```

#### 6b. Legacy 修正 (L53-55)

過去バージョンが `iterations: []` (空配列リテラル) を出力していたケースに対応:

```bash
if grep -q '^iterations: \[\]$' "$LOG_PATH" 2>/dev/null; then
  sed -i 's/^iterations: \[\]$/iterations:/' "$LOG_PATH"
fi
```

`[]` を除去して YAML block sequence 形式に変換。

#### 6c. Iteration ブロック追記 (L59-88)

`>> "$LOG_PATH"` で直接追記。以下の構造を出力:

1. iteration 番号と timestamp (L61-62)
2. verdicts 文字列 (L63)
3. issues ブロック: issues ファイルが存在すれば行ごとにパース、なければ `issues: []` (L66-77)
4. fixed ブロック: `--fixed` が指定されていればカンマ区切りで分割して列挙 (L80-87)

---

### 7. YAML Output Structure

`[CONTRACT: ReviewLogEntry]` (contracts.md 4 章)

```typescript
interface ReviewLogIteration {
  iteration: number;
  timestamp: string;       // ISO 8601 UTC
  verdicts: string;
  issues: ReviewLogIssue[];
  fixed?: string[];
}

interface ReviewLogIssue {
  id: string;
  severity: string;
  description: string;
  location: string;
  persona: string;
}
```

**Issues パース** (L68-74): pipe-delimited ファイルから `IFS='|'` で 5 フィールドを分割:

```bash
while IFS='|' read -r id severity description location persona; do
  echo "      - id: $id"
  echo "        severity: $severity"
  echo "        description: \"$description\""
  echo "        location: \"$location\""
  echo "        persona: $persona"
done < "$ISSUES_FILE"
```

- `description` と `location` はダブルクォートで囲む
- `id`, `severity`, `persona` はクォートなし

**Fixed IDs パース** (L80-87): カンマ区切り文字列を配列に分割:

```bash
IFS=',' read -ra FIXED_ARRAY <<< "$FIXED_IDS"
for fid in "${FIXED_ARRAY[@]}"; do
  fid=$(echo "$fid" | xargs)  # トリム
  [[ -n "$fid" ]] && echo "      - $fid"
done
```

---

### 8. [BUG] markers

#### BUG-LOG-1: YAML injection リスク (L72-73)

```bash
echo "        description: \"$description\""
echo "        location: \"$location\""
```

description と location はペルソナの出力（LLM 生成テキスト）から直接取得される。以下の文字を含む場合、YAML が壊れる:

- ダブルクォート `"` — クォートが閉じてしまう
- バックスラッシュ `\` — エスケープシーケンスとして解釈される
- YAML 特殊文字 (`:`, `#`, `{`, `}`, `[`, `]`) — クォート内なら問題ないが、`"` でクォートが壊れた後に出現すると致命的

**影響**: `review-aggregate.sh` の Fixed-issue 収集 (L46-66) が壊れた YAML を正しくパースできなくなり、次の iteration で全 Issue が「未修正」として再出現する可能性がある。

**修正案**: YAML の description/location 値をシングルクォートで囲む、または特殊文字をエスケープする処理を追加。TS 移行時には YAML ライブラリ (js-yaml 等) を使用する。

#### BUG-LOG-2: アトミック書き込みなし (L88)

```bash
} >> "$LOG_PATH"
```

- ブレース内の複数 echo をリダイレクトでまとめているが、プロセス中断時に部分書き込みが発生する
- YAML は構造的に末尾が重要なため、中途半端な書き込みでファイル全体が不正になる
- **影響**: 中断後の再開時に `review-aggregate.sh` の YAML パース (L51-65) が予期しない動作をする

**修正案**: 一時ファイルに書き出してから `mv` でアトミックに置換する。ただし追記操作のため、全内容を読み直す必要がある。TS 移行時に対応が現実的。

---

### 9. [CONTRACT] markers

| マーカー | ファイル | 行 | contracts.md 参照 |
|---|---|---|---|
| `[CONTRACT: AggregateResult]` | `review-aggregate.sh` | L165-182 (jq 出力) | 3 章 AggregateResult |
| `[CONTRACT: ReviewLogEntry]` | `review-log-update.sh` | L59-88 (YAML 追記ブロック) | 4 章 ReviewLogEntry |

**AggregateResult** (review-aggregate.sh L165-182):

```bash
jq -n \
  --argjson total "$TOTAL" \
  --argjson c "$COUNT_C" \
  --argjson h "$COUNT_H" \
  --argjson m "$COUNT_M" \
  --argjson l "$COUNT_L" \
  --argjson next_id "$NEXT_ID" \
  --arg issues_file "${STABLE_ISSUES:-$ISSUES_FILE}" \
  --argjson converged "$CONVERGED" \
  --arg verdicts "$VERDICTS" \
  '{ total: $total, C: $c, H: $h, M: $m, L: $l,
     next_id: $next_id, issues_file: $issues_file,
     converged: $converged, verdicts: $verdicts }'
```

**ReviewLogEntry** (review-log-update.sh): 直接 echo で YAML を構築。型の保証はなく、フィールドの存在チェックもない。

---

### 10. [KEEP-BASH] boundaries

両ファイルとも **外部 bash スクリプトを呼び出さない** リーフノードである。

| ファイル | source | 外部コマンド |
|---|---|---|
| `review-aggregate.sh` | `utils.sh` (`die` 関数) | `jq`, `grep`, `cut`, `mktemp`, `cp`, `xargs` |
| `review-log-update.sh` | `utils.sh` (`die` 関数) | `date`, `grep`, `sed`, `mkdir`, `xargs` |

**呼び出し元**: `review-runner.sh` から bash 呼び出し:
```
review-runner.sh
  ├── review-aggregate.sh (bash 呼び出し)
  └── review-log-update.sh (bash 呼び出し)
```

**TS 移行時の注意点**:
- `review-aggregate.sh` の jq 依存は TS 移行で自然に解消される（JSON.stringify で置換）
- `review-log-update.sh` の YAML 出力は js-yaml 等のライブラリに置換し、BUG-LOG-1 (injection) と BUG-LOG-2 (atomic write) を同時に解消する
- 両ファイルとも `utils.sh` の `die` のみ source しているため、移行時の依存切断は容易
- `review-aggregate.sh` の `FIXED_ISSUES` 連想配列ロジック (BUG-AGG-1) は TS 移行時に `Map<string, boolean>` で正しく実装する

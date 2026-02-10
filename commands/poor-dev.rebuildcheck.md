---
description: "Rebuild check: analyze prototype health signals and determine CONTINUE or REBUILD."
handoffs:
  - label: Harvest Learnings
    agent: poor-dev.harvest
    prompt: Harvest learnings from the prototype and prepare for rebuild
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

プロトタイプの健全性を 4 つのシグナルで分析し、**CONTINUE**（開発続行）か **REBUILD**（知見を収穫して再構築）かを判定する。

## Operating Constraints

**STRICTLY READ-ONLY**: ファイルの変更は行わない。分析レポートを出力し、判定結果に基づいてハンドオフを提案する。

## Execution Steps

### 1. Initialize Analysis Context

現在のブランチとディレクトリを特定:

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
```

- ブランチ名から数字プレフィクスを抽出
- Feature ディレクトリを検索: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
- Feature ディレクトリがない場合はプロジェクトルートを対象として分析を続行

### 2. Signal Analysis

4 つのシグナルを計測する。

#### Signal 1: Change Locality Loss（変更局所性の喪失）

直近のコミットで、1 変更あたりの修正ファイル数を分析する。

```bash
# 直近 10 コミットの変更ファイル数
git log --oneline --stat -10
```

計測: 各コミットの変更ファイル数を抽出し、平均を算出。

| スコア | 条件 |
|--------|------|
| GREEN | 平均 2 ファイル以下/コミット |
| YELLOW | 平均 2-3 ファイル/コミット |
| RED | 平均 3 ファイル超/コミット |

#### Signal 2: Fix Oscillation（修正の振り子）

同一ファイルが直近のコミットで繰り返し修正されているかを検出する。

```bash
# 直近 10 コミットで変更されたファイルの頻度
git log --name-only --oneline -10 | grep -v '^[a-f0-9]' | sort | uniq -c | sort -rn | head -10
```

計測: 直近 10 コミット中、3 回以上修正されたファイルの数。

| スコア | 条件 |
|--------|------|
| GREEN | 3 回以上修正されたファイルなし |
| YELLOW | 1-2 ファイルが 3 回以上修正 |
| RED | 3 ファイル以上が 3 回以上修正 |

#### Signal 3: Context Bloat（コンテキスト肥大化）

プロジェクトの CLAUDE.md の注意事項・前提条件の数を分析する。

```bash
# CLAUDE.md の見出し・リスト項目数をカウント
wc -l CLAUDE.md 2>/dev/null
```

計測: CLAUDE.md の行数と、注意事項パターン（`- `, `* `, 番号リスト）の数。

| スコア | 条件 |
|--------|------|
| GREEN | 注意事項 5 個未満 |
| YELLOW | 注意事項 5-10 個 |
| RED | 注意事項 10 個超 |

CLAUDE.md が存在しない場合は GREEN とする。

#### Signal 4: Hotspot Analysis（ホットスポット）

Tornhill のホットスポット分析を簡易実装: `変更頻度 × ファイル行数` で問題箇所を特定する。

```bash
# 変更頻度（直近 30 コミット）
git log --name-only --oneline -30 | grep -v '^[a-f0-9]' | sort | uniq -c | sort -rn | head -10

# 各ファイルの行数
wc -l <file>
```

計測:
1. 各ファイルの変更頻度を取得
2. 各ファイルの行数を取得
3. `hotspot_score = frequency × lines` を算出
4. 上位 5 ファイルをリスト化
5. 上位ファイルのスコアが 2 位以下の 3 倍以上なら突出と判定

| スコア | 条件 |
|--------|------|
| GREEN | 突出したホットスポットなし |
| YELLOW | 1 ファイルが突出 |
| RED | 2 ファイル以上が突出 |

### 3. Scoring & Verdict

#### スコア表の出力

```markdown
## Rebuild Check Report

| # | Signal | Score | Detail |
|---|--------|-------|--------|
| 1 | Change Locality | [GREEN/YELLOW/RED] | 平均 X ファイル/コミット |
| 2 | Fix Oscillation | [GREEN/YELLOW/RED] | Y ファイルが 3 回以上修正 |
| 3 | Context Bloat | [GREEN/YELLOW/RED] | Z 個の注意事項 |
| 4 | Hotspot | [GREEN/YELLOW/RED] | 上位: [ファイル名] |
```

#### ホットスポット上位 5 ファイル

```markdown
### Hotspot Top 5

| # | File | Frequency | Lines | Score |
|---|------|-----------|-------|-------|
| 1 | ... | ... | ... | ... |
```

#### 総合判定

| 判定 | 条件 |
|------|------|
| **CONTINUE** | RED が 0 個、かつ YELLOW が 2 個以下 |
| **REBUILD** | RED が 1 個以上、または YELLOW が 3 個以上 |

### 4. Verdict Output

#### CONTINUE の場合

```markdown
## Verdict: CONTINUE

プロトタイプはまだ健全です。開発を続行してください。

次にシグナルが悪化したら再度 `/poor-dev.rebuildcheck` を実行してください。
```

#### REBUILD の場合

```markdown
## Verdict: REBUILD

プロトタイプから十分な知見が得られました。再構築を推奨します。

### Knowledge Summary

**動いている機能**:
- [プロトタイプで実現できた機能]

**困難だった点**:
- [繰り返し修正が必要だった箇所とその理由]

**本当の要件**:
- [プロトタイプを通じて判明した、当初想定と異なる要件]

Next: `/poor-dev.harvest` で知見を収穫し、再構築を開始します。
```

REBUILD 判定時は `/poor-dev.harvest` へのハンドオフを提案する。

### 5. Edge Cases

- **git 履歴が 10 コミット未満**: 利用可能なコミット数で分析する。コミット数が 3 未満の場合は「データ不足」として全シグナル GREEN、判定 CONTINUE とする。
- **ソースファイルがない場合**: Signal 4（ホットスポット）は GREEN とする。
- **CLAUDE.md がない場合**: Signal 3（コンテキスト肥大化）は GREEN とする。

## Threshold Note

上記の閾値（3 ファイル、3 回修正、5 注意事項、3 倍突出）は初期値です。実運用で調整が必要な場合は、このファイルの閾値を直接変更してください。

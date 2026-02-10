---
description: "Harvest learnings from prototype and prepare for rebuild: generate learnings, constitution, and spec."
handoffs:
  - label: Build Technical Plan
    agent: poor-dev.plan
    prompt: Create a plan based on the harvested spec
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

プロトタイプから知見を収穫し、再構築に必要な成果物（learnings.md, constitution.md, spec.md）を生成する。第二システム症候群を防ぎながら、プロトタイプで検証済みの機能のみを次の実装スコープに含める。

## Execution Steps

### Step 1: Initialize Context

現在のブランチとディレクトリを特定:

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
```

- ブランチ名から数字プレフィクスを抽出
- Feature ディレクトリを検索: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
- Feature ディレクトリがない場合、`specs/` 配下に現在のブランチ名でディレクトリを作成

discovery-memo.md が存在すれば読み込んで参照する。

### Step 2: Prototype Analysis

#### 2a. Functionality Inventory

プロトタイプで動作している機能を洗い出す:

```bash
# ファイル構成の把握
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.rs" -o -name "*.java" \) | head -50

# エントリポイント・主要モジュールの特定
ls -la src/ app/ lib/ 2>/dev/null
```

各ファイルを読み、動作機能の一覧を作成する。

#### 2b. Pain Point Extraction

git 履歴からペインポイントを抽出:

```bash
# ホットスポット上位ファイル
git log --name-only --oneline -30 | grep -v '^[a-f0-9]' | sort | uniq -c | sort -rn | head -10

# revert パターンの検出
git log --oneline --all | grep -i 'revert\|undo\|rollback\|fix.*fix\|re-'
```

#### 2c. Requirements Gap Analysis

discovery-memo.md（存在する場合）の「当初の想定」と、プロトタイプの実態を比較:

- 想定通りに実現できた機能
- 想定と異なった機能・要件
- 新たに発見された要件

### Step 3: Learnings Document

`$FEATURE_DIR/learnings.md` を生成する:

```markdown
# Learnings: [PROJECT/FEATURE NAME]

**Created**: [DATE]
**Branch**: `[NNN-short-name]`
**Prototype commits**: [コミット数]
**Prototype period**: [最古コミット日] - [最新コミット日]

## Working Features

<!-- プロトタイプで検証済みの動作機能 -->

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | [機能名] | Working | [補足] |
| 2 | [機能名] | Partial | [動作範囲と制限] |

## Discovered Difficulties

<!-- プロトタイプで判明した困難 -->

| # | Difficulty | Impact | Root Cause |
|---|-----------|--------|------------|
| 1 | [困難] | [影響範囲] | [根本原因の推定] |

## True Requirements

<!-- プロトタイプを通じて判明した本当の要件 -->

### Originally Expected
- [当初想定していた要件]

### Actually Needed
- [実際に必要だった要件]

### Not Needed
- [不要と判明した要件]

## Technical Insights

### Approaches That Worked
- [有効だったアプローチ]

### Approaches That Failed
- [うまくいかなかったアプローチとその理由]

### Key Decisions for Rebuild
- [再構築時に活かすべき判断]
```

ユーザーにレビューを依頼:
- "知見ドキュメントの内容を確認してください。追加・修正があれば教えてください。"

### Step 4: Constitution Generation

プロトタイプのペインポイントから設計原則を導出し、`constitution.md` を生成する。

#### 4a. Principle Derivation

ペインポイントから原則を導出するパターン:

| ペインポイント | 導出される原則 |
|--------------|--------------|
| 状態管理が混乱 | 「状態は一箇所で管理する」 |
| 変更が全ファイルに波及 | 「変更の局所性を保つ」 |
| エラーハンドリングが散在 | 「エラー処理を統一する」 |
| テストなしで壊れた | 「重要パスはテストファーストで実装する」 |
| 命名がバラバラ | 「命名規約を統一する」 |

上記はサンプル。実際のペインポイントから 3-7 個の原則を導出する。

#### 4b. Constitution Writing

`poor-dev.constitution` テンプレート形式に準拠して `constitution.md` を生成する。

既に `constitution.md` が存在する場合:
- 既存の原則を尊重し、プロトタイプから得た原則を **追加** する
- 矛盾する場合はユーザーに確認する

constitution.md が存在しない場合:
- 新規作成する

#### 4c. User Review

ユーザーに constitution をレビューしてもらう:
- "プロトタイプの経験から以下の原則を導出しました。調整が必要な場合は教えてください。"
- 調整を反映してから確定する

### Step 5: Specification Generation

`$FEATURE_DIR/spec.md` を `poor-dev.specify` テンプレート形式で生成する。

#### 5a. Scope Definition

**第二システム症候群ガード**:

ユーザーに以下の警告を提示:

```
重要: リビルドは「同じものをきれいに作り直す」ことです。
新機能を足す場ではありません。

P1（MVP）にはプロトタイプで検証済みの機能のみを含めます。
「あったらいいな」の未検証アイデアは P2/P3 に分類します。
```

#### 5b. Spec Content

- **P1（MVP）**: プロトタイプで **検証済み** の機能（learnings.md の Working Features）
- **P2**: プロトタイプで **部分的に動作** した機能（Partial status）
- **P3**: 発見されたが **未検証** の要件

User Stories は learnings.md の Working Features から導出する。
Requirements は learnings.md の True Requirements（Actually Needed）から導出する。
Edge Cases は learnings.md の Discovered Difficulties から導出する。

#### 5c. Spec Writing

`poor-dev.specify` のテンプレートに従って spec.md を生成する:

```markdown
# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`
**Created**: [DATE]
**Status**: Draft (Rebuild from prototype)
**Input**: Harvested from prototype learnings

## User Scenarios & Testing *(mandatory)*

### User Story 1 - [Brief Title] (Priority: P1)

[Working Features から導出]

...

## Requirements *(mandatory)*

### Functional Requirements

[True Requirements の Actually Needed から導出]

...

## Success Criteria *(mandatory)*

[プロトタイプで検証済みの指標から導出]

...
```

### Step 6: Handoff

完了報告:

```markdown
## Harvest Complete

### Generated Artifacts

| # | File | Content |
|---|------|---------|
| 1 | `$FEATURE_DIR/learnings.md` | プロトタイプの知見 |
| 2 | `constitution.md` | 設計原則（ペインポイントから導出） |
| 3 | `$FEATURE_DIR/spec.md` | 再構築用の仕様書 |

### Scope Summary

- **P1 (MVP)**: [検証済み機能の数] features
- **P2**: [部分動作機能の数] features
- **P3**: [未検証要件の数] requirements

### Next Step

`/poor-dev.plan` で技術計画を作成し、標準の機能開発フローに合流します。
```

Next: `/poor-dev.plan` にハンドオフ。

## Operating Principles

- **学びを最大化**: コードではなく「何を学んだか」にフォーカスする
- **第二システム症候群の防止**: P1 は検証済み機能のみ。未検証のアイデアは P2/P3
- **Constitution は経験から**: 抽象的な原則ではなく、具体的なペインポイントから導出する
- **ユーザーレビュー必須**: learnings, constitution, spec の各段階でユーザー確認を取る

---
description: "Discovery flow: explore ideas through prototyping and learn from existing code."
handoffs:
  - label: Rebuild Check
    agent: poor-dev.rebuildcheck
    prompt: Run rebuild check on the current prototype
    send: true
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification based on discoveries
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

探索フロー開始コマンド。「まず作って、壊して、知見をもとに再構築する」サイクルの入口。

### Step 0: Existing Code Detection

既存のソースコードの有無を検出し、Mode A / Mode B に分岐する。

1. ソースコードの存在チェック:
   ```bash
   # 代表的なソースディレクトリ・ファイルの有無
   ls -d src/ app/ lib/ 2>/dev/null
   find . -maxdepth 3 -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.rb" -o -name "*.php" 2>/dev/null | head -5
   ```
2. git 履歴の確認:
   ```bash
   git log --oneline 2>/dev/null | wc -l
   ```
3. 判定:
   - ソースファイルが **存在しない** OR git コミットが **5 件以下** → **Mode A**（ゼロから始める）
   - ソースファイルが **存在する** AND git コミットが **6 件以上** → **Mode B**（既存コードから始める）

---

### Mode A: ゼロから始める

#### Step A1: Branch & Directory Creation

1. Generate a concise short name (2-4 words) from `$ARGUMENTS`
2. Check existing branches and determine next available number:
   ```bash
   git fetch --all --prune
   ```
   - Remote branches: `git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+-'`
   - Local branches: `git branch | grep -E '^[* ]*[0-9]+-'`
   - Specs directories: Check for directories matching `specs/[0-9]+-*`
3. Create branch and directory:
   ```bash
   git checkout -b NNN-short-name
   mkdir -p specs/NNN-short-name
   ```

#### Step A2: Discovery Memo

ユーザー入力（アイデア・設計メモ）をもとに `$FEATURE_DIR/discovery-memo.md` を作成する。

テンプレート:

```markdown
# Discovery Memo: [PROJECT/FEATURE NAME]

**Created**: [DATE]
**Mode**: Zero-start (Mode A)
**Branch**: `[NNN-short-name]`

## Idea

<!-- ユーザーの入力をもとに記述 -->

## What We Want to Learn

<!-- このプロトタイプで検証したいこと -->

1.
2.
3.

## Known Unknowns

<!-- 分からないこと・不確実なこと -->

-

## Constraints

<!-- 技術的制約・時間的制約など -->

-
```

ユーザーに追加の質問（`AskUserQuestion`）:

**Question 1**: 目的
- "このプロトタイプで一番検証したいことは何ですか？"

**Question 2**: 制約
- "技術的な制約や使いたい技術はありますか？"
- Options: 特になし / 言語指定あり / フレームワーク指定あり / その他

回答をもとに discovery-memo.md を埋める。

#### Step A3: CLAUDE.md Rebuild Trigger

プロジェクトの CLAUDE.md に以下のセクションを追記する（既にある場合はスキップ）:

```markdown
## リビルドトリガー（探索フロー）

以下のシグナルを検知したら `/poor-dev.rebuildcheck` の実行を提案してください：

1. **変更の局所性の喪失**: 1 変更に 3 ファイル以上の修正が必要
2. **修正の振り子**: 直近 3 変更で同ファイルを 2 回以上修正
3. **コンテキストの肥大化**: 指示の前提条件・注意事項が 5 つ以上

提案時は「この辺にしよか」というトーンで、得られた知見を整理して提示してください。
```

CLAUDE.md が存在しない場合は新規作成する。既に「リビルドトリガー」セクションがある場合は追記しない。

#### Step A4: Guidance & Handoff

ユーザーに以下のガイドラインを提示:

```
探索フローを開始しました。

ガイドライン:
- 保守性を気にせず、動くものを最優先で作ってください
- コードではなく「何が難しいか」を発見するのが目的です
- 完璧を目指さず、学びを最大化してください

CLAUDE.md にリビルドトリガーを設定しました。
シグナルを検知したら「この辺にしよか」と提案します。

手動でリビルド判定をしたい場合: /poor-dev.rebuildcheck
```

---

### Mode B: Existing Code

#### Step B1: Branch & Directory Creation

Mode A の Step A1 と同じ手順でブランチ・ディレクトリを作成する。

#### Step B2: Codebase Scan & Discovery Memo

既存コードを簡易スキャンし、`$FEATURE_DIR/discovery-memo.md` を作成する。

スキャン対象:
- ファイル構成: `find . -type f -name "*.{py,ts,js,go,rs,java}" | head -30`
- 言語・フレームワーク検出: package.json, requirements.txt, Cargo.toml, go.mod 等
- エントリポイント推定: main.*, index.*, app.* 等
- git 履歴の規模: コミット数、最古・最新コミット日、コントリビューター数

テンプレート:

```markdown
# Discovery Memo: [PROJECT/FEATURE NAME]

**Created**: [DATE]
**Mode**: Existing code (Mode B)
**Branch**: `[NNN-short-name]`

## Codebase Overview

- **Languages**: [検出した言語]
- **Framework**: [検出したフレームワーク]
- **File count**: [ソースファイル数]
- **Git history**: [コミット数] commits over [期間]

## File Structure

<!-- 主要ディレクトリ・ファイルの構成 -->

```
[tree 出力 or 手動整理]
```

## Detected Functionality

<!-- 推定される機能一覧 -->

1.
2.
3.

## Initial Observations

<!-- コードを見て気づいたこと -->

-
```

#### Step B3: CLAUDE.md Rebuild Trigger

Mode A の Step A3 と同じ手順で CLAUDE.md にリビルドトリガーを追記する。

#### Step B4: User Choice

ユーザーに選択肢を提示（`AskUserQuestion`）:

- question: "既存コードをどうしますか？"
- options:
  1. "機能追加を続ける" -- バイブコーディングを継続
  2. "リビルド判定を実行する" -- `/poor-dev.rebuildcheck` へ
  3. "すぐに再構築する" -- `/poor-dev.harvest` へ

選択に応じてハンドオフ:
- "機能追加を続ける" → ガイドライン提示（Mode A Step A4 と同様）して自由コーディングへ
- "リビルド判定を実行する" → `/poor-dev.rebuildcheck` にハンドオフ
- "すぐに再構築する" → `/poor-dev.harvest` にハンドオフ

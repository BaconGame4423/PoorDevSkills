# Discovery Memo: poor-dev.config UI設定可能性調査

**Created**: 2025-02-10
**Mode**: Existing code (Mode B)
**Branch**: `[002-poor-dev-config-ui]`

## Codebase Overview
- **Languages**: JavaScript (Node.js), Markdown
- **Framework**: poor-dev (AI workflow slash command framework)
- **File count**: ~50 files (commands, agents, templates, lib)
- **Git history**: 51 commits (活発に開発中)

## File Structure
```
/
├── bin/poor-dev.mjs          # CLI エントリーポイント
├── lib/installer.mjs         # init/update/status 実装
├── commands/                 # スラッシュコマンド定義（Markdown）
│   └── poor-dev.config.md    # 現在は Question ツール使用
├── agents/                   # エージェント定義
├── templates/                # テンプレートファイル
├── .poor-dev/config.json     # 設定ファイル
└── package.json              # Node.js パッケージ定義
```

## Detected Functionality
1. **poor-dev CLI**: npm パッケージとして配布されるCLIツール
2. **Slash commands**: OpenCode/Claude Code環境内で動作するMarkdownベースのコマンド
3. **Installer**: `init`, `update`, `status` サブコマンドを Node.js で実装
4. **Config management**: `.poor-dev/config.json` で CLI/モデル設定を管理

## Current Implementation of poor-dev.config

**Wizard Mode (問題の所在):**
- `/poor-dev.config` 引数なしで起動時、Question ツールを使用
- 設定項目（デフォルト変更、カテゴリ設定、エージェント設定、削除）をAIが対話的に質問
- OpenCode では `question` ツール、Claude Code では `AskUserQuestion` ツール

**Subcommands (AI未使用で動作):**
- `show` - 現在の設定を表示
- `default <cli> <model>` - デフォルト設定
- `set <key> <cli> <model>` - 上書き設定追加
- `unset <key>` - 上書き設定削除
- `reset` - 全設定リセット

## Initial Observations

**問題の分析:**
- poor-dev 自体が AI 環境内で動作するフレームワーク
- スラッシュコマンドは AI が Markdown を解釈して実行
- Question ツールも AI の機能の一部（対話的プロンプト）
- 「AIを介さずにUIとして設定」の定義が曖昧

**実装可能なアプローチ:**

1. **Bash スクリプトによる端末メニュー** (推奨)
   - 既存の `bin/poor-dev.mjs` に `config-wizard` サブコマンドを追加
   - `select` コマンドまたは `dialog/whiptail` で対話的メニュー
   - AI に依存せず、純粋な CLI ツールとして動作
   - `npx poor-dev config-wizard` で起動

2. **Node.js TUI ライブラリの使用**
   - `inquirer` や `prompts` ライブラリで対話的UI
   - より洗練されたメニューデザインが可能
   - package.json に依存追加が必要

3. **Question ツール方式の削除**
   - Wizard Mode を完全削除
   - README で手動編集方法（subcommands 使用）をドキュメント化

4. **Web UI**
   - HTML フォームで設定生成
   - 過剰設計、メンテナンスコスト大

## What We Want to Learn
1. AI に依存しない UI 設定が本当に必要か？（ユーザーが本当に求めているものは？）
2. Bash スクリプトで十分な UX を提供できるか？
3. 現行の subcommands 方式で十分ではないか？
4. 実装コスト vs ベネフィット

## Known Unknowns
- ユーザーが「AIを介さず」と言う時の期待する UX は何か？
- 他の poor-dev ユーザーのニーズ
- TUI/Bash 方式の移植性

## Constraints
- 既存の subcommands 機能は維持（後方互換性）
- 新しい依存ライブラリは最小限に
- OpenCode/Claude Code 両方の環境で動作する必要なし（CLI ツールとして独立）
- poor-dev の設計理念を維持（シンプルさ）

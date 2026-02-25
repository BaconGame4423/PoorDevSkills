---
description: "Generate project reports and documentation from codebase analysis."
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

### Step 1: Determine Report Type

If `$ARGUMENTS` specifies a report type, use it. Otherwise, ask the user to choose:

- **Claude Code**: Use `AskUserQuestion` tool with:
  - question: "どのレポートを生成しますか？"
  - options:
    1. "プロジェクト概要" — README 的な全体概要レポート
    2. "アーキテクチャ" — コンポーネント構成・依存関係・データフロー
    3. "仕様一覧" — 全 spec.md のサマリーと状態一覧
    4. "進捗レポート" — 全フィーチャーの成果物ベース進捗集計
- **OpenCode**: Use `question` tool with the same content.

### Step 2: Gather Context

Based on the report type, read relevant files:

**プロジェクト概要**:
- `README.md`, `AGENT.md`, `constitution.md`
- `package.json` or equivalent project config
- Scan top-level directory structure

**アーキテクチャ**:
- `commands/poor-dev.*.md` — command definitions
- `agents/claude/` — agent definitions

**仕様一覧**:
- `specs/*/spec.md` — all feature specs

**進捗レポート**:
- Check `specs/*/` directories for available artifacts (spec.md, plan.md, tasks.md, checklists/)
- Aggregate: presence/absence of each artifact per feature to determine progress

### Step 3: Generate Report

Generate a structured markdown report with:

- Title and generation date
- Table of contents (for longer reports)
- Relevant sections based on report type
- Summary statistics where applicable
- References to source files

### Step 4: Save Report

Ask the user where to save the report:

- **Claude Code**: Use `AskUserQuestion` tool with:
  - question: "レポートの保存先を選択してください"
  - options:
    1. "表示のみ（ファイル保存なし）"
    2. "docs/ ディレクトリに保存"
    3. "プロジェクトルートに保存"
- **OpenCode**: Use `question` tool with the same content.

If saving, write the report to the chosen location with a descriptive filename (e.g., `docs/architecture-report-2024-01-15.md`).

## Guidelines

- **Read-only analysis** — do not modify existing files
- **Be comprehensive** — include all relevant details
- **Use tables** — present data in markdown tables for clarity
- **Include paths** — reference file locations for each finding
- **Language** — generate reports in Japanese by default (match user language if different)

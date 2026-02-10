---
description: "Select and start a development flow directly without intake classification."
handoffs:
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification for this feature request
    send: true
  - label: Bug Fix Investigation
    agent: poor-dev.bugfix
    prompt: Investigate and fix this bug report
    send: true
  - label: Roadmap Concept
    agent: poor-dev.concept
    prompt: Start roadmap concept exploration
    send: true
  - label: Discovery Flow
    agent: poor-dev.discovery
    prompt: Start discovery flow for exploration and prototyping
    send: true
  - label: Ask Question
    agent: poor-dev.ask
    prompt: Answer a question about the codebase
    send: true
  - label: Generate Report
    agent: poor-dev.report
    prompt: Generate a project report
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Outline

### Step 1: Flow Selection

If `$ARGUMENTS` contains `--flow-type <type>`, use that type directly and treat the remaining text as the description.

Otherwise, ask the user to choose a flow:

- **Claude Code**: Use `AskUserQuestion` tool with:
  - question: "どのフローを開始しますか？"
  - options:
    1. "探索 (discovery)" -- まず作って学ぶ / 既存コードを整理して再構築
    2. "機能開発 (feature)" -- 仕様→計画→実装→レビューの11ステップ
    3. "バグ修正 (bugfix)" -- 調査→実装→レビューの5ステップ
    4. "ロードマップ (roadmap)" -- コンセプト→ゴール→マイルストーン→ロードマップの4ステップ
- **OpenCode**: Use `question` tool with the same content.

Note: "質問応答 (ask)" and "レポート (report)" are also available if `$ARGUMENTS` contains `--flow-type ask` or `--flow-type report`.

### Step 2: Non-Pipeline Flows

If the user chose **ask** or **report**:
- Directly invoke `/poor-dev.ask` or `/poor-dev.report` with `$ARGUMENTS`
- End. Do not proceed to Step 3.

### Step 2b: Discovery Flow

If the user chose **discovery**:
- Directly invoke `/poor-dev.discovery` with `$ARGUMENTS`
- End. Do not proceed to Step 3. Discovery handles its own branch/directory creation.

### Step 3: Get Description

For pipeline flows (feature, bugfix, roadmap):

If `$ARGUMENTS` already contains a description (non-empty after removing `--flow-type`), use it.

Otherwise, ask the user:
- **Claude Code**: Use `AskUserQuestion` tool with:
  - question: "選択したフローの説明を入力してください"
  - (free text input -- the user provides their description)
- **OpenCode**: Use `question` tool.

### Step 4: Branch & Directory Creation

1. Generate a concise short name (2-4 words) from the description
2. Check existing branches and determine next available number:
   ```bash
   git fetch --all --prune
   ```
   - Remote branches: `git ls-remote --heads origin`
   - Local branches: `git branch`
   - Specs directories: `specs/`
3. Create branch and directory:
   ```bash
   git checkout -b NNN-short-name
   mkdir -p specs/NNN-short-name
   ```

### Step 5: State Initialization

Based on the chosen flow type:

**Feature**:
Report: Direct flow selection as feature. Next: `/poor-dev.specify`

**Bugfix**:
- Copy bug report template and fill initial info
- Create bug report in `$FEATURE_DIR/bug-report.md`
- Report flow selection as bugfix. Next: `/poor-dev.bugfix`

**Roadmap**:
Report flow selection as roadmap. Next: `/poor-dev.concept`

**Discovery**:
Report flow selection as discovery. Next: `/poor-dev.discovery`

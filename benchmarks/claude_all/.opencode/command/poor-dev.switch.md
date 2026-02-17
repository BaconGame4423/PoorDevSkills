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

If `$ARGUMENTS` contains `--flow-type <type>`, use that directly.

Otherwise, ask user (AskUserQuestion):
- "どのフローを開始しますか？"
- Options:
  1. "探索 (discovery)" — まず作って学ぶ / 既存コードを整理して再構築
  2. "機能開発 (feature)" — 仕様→計画→実装→レビューの11ステップ
  3. "バグ修正 (bugfix)" — 調査→実装→レビューの5ステップ
  4. "ロードマップ (roadmap)" — コンセプト→ゴール→マイルストーン→ロードマップの4ステップ

Also available via `--flow-type`: ask, report.

### Step 2: Non-Pipeline / Discovery Shortcuts

- **ask/report**: Invoke `/poor-dev.ask` or `/poor-dev.report` directly. End.
- **discovery**: Invoke `/poor-dev.discovery` directly. End. (Handles own branch.)

### Step 3: Get Description

For pipeline flows (feature, bugfix, roadmap): use description from `$ARGUMENTS` or ask user.

### Step 4: Branch & Directory Creation

Generate short name (2-4 words). Find highest branch number N. Use N+1.
```bash
git fetch --all --prune
git checkout -b NNN-short-name
mkdir -p specs/NNN-short-name
```

### Step 5: Route by Flow Type

- **Feature**: Report selection. Next: `/poor-dev.specify`
- **Bugfix**: Create `$FEATURE_DIR/bug-report.md` with template. Next: `/poor-dev.bugfix`
- **Roadmap**: Report selection. Next: `/poor-dev.concept`

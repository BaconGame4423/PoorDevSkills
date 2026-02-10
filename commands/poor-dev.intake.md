---
description: Intake user input and route to the appropriate flow: feature, bugfix, roadmap, discovery, Q&A, or documentation.
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

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after the command **is** the description of their request. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

Given that description, do this:

### Step 1: Input Classification

Analyze `$ARGUMENTS` and classify the user's intent through a 3-stage process.

**1a. Keyword Analysis**:
- **Feature signals**: "追加" "作成" "新しい" "実装" "対応" "〜したい" "〜できるように" "サポート" "導入" "add" "create" "new" "implement" "support" "introduce"
- **Bugfix signals**: "エラー" "バグ" "壊れ" "動かない" "失敗" "クラッシュ" "不具合" "修正" "おかしい" "regression" "500" "例外" "タイムアウト" "error" "bug" "broken" "fail" "crash" "fix"
- **Roadmap signals**: "ロードマップ" "企画" "構想" "コンセプト" "戦略" "方針" "ビジョン" "roadmap" "concept" "strategy" "vision" "planning" "計画策定" "方向性"
- **Discovery signals**: "探索" "プロトタイプ" "試作" "とりあえず作る" "バイブ" "試してみる" "スクラップ" "作り直し" "整理したい" "リビルド" "一から作り直す" "discovery" "prototype" "vibe" "explore" "scrap" "rebuild"
- **Q&A signals**: "教えて" "とは" "なぜ" "どうやって" "どこ" "何" "仕組み" "説明して" "？" "what" "why" "how" "where" "explain"
- **Documentation/Report signals**: "レポート" "報告" "ドキュメント" "文書化" "まとめ" "一覧" "概要" "document" "report" "summary" "overview"

**Priority rule**: Feature / Bugfix / Roadmap / Discovery signals take precedence over Q&A / Documentation signals. Example: "〜を実装するにはどうすれば？" → Feature (not Q&A), because "実装" is an action signal.

**1b. Contextual Analysis** (when keywords are ambiguous):
- Problem description pattern → bugfix ("〜が発生する" "〜になってしまう" "〜できない")
- Desired state pattern → feature ("〜がほしい" "〜を追加" "〜に対応")
- Planning/strategy pattern → roadmap ("〜の方針を決めたい" "〜の戦略を立てたい" "〜を企画する")
- Exploration pattern → discovery ("まだ固まっていない" "とりあえず動くもの" "試してみたい" "既存コードを整理" "作り直したい" "バイブコーディングで作った")
- Question pattern → Q&A ("〜とは何か" "〜について教えて" "〜の仕組みは？" "〜はどうなっている？")
- Documentation request pattern → Documentation ("〜をまとめて" "〜の一覧を作って" "〜のレポートを生成")
- Improvement/change pattern → ambiguous ("〜を改善" "〜を変更" "〜を最適化")

**1c. Confidence Rating**: High (clearly one type) / Medium (leans one way) / Low (cannot determine)

### Step 2: Clarification for Ambiguous Input

If confidence is Medium or below, ask the user to clarify:

- **Claude Code**: Use `AskUserQuestion` tool
- **OpenCode**: Use `question` tool
- Options:
  1. "機能リクエスト（新機能・拡張）"
  2. "バグ報告（既存機能の不具合・異常動作）"
  3. "ロードマップ・戦略策定（プロジェクト企画段階）"
  4. "探索・プロトタイプ（まず作って学ぶ / 既存コードを整理して再構築）"
  5. "質問・ドキュメント作成（パイプライン不要）"
  6. "もう少し詳しく説明する"
- If "もう少し詳しく" → receive additional explanation and re-classify from Step 1
- If option 4 selected (探索) → route to discovery (Step 4F)
- If option 5 selected, ask follow-up to distinguish:
  - Options:
    1. "質問応答 (ask)" — コードベースや仕様への質問に回答
    2. "ドキュメント生成 (report)" — プロジェクトレポート・ドキュメントを作成

**Non-pipeline shortcut**: If classified as **Q&A** or **Documentation**, skip Step 3 and jump directly to Step 4D / 4E. These flows do not require branch or directory creation.

**Discovery shortcut**: If classified as **discovery**, skip Step 3 and jump directly to Step 4F. Branch/directory creation is handled by `/poor-dev.discovery` itself.

### Step 3: Branch & Directory Creation (pipeline flows only)

Use the same approach as `poor-dev.specify` Steps 1-2:

1. **Generate a concise short name** (2-4 words):
   - Analyze the description and extract the most meaningful keywords
   - Feature: action-noun format (e.g., `user-auth`, `analytics-dashboard`)
   - Bugfix: `fix-` prefix (e.g., `fix-login-error`, `fix-payment-timeout`)
   - Preserve technical terms and acronyms
   - Keep it concise but descriptive

2. **Check for existing branches before creating new one**:

   a. Fetch all remote branches:
      ```bash
      git fetch --all --prune
      ```

   b. Find the highest feature number across all sources:
      - Remote branches: `git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+-'`
      - Local branches: `git branch | grep -E '^[* ]*[0-9]+-'`
      - Specs directories: Check for directories matching `specs/[0-9]+-*`

   c. Determine the next available number (highest N + 1)

   d. Create the branch and directory:
      ```bash
      git checkout -b NNN-short-name
      mkdir -p specs/NNN-short-name
      ```

   **IMPORTANT**:
   - Check all three sources (remote branches, local branches, specs directories) to find the highest number
   - You must only ever create one branch per feature
   - For single quotes in args, use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible)

### Step 4A: Feature Routing

If classified as **feature**:

1. Report classification result: "Classified as feature: <summary>"
2. Suggest next step: "Next: `/poor-dev.specify` to create the specification"

### Step 4B: Bugfix Routing

If classified as **bugfix**:

1. **Bug pattern lookup**: Read `bug-patterns.md` and compare the input text against existing patterns.
   - If a similar pattern exists, inform the user: "過去に類似のバグがありました: [Pattern summary]. 参考にしてください。"

2. Copy bug report template and fill initial info:
   - Create `$FEATURE_DIR/bug-report.md` from the following template:

   ```markdown
   # Bug Report: [BUG SHORT NAME]

   **Branch**: `[###-fix-bug-name]`
   **Created**: [DATE]
   **Status**: Investigating
   **Input**: "$ARGUMENTS"

   ## Description
   [バグの概要]

   ## Expected Behavior
   [期待される動作]

   ## Actual Behavior
   [実際の動作。エラーメッセージがあれば記載]

   ## Steps to Reproduce
   1. [Step 1]
   2. [Step 2]
   3. [Step 3]

   ## Frequency
   [常時 / 間欠的 / 特定条件下のみ]

   ## Environment
   - **OS**: [e.g., Ubuntu 22.04, macOS 14.2]
   - **Language/Runtime**: [e.g., Node.js 20.x, Python 3.12]
   - **Key Dependencies**: [e.g., React 18.2, FastAPI 0.104]
   - **Hardware**: [if relevant]

   ## Since When
   [いつから発生しているか。最近の変更との関連]

   ## Reproduction Results
   **Status**: [Not Attempted / Reproduced / Could Not Reproduce]
   [再現試行の詳細・ログ・テスト出力]
   ```

   - Fill in what can be extracted from `$ARGUMENTS`: branch name, date, description, any error messages or symptoms mentioned
   - Leave unknown sections with their placeholder markers

3. Report classification result: "Classified as bugfix: <summary>"
4. Suggest next step: "Next: `/poor-dev.bugfix` to investigate and fix"

### Step 4C: Roadmap Routing

If classified as **roadmap**:

1. Report classification result: "Classified as roadmap: <summary>"
2. Suggest next step: "Next: `/poor-dev.concept` to start concept exploration"

### Step 4D: Q&A Routing

If classified as **Q&A**:

1. Report classification result: "Classified as Q&A: <summary>"
2. Suggest next step: "Next: `/poor-dev.ask` to answer the question"

### Step 4E: Documentation Routing

If classified as **documentation**:

1. Report classification result: "Classified as documentation: <summary>"
2. Suggest next step: "Next: `/poor-dev.report` to generate the report"

### Step 4F: Discovery Routing

If classified as **discovery**:

1. Report classification result: "Classified as discovery: <summary>"
2. Suggest next step: "Next: `/poor-dev.discovery` to start exploration flow"

Note: Discovery flow handles its own branch/directory creation and existing code detection internally.

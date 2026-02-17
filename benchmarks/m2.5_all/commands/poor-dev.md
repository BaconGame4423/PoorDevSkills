---
description: Intake user input and route to the appropriate flow: feature, bugfix, investigation, roadmap, discovery, Q&A, or documentation.
handoffs:
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification for this feature request
  - label: Bug Fix Investigation
    agent: poor-dev.bugfix
    prompt: Investigate and fix this bug report
  - label: Problem Investigation
    agent: poor-dev.investigate
    prompt: Investigate this problem or unknown issue
  - label: Roadmap Concept
    agent: poor-dev.concept
    prompt: Start roadmap concept exploration
  - label: Discovery Flow
    agent: poor-dev.discovery
    prompt: Start discovery flow for exploration and prototyping
  - label: Ask Question
    agent: poor-dev.ask
    prompt: Answer a question about the codebase
  - label: Generate Report
    agent: poor-dev.report
    prompt: Generate a project report
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text after the command **is** the user's request. Do not ask them to repeat it unless empty.

### Flow Control Rule

This command is the pipeline orchestrator. After classification (Step 1-2):
- Pipeline flows (Feature, Bugfix, Roadmap, Discovery, Investigation) → proceed to **Step 3** (bash lib/intake.sh)
- Non-pipeline flows (Q&A, Documentation) → execute target skill directly in Step 3
- Do NOT auto-transition to other agents via handoff frontmatter. Handoffs are UI metadata only.

### Step 1: Input Classification

Analyze `$ARGUMENTS` through a 3-stage process.

**1a. Intent Detection**: Classify by what the user wants to accomplish:
- **Feature**: add, create, or implement new functionality
- **Bugfix**: error, crash, broken behavior, or regression
- **Investigation**: investigate a problem, understand behavior, find root cause
- **Roadmap**: plan strategy, define vision, explore concepts at project level
- **Discovery**: prototype, explore ideas, rebuild existing code, "just try something"
- **Q&A**: question about the codebase or architecture
- **Documentation**: report, summary, or document generation

**Priority rule**: Feature / Bugfix / Investigation / Roadmap / Discovery signals take precedence over Q&A / Documentation.

**1b. Contextual Analysis** (when ambiguous):
- Problem description → bugfix
- Investigation signal ("why does X", "investigate") → investigation
- Desired state ("I want X", "add X") → feature
- Planning/strategy → roadmap
- Exploration ("try X", "prototype", "rebuild") → discovery
- Question → Q&A
- Report request → documentation

**1c. Confidence**: High / Medium / Low

### Step 2: Clarify if Ambiguous

If confidence is Medium or below, ask user to choose:
1. "機能リクエスト（新機能・拡張）"
2. "バグ報告（既存機能の不具合・異常動作）"
3. "調査（原因不明の問題・挙動の理解）"
4. "ロードマップ・戦略策定（プロジェクト企画段階）"
5. "探索・プロトタイプ（まず作って学ぶ / 既存コードを整理して再構築）"
6. "質問・ドキュメント作成（パイプライン不要）"
7. "もう少し詳しく説明する"

If "もう少し詳しく" → re-classify. If option 6 → follow-up: ask/report.

**Non-pipeline shortcut**: Q&A / Documentation → Step 3 の非パイプラインフロー処理へ。
**Pipeline flows**: Feature / Bugfix / Investigation / Roadmap / Discovery → Step 3 の bash lib/intake.sh を実行。

### Step 3: パイプライン実行

パイプラインフロー (feature/bugfix/roadmap/discovery/investigation) の場合:

**3a. セットアップ** — bash ツールで以下を実行すること（テキストとして出力しない）:

```bash
bash lib/intake.sh --setup-only --flow <分類結果> --project-dir "$(pwd)" << 'INPUTEOF'
<User Input セクションのテキストをここにコピー>
INPUTEOF
```

`<分類結果>` は Step 1 の分類結果に置換する（feature, bugfix, investigation, roadmap, discovery）。
`<User Input セクションのテキストをここにコピー>` は上記 User Input セクションの内容をそのまま貼り付ける。

JSON 出力から `feature_dir` と `branch` を取得する。

**3b. ステップ順次実行** — 以下のコマンドを繰り返し実行する。
毎回 bash ツールで実行すること（テキストとして出力しない）:

```bash
bash lib/pipeline-runner.sh --next --flow <FLOW> --feature-dir <FEATURE_DIR> --branch <BRANCH> --project-dir "$(pwd)" --summary "<User Input の1行要約>"
```

各実行で1ステップが完了する。

**ループ判定（出力テキストで判断）:**
- 出力に `step_complete` が含まれる → **完了したステップを1行報告し、同じコマンドを再実行。**（優先）
- 出力に `pipeline_complete` が含まれる（かつ `step_complete` がない場合のみ）→ **全完了。最終結果を報告して終了。**
- 出力に `awaiting-approval` かつ `clarification` が含まれる → **各確認事項を AskUserQuestion で1つずつ質問する。** 最初の選択肢は必ず「デフォルトを採用（推奨）」とし、残り2-3個は質問内容に応じた具体的な選択肢を生成する。**全質問の回答を得たら:**
  ```bash
  bash lib/apply-clarifications.sh <FEATURE_DIR> <<'ANSWERS'
  <ユーザーの回答テキスト>
  ANSWERS
  ```
  **完了後、Step 3b と同じコマンドを再実行。**
- 上記以外でエラーが発生した場合 → **出力を確認しユーザーに報告して停止。**

pipeline-state.json が完了済みステップを自動記録するため、再実行すると次のステップから始まる。

**禁止事項**: lib/ 内のスクリプトを直接読んだり修正しないこと。上記コマンドと apply-clarifications.sh 以外のスクリプトは使わない。

非パイプラインフローの場合:
- Q&A → `/poor-dev.ask` コマンドを実行
- Documentation → `/poor-dev.report` コマンドを実行

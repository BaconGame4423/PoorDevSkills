---
description: Triage user input to determine whether to route to feature development or bug fix flow.
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

**1b. Contextual Analysis** (when keywords are ambiguous):
- Problem description pattern → bugfix ("〜が発生する" "〜になってしまう" "〜できない")
- Desired state pattern → feature ("〜がほしい" "〜を追加" "〜に対応")
- Planning/strategy pattern → roadmap ("〜の方針を決めたい" "〜の戦略を立てたい" "〜を企画する")
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
  4. "質問・ドキュメント作成（パイプライン不要）"
  5. "もう少し詳しく説明する"
- If "もう少し詳しく" → receive additional explanation and re-classify from Step 1

### Step 3: Branch & Directory Creation (common to both flows)

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

   d. Run the script:
      ```bash
      .poor-dev/scripts/bash/create-new-feature.sh --json --number N --short-name "name" "description"
      ```

   e. Initialize pipeline state:
      ```bash
      .poor-dev/scripts/bash/pipeline-state.sh init "$FEATURE_DIR"
      ```

   **IMPORTANT**:
   - Check all three sources (remote branches, local branches, specs directories) to find the highest number
   - You must only ever run this script once per feature
   - The JSON output will contain BRANCH_NAME and SPEC_FILE paths
   - For single quotes in args, use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible)

### Step 4A: Feature Routing

If classified as **feature**:

1. Set type:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh set-type "$FEATURE_DIR" feature
   ```

2. Update state:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" triage completed --summary "Classified as feature: <summary>"
   ```

3. Continue to Pipeline Continuation (below) which will route to `/poor-dev.specify`

### Step 4B: Bugfix Routing

If classified as **bugfix**:

1. Set type:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh set-type "$FEATURE_DIR" bugfix
   ```

2. **Bug pattern lookup**: Read `.poor-dev/memory/bug-patterns.md` and compare the input text against existing patterns.
   - If a similar pattern exists, inform the user: "過去に類似のバグがありました: [Pattern summary]. 参考にしてください。"

3. Switch to bugfix pipeline:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh set-steps "$FEATURE_DIR" '[{"id":"triage","status":"completed"},{"id":"bugfix","status":"pending"},{"id":"implement","status":"pending"},{"id":"qualityreview","status":"pending"},{"id":"postmortem","status":"pending"}]'
   ```

4. Copy bug report template and fill initial info:
   - Read `.poor-dev/templates/bug-report-template.md`
   - Create `$FEATURE_DIR/bug-report.md` from the template
   - Fill in what can be extracted from `$ARGUMENTS`: branch name, date, description, any error messages or symptoms mentioned
   - Leave unknown sections with their placeholder markers

5. Update context paths in workflow-state.yaml:
   ```bash
   yq -i ".context.bug_report_file = \"$FEATURE_DIR/bug-report.md\"" "$FEATURE_DIR/workflow-state.yaml"
   yq -i ".context.investigation_file = \"$FEATURE_DIR/investigation.md\"" "$FEATURE_DIR/workflow-state.yaml"
   yq -i ".context.fix_plan_file = \"$FEATURE_DIR/fix-plan.md\"" "$FEATURE_DIR/workflow-state.yaml"
   ```

6. Update state:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" triage completed --summary "Classified as bugfix: <summary>"
   ```

7. Continue to Pipeline Continuation (below) which will route to `/poor-dev.bugfix`

### Step 4C: Roadmap Routing

If classified as **roadmap**:

1. Set type:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh set-type "$FEATURE_DIR" roadmap
   ```

2. Switch to roadmap pipeline:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh set-steps "$FEATURE_DIR" '[{"id":"triage","status":"completed"},{"id":"concept","status":"pending"},{"id":"goals","status":"pending"},{"id":"milestones","status":"pending"},{"id":"roadmap","status":"pending"}]'
   ```

3. Update context paths in workflow-state.yaml:
   ```bash
   yq -i ".context.concept_file = \"$FEATURE_DIR/concept.md\"" "$FEATURE_DIR/workflow-state.yaml"
   yq -i ".context.goals_file = \"$FEATURE_DIR/goals.md\"" "$FEATURE_DIR/workflow-state.yaml"
   yq -i ".context.milestones_file = \"$FEATURE_DIR/milestones.md\"" "$FEATURE_DIR/workflow-state.yaml"
   yq -i ".context.roadmap_file = \"$FEATURE_DIR/roadmap.md\"" "$FEATURE_DIR/workflow-state.yaml"
   ```

4. Update state:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" triage completed --summary "Classified as roadmap: <summary>"
   ```

5. Continue to Pipeline Continuation (below) which will route to `/poor-dev.concept`

### Step 4D: Non-Pipeline Routing

If classified as **質問・ドキュメント作成**:

Report to the user:
- "このリクエストはパイプライン管理が不要です。以下のコマンドをお使いください:"
- 質問応答: `/poor-dev.ask` or `poor-dev ask "質問"`
- レポート生成: `/poor-dev.report` or `poor-dev report`
- Pipeline state is NOT updated (triage did not complete a pipeline flow).
- Do NOT proceed to Pipeline Continuation.

## Pipeline Continuation

**This section executes ONLY after all skill work is complete (Step 4A or 4B done).**

1. **Check for pipeline state**: Look for `FEATURE_DIR/workflow-state.yaml`:
   - **Not found** → Standalone mode. Report completion as normal. Skip remaining steps.
   - **Found** → Pipeline mode. Continue below.

2. **Preemptive summary** (3-5 lines): Compose a summary including:
   - Classification result (feature or bugfix) and confidence
   - Generated branch name and directory
   - Key decisions made
   - Bug pattern matches (if bugfix)

3. **State is already updated** in Step 4A/4B.

4. **Get next step**:
   ```bash
   NEXT=$(.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR")
   ```

5. **Transition based on mode** (read `pipeline.mode` and `pipeline.confirm` from state):

   **auto + confirm=true (default)**:
   - **Claude Code**: Use `AskUserQuestion` tool with:
     - question: "Pipeline: triage completed. Next is /poor-dev.$NEXT"
     - options: "Continue" / "Skip" / "Pause"
   - **OpenCode**: Use `question` tool with same content.
   - On "Continue" → invoke `/poor-dev.$NEXT`
   - On "Skip" → update that step to `skipped`, get next, ask again
   - On "Pause" → set mode to `paused`, report how to resume

   **auto + confirm=false**: Immediately invoke `/poor-dev.$NEXT`

   **manual / paused**: Report completion + suggest: "Next: `/poor-dev.$NEXT`. Run `/poor-dev.pipeline resume` to continue."

6. **Error fallback**:
   - If question tool fails → report as text: "Next: `/poor-dev.$NEXT`. Use `/poor-dev.pipeline resume` to continue."
   - If state update fails → warn but do not affect main skill output

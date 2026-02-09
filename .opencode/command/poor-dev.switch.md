---
description: "Select and start a development flow directly without triage classification."
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
    1. "機能開発 (feature)" — 仕様→計画→実装→レビューの11ステップ
    2. "バグ修正 (bugfix)" — 調査→実装→レビューの5ステップ
    3. "ロードマップ (roadmap)" — コンセプト→ゴール→マイルストーン→ロードマップの4ステップ
    4. "質問応答 (ask)" — パイプラインなしの単発質問
- **OpenCode**: Use `question` tool with the same content.

### Step 2: Non-Pipeline Flows

If the user chose **ask** or **report**:
- Directly invoke `/poor-dev.ask` or `/poor-dev.report` with `$ARGUMENTS`
- End. Do not proceed to Step 3.

### Step 3: Get Description

For pipeline flows (feature, bugfix, roadmap):

If `$ARGUMENTS` already contains a description (non-empty after removing `--flow-type`), use it.

Otherwise, ask the user:
- **Claude Code**: Use `AskUserQuestion` tool with:
  - question: "選択したフローの説明を入力してください"
  - (free text input — the user provides their description)
- **OpenCode**: Use `question` tool.

### Step 4: Branch & Directory Creation

**Same logic as `/poor-dev.triage` Step 3**:

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
   .poor-dev/scripts/bash/create-new-feature.sh --json --number N --short-name "name" "description"
   ```
4. Initialize pipeline state:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh init "$FEATURE_DIR"
   ```

### Step 5: State Initialization

Based on the chosen flow type:

**Feature**:
```bash
.poor-dev/scripts/bash/pipeline-state.sh set-type "$FEATURE_DIR" feature
.poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" triage completed --summary "Direct flow selection: feature"
```
Continue to Pipeline Continuation (routes to `/poor-dev.specify`)

**Bugfix**:
```bash
.poor-dev/scripts/bash/pipeline-state.sh set-type "$FEATURE_DIR" bugfix
.poor-dev/scripts/bash/pipeline-state.sh set-steps "$FEATURE_DIR" '[{"id":"triage","status":"completed"},{"id":"bugfix","status":"pending"},{"id":"implement","status":"pending"},{"id":"qualityreview","status":"pending"},{"id":"postmortem","status":"pending"}]'
```
- Copy bug report template and fill initial info
- Update context paths (bug_report_file, investigation_file, fix_plan_file)
- Update state: `pipeline-state.sh update "$FEATURE_DIR" triage completed`
- Continue to Pipeline Continuation (routes to `/poor-dev.bugfix`)

**Roadmap**:
```bash
.poor-dev/scripts/bash/pipeline-state.sh set-type "$FEATURE_DIR" roadmap
.poor-dev/scripts/bash/pipeline-state.sh set-steps "$FEATURE_DIR" '[{"id":"triage","status":"completed"},{"id":"concept","status":"pending"},{"id":"goals","status":"pending"},{"id":"milestones","status":"pending"},{"id":"roadmap","status":"pending"}]'
```
- Update context paths (concept_file, goals_file, milestones_file, roadmap_file)
- Update state: `pipeline-state.sh update "$FEATURE_DIR" triage completed`
- Continue to Pipeline Continuation (routes to `/poor-dev.concept`)

## Pipeline Continuation

**This section executes ONLY after Step 5 is complete.**

1. **Preemptive summary** (3-5 lines): flow type, branch name, directory.

2. **State is already updated** in Step 5.

3. **Get next step**:
   ```bash
   NEXT=$(.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR")
   ```

4. **Transition based on mode** (read `pipeline.mode` and `pipeline.confirm` from state):

   **auto + confirm=true (default)**:
   - Use `AskUserQuestion` / `question` with:
     - question: "Pipeline: switch completed. Next is /poor-dev.$NEXT"
     - options: "Continue" / "Skip" / "Pause"
   - On "Continue" → invoke `/poor-dev.$NEXT`
   - On "Skip" → update step to `skipped`, get next, ask again
   - On "Pause" → set mode to `paused`, report how to resume

   **auto + confirm=false**: Immediately invoke `/poor-dev.$NEXT`

   **manual / paused**: Report completion + suggest next step.

5. **Error fallback**: Report next step as text if tools fail.

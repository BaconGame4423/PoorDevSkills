---
description: "Roadmap Step 1: Interactive concept exploration and documentation."
handoffs:
  - label: Define Goals
    agent: poor-dev.goals
    prompt: Define goals based on the concept
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

### Step 0: Pipeline Branch Inheritance Check

- Run `.poor-dev/scripts/bash/check-prerequisites.sh --json --paths-only` to get FEATURE_DIR
- Check if `FEATURE_DIR/workflow-state.yaml` exists
- If it exists, read it and check if the `triage` step is `completed`:
  - **Yes (triage completed)** → Branch and directory already created by triage. **Skip Steps 1-2 entirely.**
    - Get FEATURE_DIR from `workflow-state.yaml`'s `feature.dir` field
    - Jump directly to Step 3 (template loading)
  - **No (triage not completed or no triage step)** → Continue with Step 1 as normal (standalone mode)
- If `workflow-state.yaml` does not exist → Continue with Step 1 as normal (standalone mode)

### Step 1: Generate Short Name (standalone mode only)

Same as `poor-dev.specify` Steps 1-2:
1. Generate a concise short name (2-4 words) from `$ARGUMENTS`
2. Check existing branches and determine next available number
3. Create branch and directory via `create-new-feature.sh --json`
4. Initialize pipeline state:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh init "$FEATURE_DIR"
   .poor-dev/scripts/bash/pipeline-state.sh set-type "$FEATURE_DIR" roadmap
   .poor-dev/scripts/bash/pipeline-state.sh set-steps "$FEATURE_DIR" '[{"id":"triage","status":"completed"},{"id":"concept","status":"pending"},{"id":"goals","status":"pending"},{"id":"milestones","status":"pending"},{"id":"roadmap","status":"pending"}]'
   ```

### Step 2: Not used (reserved)

### Step 3: Concept Exploration

1. Read `.poor-dev/templates/concept-template.md`
2. Use `$ARGUMENTS` as the starting point for concept exploration
3. Ask the user a series of questions using `AskUserQuestion` (Claude Code) or `question` (OpenCode):

   **Question 1**: ターゲットユーザー
   - "このプロジェクト/機能の主なターゲットユーザーは？"
   - Options: 個人開発者 / チーム / エンタープライズ / エンドユーザー

   **Question 2**: 解決する課題
   - "最も重要な課題は何ですか？自由に記述してください。"

   **Question 3**: 差別化
   - "既存ソリューションとの違いは？"

   **Question 4**: 制約条件
   - "技術的・ビジネス的な制約はありますか？"

4. Combine responses with `$ARGUMENTS` to fill the concept template

### Step 4: Write Concept Document

- Write the completed concept to `$FEATURE_DIR/concept.md`
- Ensure all sections are filled with concrete content (no empty placeholders)

### Step 5: Update Context Paths

```bash
yq -i ".context.concept_file = \"$FEATURE_DIR/concept.md\"" "$FEATURE_DIR/workflow-state.yaml"
```

## Pipeline Continuation

**This section executes ONLY after all skill work is complete.**

1. **Check for pipeline state**: Look for `FEATURE_DIR/workflow-state.yaml`:
   - **Not found** → Standalone mode. Report completion. Skip remaining steps.
   - **Found** → Pipeline mode. Continue below.

2. **Preemptive summary** (3-5 lines): concept overview, key decisions, user constraints.

3. **Update state**:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" concept completed --summary "<summary>"
   ```

4. **Get next step**:
   ```bash
   NEXT=$(.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR")
   ```

5. **Transition based on mode** (read `pipeline.mode` and `pipeline.confirm` from state):

   **auto + confirm=true (default)**:
   - Use `AskUserQuestion` / `question` with:
     - question: "Pipeline: concept completed. Next is /poor-dev.$NEXT"
     - options: "Continue" / "Skip" / "Pause"
   - On "Continue" → invoke `/poor-dev.$NEXT`
   - On "Skip" → update step to `skipped`, get next, ask again
   - On "Pause" → set mode to `paused`, report how to resume

   **auto + confirm=false**: Immediately invoke `/poor-dev.$NEXT`

   **manual / paused**: Report completion + suggest next step.

6. **Error fallback**: Report next step as text if tools fail.

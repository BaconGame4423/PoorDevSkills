---
description: "Roadmap Step 3: Break goals into concrete milestones with dependencies."
handoffs:
  - label: Generate Roadmap
    agent: poor-dev.roadmap
    prompt: Generate the final roadmap document
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
- Check if `FEATURE_DIR/workflow-state.yaml` exists and `goals` step is `completed`:
  - **Yes** → Use existing FEATURE_DIR. Skip to Step 1.
  - **No** → Error: "goals ステップを先に完了してください。`/poor-dev.goals` を実行してください。"

### Step 1: Read Previous Artifacts

- Read `$FEATURE_DIR/concept.md`
- Read `$FEATURE_DIR/goals.md`
- Extract: goals, success criteria, constraints, dependencies

### Step 2: Decompose into Milestones

1. Read `.poor-dev/templates/milestones-template.md`
2. For each goal, create one or more milestones:
   - Clear deliverables (checkboxes)
   - Success criteria per milestone
   - Dependencies between milestones
   - Effort estimates (S/M/L/XL)
3. Create a dependency graph showing milestone relationships

### Step 3: User Review

Check `pipeline.mode` from `workflow-state.yaml`:

**If mode is NOT `manual` (slash command mode)**:
- Present milestones via `AskUserQuestion` / `question`:
  - "マイルストーンを確認してください。"
  - Options: "承認して続行" / "修正する" / "コンセプトに戻る" / "ゴールに戻る"
- If "コンセプトに戻る":
  1. Reset concept and subsequent steps to pending:
     ```bash
     .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" concept pending
     .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" goals pending
     .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" milestones pending
     ```
  2. Invoke `/poor-dev.concept` with the original description
- If "ゴールに戻る":
  1. Reset goals and subsequent steps to pending:
     ```bash
     .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" goals pending
     .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" milestones pending
     ```
  2. Invoke `/poor-dev.goals`

**If mode is `manual` (CLI mode)**:
- Present milestones via `AskUserQuestion` / `question`:
  - "マイルストーンを確認してください。"
  - Options: "承認して続行" / "修正する"
- Do NOT offer "戻る" options. Instead, if user needs to go back, inform:
  - "CLI モードでは「戻る」はサポートされていません。`poor-dev --from goals --feature-dir $FEATURE_DIR` で手動再開してください。"

### Step 4: Write Milestones Document

- Write completed milestones to `$FEATURE_DIR/milestones.md`
- Update context paths:
  ```bash
  yq -i ".context.milestones_file = \"$FEATURE_DIR/milestones.md\"" "$FEATURE_DIR/workflow-state.yaml"
  ```

## Pipeline Continuation

**This section executes ONLY after all skill work is complete.**

1. **Check for pipeline state**: Look for `FEATURE_DIR/workflow-state.yaml`:
   - **Not found** → Standalone mode. Report completion. Skip remaining steps.
   - **Found** → Pipeline mode. Continue below.

2. **Preemptive summary** (3-5 lines): milestone count, dependencies, effort estimates.

3. **Update state**:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" milestones completed --summary "<summary>"
   ```

4. **Get next step**:
   ```bash
   NEXT=$(.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR")
   ```

5. **Transition based on mode** (read `pipeline.mode` and `pipeline.confirm` from state):

   **auto + confirm=true (default)**:
   - Use `AskUserQuestion` / `question` with:
     - question: "Pipeline: milestones completed. Next is /poor-dev.$NEXT"
     - options: "Continue" / "Skip" / "Pause"
   - On "Continue" → invoke `/poor-dev.$NEXT`
   - On "Skip" → update step to `skipped`, get next, ask again
   - On "Pause" → set mode to `paused`, report how to resume

   **auto + confirm=false**: Immediately invoke `/poor-dev.$NEXT`

   **manual / paused**: Report completion + suggest next step.

6. **Error fallback**: Report next step as text if tools fail.

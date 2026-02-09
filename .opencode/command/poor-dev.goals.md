---
description: "Roadmap Step 2: Define strategic goals and success criteria from concept."
handoffs:
  - label: Break into Milestones
    agent: poor-dev.milestones
    prompt: Break goals into milestones
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
- Check if `FEATURE_DIR/workflow-state.yaml` exists and `concept` step is `completed`:
  - **Yes** → Use existing FEATURE_DIR. Skip to Step 1.
  - **No** → Error: "concept ステップを先に完了してください。`/poor-dev.concept` を実行してください。"

### Step 1: Read Concept

- Read `$FEATURE_DIR/concept.md`
- Extract: vision, target users, problem statement, proposed solution, constraints

### Step 2: Define Goals

1. Read `.poor-dev/templates/goals-template.md`
2. Based on the concept, propose 3-5 strategic goals with:
   - Clear descriptions
   - Measurable success metrics
   - Priority levels (P1/P2/P3)
3. Present goals to user via `AskUserQuestion` / `question`:
   - "以下のゴールでよろしいですか？修正が必要な場合はお知らせください。"
   - Options: "承認" / "修正する" / "ゴールを追加"
4. If "修正する" → ask for specific changes, update goals
5. If "ゴールを追加" → ask for new goal details, add to list

### Step 3: Define Success Criteria

- For each goal, define measurable success criteria
- Create a success criteria table with ID, criterion, metric, target, priority

### Step 4: Write Goals Document

- Write completed goals to `$FEATURE_DIR/goals.md`
- Update context paths:
  ```bash
  yq -i ".context.goals_file = \"$FEATURE_DIR/goals.md\"" "$FEATURE_DIR/workflow-state.yaml"
  ```

## Pipeline Continuation

**This section executes ONLY after all skill work is complete.**

1. **Check for pipeline state**: Look for `FEATURE_DIR/workflow-state.yaml`:
   - **Not found** → Standalone mode. Report completion. Skip remaining steps.
   - **Found** → Pipeline mode. Continue below.

2. **Preemptive summary** (3-5 lines): goals count, key success criteria, priorities.

3. **Update state**:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" goals completed --summary "<summary>"
   ```

4. **Get next step**:
   ```bash
   NEXT=$(.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR")
   ```

5. **Transition based on mode** (read `pipeline.mode` and `pipeline.confirm` from state):

   **auto + confirm=true (default)**:
   - Use `AskUserQuestion` / `question` with:
     - question: "Pipeline: goals completed. Next is /poor-dev.$NEXT"
     - options: "Continue" / "Skip" / "Pause"
   - On "Continue" → invoke `/poor-dev.$NEXT`
   - On "Skip" → update step to `skipped`, get next, ask again
   - On "Pause" → set mode to `paused`, report how to resume

   **auto + confirm=false**: Immediately invoke `/poor-dev.$NEXT`

   **manual / paused**: Report completion + suggest next step.

6. **Error fallback**: Report next step as text if tools fail.

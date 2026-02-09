---
description: "Roadmap Step 4 (Final): Generate comprehensive roadmap from all artifacts."
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

### Step 0: Pipeline Branch Inheritance Check

- Run `.poor-dev/scripts/bash/check-prerequisites.sh --json --paths-only` to get FEATURE_DIR
- Check if `FEATURE_DIR/workflow-state.yaml` exists and `milestones` step is `completed`:
  - **Yes** → Use existing FEATURE_DIR. Skip to Step 1.
  - **No** → Error: "milestones ステップを先に完了してください。`/poor-dev.milestones` を実行してください。"

### Step 1: Read All Artifacts

- Read `$FEATURE_DIR/concept.md` — vision, problem, solution
- Read `$FEATURE_DIR/goals.md` — strategic goals, success criteria
- Read `$FEATURE_DIR/milestones.md` — milestones, dependencies, effort

### Step 2: Generate Roadmap

1. Read `.poor-dev/templates/roadmap-template.md`
2. Synthesize all artifacts into a comprehensive roadmap:
   - **Executive Summary**: Distill concept + goals into 3-5 sentences
   - **Phase Plan**: Map milestones to phases with timelines
   - **Timeline View**: Visual ASCII timeline
   - **Success Metrics**: Track goals across phases
   - **Review Points**: Phase gates for validation
   - **Next Steps**: Concrete actions after roadmap approval

### Step 3: Write Roadmap

- Write the completed roadmap to `$FEATURE_DIR/roadmap.md`
- Update context paths:
  ```bash
  yq -i ".context.roadmap_file = \"$FEATURE_DIR/roadmap.md\"" "$FEATURE_DIR/workflow-state.yaml"
  ```

### Step 4: Final Report

Present a summary to the user:
- Generated artifacts: concept.md, goals.md, milestones.md, roadmap.md
- Key decisions and assumptions
- Suggested next steps (e.g., move to feature development for specific milestones)

## Pipeline Continuation

**This section executes ONLY after all skill work is complete.**

1. **Check for pipeline state**: Look for `FEATURE_DIR/workflow-state.yaml`:
   - **Not found** → Standalone mode. Report completion. Skip remaining steps.
   - **Found** → Pipeline mode. Continue below.

2. **Preemptive summary** (3-5 lines): roadmap phases, key milestones, recommendations.

3. **Update state**:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" roadmap completed --summary "<summary>"
   ```

4. **Get next step**:
   ```bash
   NEXT=$(.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR")
   ```
   - If `$NEXT` is `done` → Pipeline complete. Report final summary.

5. **Transition based on mode** (read `pipeline.mode` and `pipeline.confirm` from state):

   Since roadmap is typically the final step, report completion:
   - "ロードマップフロー完了。生成されたドキュメント:"
   - List all artifact paths
   - Suggest: "次のステップとして、各マイルストーンを `/poor-dev.triage` で機能開発フローに移行できます。"

6. **Error fallback**: Report completion as text if tools fail.

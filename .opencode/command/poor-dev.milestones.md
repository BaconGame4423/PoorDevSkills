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

### Step 0: Feature ディレクトリの特定

1. 現在のブランチ名を取得: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
2. ブランチ名から数字プレフィックスを抽出
3. 対応するディレクトリを特定: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
4. `$FEATURE_DIR/goals.md` が存在することを確認
   - 存在しない場合: Error: "goals ステップを先に完了してください。`/poor-dev.goals` を実行してください。"

### Step 1: Read Previous Artifacts

- Read `$FEATURE_DIR/concept.md`
- Read `$FEATURE_DIR/goals.md`
- Extract: goals, success criteria, constraints, dependencies

### Step 2: Decompose into Milestones

1. Use the following template as a base:

   ```markdown
   # Milestones: [PROJECT/FEATURE NAME]

   **Created**: [DATE]
   **Input**: concept.md, goals.md

   ---

   ## Milestone Overview

   <!-- Visual timeline of milestones -->

   ```
   M1 ──→ M2 ──→ M3 ──→ M4 ──→ [Launch]
   ```

   ## Milestone 1: [Name]

   - **Goal Alignment**: [Which goals from goals.md this supports]
   - **Description**:
   - **Deliverables**:
     - [ ]
     - [ ]
   - **Success Criteria**:
     -
   - **Dependencies**: None / [List]
   - **Estimated Effort**: S / M / L / XL

   ## Milestone 2: [Name]

   - **Goal Alignment**:
   - **Description**:
   - **Deliverables**:
     - [ ]
     - [ ]
   - **Success Criteria**:
     -
   - **Dependencies**: M1
   - **Estimated Effort**: S / M / L / XL

   ## Milestone 3: [Name]

   - **Goal Alignment**:
   - **Description**:
   - **Deliverables**:
     - [ ]
     - [ ]
   - **Success Criteria**:
     -
   - **Dependencies**: M1, M2
   - **Estimated Effort**: S / M / L / XL

   ## Dependency Graph

   <!-- How milestones relate to each other -->

   | Milestone | Depends On | Blocks |
   |-----------|-----------|--------|
   | M1 | - | M2, M3 |
   | M2 | M1 | M3 |
   | M3 | M1, M2 | - |

   ## Resource Requirements

   <!-- What's needed to complete the milestones -->

   | Resource | Milestones | Notes |
   |----------|-----------|-------|
   | | | |

   ## Risk Matrix

   | Milestone | Risk | Mitigation |
   |-----------|------|------------|
   | | | |
   ```

2. For each goal, create one or more milestones:
   - Clear deliverables (checkboxes)
   - Success criteria per milestone
   - Dependencies between milestones
   - Effort estimates (S/M/L/XL)
3. Create a dependency graph showing milestone relationships

### Step 3: User Review

- Present milestones via `AskUserQuestion` / `question`:
  - "マイルストーンを確認してください。"
  - Options: "承認して続行" / "修正する"
- If "修正する" → ask for specific changes, update milestones

### Step 4: Write Milestones Document

- Write completed milestones to `$FEATURE_DIR/milestones.md`

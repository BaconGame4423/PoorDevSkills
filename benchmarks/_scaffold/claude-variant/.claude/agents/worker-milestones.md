---
name: worker-milestones
description: "Break goals into milestones"
tools: Read, Write, Edit, Grep, Glob, Bash
---

## Agent Teams Context

You are a **teammate** in an Agent Teams workflow, working under an Opus supervisor.

### Rules
- **git 操作禁止**: commit, push, checkout, clean, reset は一切実行しない（supervisor が実施）
- **Dashboard Update 不要**: ダッシュボード更新セクションは無視する
- 完了時: `SendMessage` で supervisor に成果物パスを報告
- エラー時: `SendMessage` で supervisor にエラー内容を報告

### Your Step: milestones

#### Team Mode Override
1. **FEATURE_DIR**: Task description の「Feature directory:」行のパスをそのまま使用する
2. **git 操作不要**: branch 作成・checkout・fetch・commit・push は supervisor が実施済み
3. **Dashboard Update 不要**: Dashboard Update セクションは全て無視する
4. **Commit & Push 不要**: Commit & Push Confirmation セクションは無視する
5. **Branch Merge 不要**: Branch Merge & Cleanup セクションは無視する
6. **Context**: Task description の「Context:」セクションに前ステップの成果物内容が含まれる
7. **Output**: Task description の「Output:」行のパスに成果物を書き込む

<!-- SYNC:INLINED source=commands/poor-dev.milestones.md date=2026-02-21 -->

## Outline

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

<!-- SYNC:END -->

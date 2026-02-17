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

### Step 0: Feature ディレクトリの特定

1. 現在のブランチ名を取得: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
2. ブランチ名から数字プレフィックスを抽出（例: `003-roadmap-plan` → `003`）
3. 対応するディレクトリを特定: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
4. `$FEATURE_DIR/concept.md` が存在することを確認
   - 存在しない場合: Error: "concept ステップを先に完了してください。`/poor-dev.concept` を実行してください。"

### Step 1: Read Concept

- Read `$FEATURE_DIR/concept.md`
- Extract: vision, target users, problem statement, proposed solution, constraints

### Step 2: Define Goals

1. Use the following template as a base:

   ```markdown
   # Goals: [PROJECT/FEATURE NAME]

   **Created**: [DATE]
   **Input**: concept.md

   ---

   ## Strategic Goals

   <!-- 3-5 high-level goals that define success for this project -->

   ### Goal 1: [Name]

   - **Description**:
   - **Success Metric**:
   - **Priority**: P1 / P2 / P3

   ### Goal 2: [Name]

   - **Description**:
   - **Success Metric**:
   - **Priority**: P1 / P2 / P3

   ### Goal 3: [Name]

   - **Description**:
   - **Success Metric**:
   - **Priority**: P1 / P2 / P3

   ## Success Criteria

   <!-- Measurable outcomes that determine if goals are met -->

   | ID | Criterion | Metric | Target | Priority |
   |----|-----------|--------|--------|----------|
   | SC-1 | | | | |
   | SC-2 | | | | |
   | SC-3 | | | | |

   ## Key Results

   <!-- Specific, time-bound results expected -->

   | Quarter/Phase | Key Result | Status |
   |---------------|-----------|--------|
   | | | Planned |

   ## Assumptions

   <!-- What we're assuming to be true -->

   1.
   2.

   ## Risks

   <!-- What could prevent us from achieving these goals -->

   | Risk | Probability | Impact | Mitigation |
   |------|------------|--------|------------|
   | | High/Med/Low | High/Med/Low | |

   ## Dependencies

   <!-- External dependencies that affect goal achievement -->

   -

   ## Decision Log

   <!-- Key decisions made during goal definition -->

   | Decision | Rationale | Date |
   |----------|-----------|------|
   | | | |
   ```

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

### Dashboard Update

Update living documents in `docs/`:

1. `mkdir -p docs`
2. Scan all `specs/*/` directories. For each feature dir, check artifact existence:
   - discovery-memo.md, learnings.md, spec.md, plan.md, tasks.md, bug-report.md
   - concept.md, goals.md, milestones.md, roadmap.md (roadmap flow)
3. Determine each feature's phase from latest artifact:
   Discovery → Specification → Planning → Tasks → Implementation → Review → Complete
4. Write `docs/progress.md`:
   - Header with timestamp and triggering command name
   - Per-feature section: branch, phase, artifact checklist (✅/⏳/—), last activity
5. Write `docs/roadmap.md`:
   - Header with timestamp
   - Active features table (feature, phase, status, branch)
   - Completed features table
   - Upcoming section (from concept.md/goals.md/milestones.md if present)

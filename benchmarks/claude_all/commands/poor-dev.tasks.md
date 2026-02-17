---
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs:
  - label: Tasks Review
    agent: poor-dev.tasksreview
    prompt: Review the generated tasks for completeness and quality
    send: true
  - label: Implement Project
    agent: poor-dev.implement
    prompt: Start the implementation in phases
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Determine the feature directory from the current branch:
   - Get current branch: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
   - Extract numeric prefix (e.g., `003-user-auth` → `003`)
   - Find matching directory: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
   - Set derived paths: FEATURE_SPEC, IMPL_PLAN, TASKS
   - If not found, show error

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map endpoints to user stories
   - If research.md exists: Extract decisions for setup tasks
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)

4. **Generate tasks.md**: Use the following tasks template structure (as described in the Task Generation Rules section below), fill with:
   - Correct feature name from plan.md
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
   - Each phase includes: story goal, independent test criteria, tests (if requested), implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Dependencies section showing story completion order
   - Parallel execution examples per story
   - Implementation strategy section (MVP first, incremental delivery)

5. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - Task count per user story
   - Parallel opportunities identified
   - Independent test criteria for each story
   - Suggested MVP scope (typically just User Story 1)
   - Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, labels, file paths)

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**Tests are OPTIONAL**: Only generate test tasks if explicitly requested in the feature specification or if user requests TDD approach.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
  - depends: [TaskID, ...]    # optional: explicit dependencies
  - files: glob, glob, ...    # optional: file scope for parallel execution
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] or [P:group] marker**: Include ONLY if task is parallelizable
   - `[P]` — same Phase 内の全 `[P]` タスクが 1 グループ
   - `[P:name]` — 同名グループのタスクのみ並列（例: `[P:impl]`, `[P:test]`）
   - **Requirement**: `[P]` タスクには `files:` メタデータが必須（ない場合は順次実行にフォールバック）
4. **[Story] label**: REQUIRED for user story phase tasks only
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label
   - User Story phases: MUST have story label
   - Polish phase: NO story label
5. **Description**: Clear action with exact file path
6. **Metadata** (optional, indented under task):
   - `depends: [T001, T002]` — explicit dependency on other tasks
   - `files: src/server/**, src/api/**` — file scope for parallel collision detection

**[P:group] Grammar (BNF)**:
```
task_line    := "- [ ] [" task_id "]" parallel? " " description
task_id      := letter digit+
parallel     := " [P" (":" group_name)? "]"
group_name   := [a-z][a-z0-9-]*
depends_val  := "[" task_id ("," " "? task_id)* "]"
files_val    := glob ("," " "? glob)*
```

**Collision Detection**: After generating tasks, expand `files:` globs within each parallel group and check for overlaps. If overlap found → remove `[P]` marker + add `# [P removed: files overlap with T0XX]` comment.

**Examples**:

- ✅ CORRECT: `- [ ] T001 Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
  `  - files: src/middleware/**`
- ✅ CORRECT: `- [ ] T012 [P:impl] [US1] Create User model in src/models/user.py`
  `  - depends: [T002]`
  `  - files: src/models/**, src/services/user_service.py`
- ✅ CORRECT: `- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ❌ WRONG: `- [ ] Create User model` (missing ID and Story label)
- ❌ WRONG: `T001 [US1] Create model` (missing checkbox)
- ❌ WRONG: `- [ ] [US1] Create User model` (missing Task ID)
- ❌ WRONG: `- [ ] T001 [US1] Create model` (missing file path)

### Task Organization

1. **From User Stories (spec.md)** - PRIMARY ORGANIZATION:
   - Each user story (P1, P2, P3...) gets its own phase
   - Map all related components to their story:
     - Models needed for that story
     - Services needed for that story
     - Endpoints/UI needed for that story
     - If tests requested: Tests specific to that story
   - Mark story dependencies (most stories should be independent)

2. **From Contracts**:
   - Map each contract/endpoint → to the user story it serves
   - If tests requested: Each contract → contract test task [P] before implementation in that story's phase

3. **From Data Model**:
   - Map each entity to the user story(ies) that need it
   - If entity serves multiple stories: Put in earliest story or Setup phase
   - Relationships → service layer tasks in appropriate story phase

4. **From Setup/Infrastructure**:
   - Shared infrastructure → Setup phase (Phase 1)
   - Foundational/blocking tasks → Foundational phase (Phase 2)
   - Story-specific setup → within that story's phase

### Progress Markers

Output progress markers at key milestones:
- `[PROGRESS: tasks reading-plan]` — plan.md 読み取り開始
- `[PROGRESS: tasks generating N phases]` — フェーズ構造生成中
- `[PROGRESS: tasks phase N/M complete]` — フェーズ N のタスク生成完了
- `[PROGRESS: tasks validation]` — 依存関係検証中
- `[PROGRESS: tasks complete]` — tasks.md 作成完了

### Phase Structure

- **Phase 1**: Setup (project initialization)
- **Phase 2**: Contracts & Interfaces (if contracts/ exists in plan.md)
  - Generate/verify contract files from `contracts/` directory
  - Shared type definitions and interfaces
  - These are **always sequential** — they form the parallel boundary definitions
- **Phase 3**: Foundational (blocking prerequisites - MUST complete before user stories)
- **Phase 4+**: User Stories in priority order (P1, P2, P3...)
  - Within each story: Tests (if requested) → Models → Services → Endpoints → Integration
  - Each phase should be a complete, independently testable increment
  - **Parallel groups**: Tasks that operate on non-overlapping files can be marked `[P:impl]`
- **Final Phase**: Integration & Polish
  - Cross-component integration (depends on all `[P]` tasks)
  - E2E tests, polish, cross-cutting concerns

**Note**: If contracts/ does not exist in the feature directory, skip Phase 2 and use the original numbering (Phase 2 = Foundational).

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

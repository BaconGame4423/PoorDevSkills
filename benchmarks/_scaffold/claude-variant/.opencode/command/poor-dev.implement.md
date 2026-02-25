---
description: Execute the implementation plan by processing and executing all tasks defined in tasks.md
handoffs:
  - label: Quality Review
    agent: poor-dev.qualityreview
    prompt: Run quality review on the implementation
    send: true
  - label: Architecture Review
    agent: poor-dev.architecturereview
    prompt: Run architecture review on the implementation
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. Determine the feature directory from the current branch:
   - Get current branch: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
   - Extract numeric prefix
   - Find matching directory: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
   - Set derived paths and verify tasks.md exists
   - If not found, show error — suggest running `/poor-dev.tasks` first

2. **Check checklists status** (if FEATURE_DIR/checklists/ exists):
   - Scan all checklist files in the checklists/ directory
   - For each checklist, count:
     - Total items: All lines matching `- [ ]` or `- [X]` or `- [x]`
     - Completed items: Lines matching `- [X]` or `- [x]`
     - Incomplete items: Lines matching `- [ ]`
   - Create a status table:

     ```text
     | Checklist | Total | Completed | Incomplete | Status |
     |-----------|-------|-----------|------------|--------|
     | ux.md     | 12    | 12        | 0          | ✓ PASS |
     | test.md   | 8     | 5         | 3          | ✗ FAIL |
     | security.md | 6   | 6         | 0          | ✓ PASS |
     ```

   - Calculate overall status:
     - **PASS**: All checklists have 0 incomplete items
     - **FAIL**: One or more checklists have incomplete items

   - **If any checklist is incomplete**:
     - Display the table with incomplete item counts
     - **STOP** and ask: "Some checklists are incomplete. Do you want to proceed with implementation anyway? (yes/no)"
     - Wait for user response before continuing
     - If user says "no" or "wait" or "stop", halt execution
     - If user says "yes" or "proceed" or "continue", proceed to step 3

   - **If all checklists are complete**:
     - Display the table showing all checklists passed
     - Automatically proceed to step 3

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list and execution plan
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **IF EXISTS**: Read data-model.md for entities and relationships
   - **IF EXISTS**: Read contracts/ for API specifications and test requirements
   - **IF EXISTS**: Read research.md for technical decisions and constraints
   - **IF EXISTS**: Read quickstart.md for integration scenarios

4. **Project Setup Verification**:
   - **REQUIRED**: Create/verify ignore files based on actual project setup:

   **Detection & Creation Logic**:
   - Check if the following command succeeds to determine if the repository is a git repo (create/verify .gitignore if so):

     ```sh
     git rev-parse --git-dir 2>/dev/null
     ```

   - Check if Dockerfile* exists or Docker in plan.md → create/verify .dockerignore
   - Check if .eslintrc* exists → create/verify .eslintignore
   - Check if eslint.config.* exists → ensure the config's `ignores` entries cover required patterns
   - Check if .prettierrc* exists → create/verify .prettierignore
   - Check if .npmrc or package.json exists → create/verify .npmignore (if publishing)
   - Check if terraform files (*.tf) exist → create/verify .terraformignore
   - Check if .helmignore needed (helm charts present) → create/verify .helmignore

   **If ignore file already exists**: Verify it contains essential patterns, append missing critical patterns only
   **If ignore file missing**: Create with full pattern set for detected technology

   Add standard ignore patterns for the detected tech stack (build dirs, deps, env files, IDE dirs).

5. Parse tasks.md structure and extract:
   - **Task phases**: Setup, Contracts, Foundational, User Stories, Integration, Polish
   - **Task dependencies**: `depends:` metadata + sequential vs parallel rules
   - **Task details**: ID, description, file paths, parallel markers `[P]`/`[P:group]`, `files:` metadata
   - **DAG construction**: Build dependency graph from `depends:` + Phase ordering
   - **Parallel groups**: Identify `[P:group]` tasks within each Phase

6. Execute implementation following the DAG-based task plan:

   **6a. Sequential phases** (no [P] tasks): Execute tasks in order within the phase.

   **6b. Parallel phases** (contains [P] tasks):
   Read plan.md → `parallel` settings.

   **Strategy**: Non-overlapping `[P]` tasks → same-branch parallel. Overlapping files → sequential.
   Group by `[P:group]`, dispatch sub-agents (max: `parallel.max_concurrent`), merge results.

   **6c. Error recovery**:
   - 1 sub-agent fails → commit successful tasks, re-dispatch failed task only
   - Protected file modification → post-implement check restores (existing L415-421)
   - All timeout → pipeline-state.json error, sequential retry on resume

   - **Phase-by-phase execution**: Complete each phase before moving to the next
   - **Respect dependencies**: Run sequential tasks in order, parallel tasks [P] per strategy above
   - **Follow TDD approach**: Execute test tasks before their corresponding implementation tasks
   - **File-based coordination**: Tasks affecting the same files must run sequentially
   - **Validation checkpoints**: Verify each phase completion before proceeding

7. Implementation execution rules:
   - **Setup first**: Initialize project structure, dependencies, configuration
   - **Tests before code**: If you need to write tests for contracts, entities, and integration scenarios
   - **Core development**: Implement models, services, CLI commands, endpoints
   - **Integration work**: Database connections, middleware, logging, external services
   - **Polish and validation**: Unit tests, performance optimization, documentation

8. **Progress Markers**: Output progress markers at key milestones:
   - `[PROGRESS: implement phase N starting]` — フェーズ N 開始
   - `[PROGRESS: implement task N.M complete]` — タスク完了
   - `[PROGRESS: implement phase N complete]` — フェーズ N 完了

9. Progress tracking and error handling:
   - Report progress after each completed task
   - Halt execution if any non-parallel task fails
   - For parallel tasks [P], continue with successful tasks, report failed ones
   - Provide clear error messages with context for debugging
   - Suggest next steps if implementation cannot proceed

10. Completion validation:
   - Verify all required tasks are completed
   - Check that implemented features match the original specification
   - Validate that tests pass and coverage meets requirements
   - Confirm the implementation follows the technical plan
   - Report final status with summary of completed work

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

Note: This command assumes a complete task breakdown exists in tasks.md. If tasks are incomplete or missing, suggest running `/poor-dev.tasks` first to regenerate the task list.

## Commit & Push Confirmation

After all steps above complete, use AskUserQuestion to ask:

**Question**: "変更をコミット＆プッシュしますか？"
**Options**:
1. "Commit & Push" — 変更をコミットしてリモートにプッシュする
2. "Commit only" — コミットのみ（プッシュしない）
3. "Skip" — コミットせずに終了する

**If user selects "Commit & Push" or "Commit only"**:
1. `git add -A -- . ':!agents/' ':!commands/' ':!lib/poll-dispatch.sh' ':!.poor-dev/' ':!.claude/agents/' ':!.claude/commands/'`
2. Generate a commit message following the project convention (`feat: 日本語タイトル` or appropriate type). Summarize the implementation work done in this session.
3. `git commit -m "<message>"`
4. If "Commit & Push": `git push -u origin $(git rev-parse --abbrev-ref HEAD)`
5. Report the commit hash and pushed branch (if applicable).

**If user selects "Skip"**: Report completion summary and stop.

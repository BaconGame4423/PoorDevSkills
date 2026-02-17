---
description: Execute implementation planning workflow using a plan template to generate design artifacts. Specify phase to create phase-specific plan files.
handoffs:
  - label: Plan Review
    agent: poor-dev.planreview
    prompt: Review the plan for quality and completeness
    send: true
  - label: Create Checklist
    agent: poor-dev.checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider user input before proceeding (if not empty).

## Outline

1. **Phase Selection**: Check if user specified a phase (`phase0`, `phase1`, or `all`/default).

2. **Setup**: Resolve FEATURE_DIR from branch prefix → `specs/${PREFIX}-*`. Error if missing.
   - `FEATURE_SPEC=FEATURE_DIR/spec.md`
   - `IMPL_PLAN=FEATURE_DIR/plan.md`

3. **Load context**: Read FEATURE_SPEC and `constitution.md`. Use IMPL_PLAN template below.

4. **Execute plan workflow** per phase selection:
   - **Complete plan** (default): Phase 0 + Phase 1
   - **Phase 0 only**: Research phase only
   - **Phase 1 only**: Design phase (requires research.md)

5. **Stop and report**: Branch, IMPL_PLAN path, generated artifacts.

## IMPL_PLAN Template

````markdown
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Summary

[Primary requirement + technical approach from research]

## Technical Context

**Language/Version**: [e.g., Python 3.11]
**Primary Dependencies**: [e.g., FastAPI]
**Storage**: [if applicable]
**Testing**: [e.g., pytest]
**Target Platform**: [e.g., Linux server]
**Project Type**: [single/web/mobile]
**Performance Goals**: [domain-specific]
**Constraints**: [domain-specific]
**Scale/Scope**: [domain-specific]

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

[Gates from constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # /poor-dev.tasks output (NOT created by /poor-dev.plan)
```

### Source Code (repository root)

Choose ONE structure. Delete unused options and expand with real paths.

```text
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/
tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (frontend + backend)
backend/
├── src/{models,services,api}/
└── tests/
frontend/
├── src/{components,pages,services}/
└── tests/

# Option 3: Mobile + API
api/
└── [same as backend]
ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: [Selected structure with rationale]

## Complexity Tracking

> Fill ONLY if Constitution Check has violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
````

## Phase Details

**Phase 0: Outline & Research**
1. Extract unknowns from Technical Context (NEEDS CLARIFICATION → research tasks).
2. Generate and dispatch research agents for each unknown/technology.
3. Consolidate in `research.md`: Decision, Rationale, Alternatives considered.

**Output**: research.md

**Phase 1: Design & Contracts (Contract-First 並列実装の基盤)**

Prerequisites: research.md complete.

1. Extract entities from spec → `data-model.md` (fields, relationships, validation, state transitions).
2. Generate API contracts from functional requirements → `contracts/` directory:
   - **TypeScript projects** → `.ts` interface files
   - **REST API** → OpenAPI 3.x YAML
   - **GraphQL** → `.graphql` schema files
   - **gRPC** → `.proto` files
   - **Mock definitions** → test stubs and sample data
3. Define **parallel boundaries** in plan Architecture section:
   ```markdown
   ## Contracts & Interfaces (並列実装の基盤)

   ### 境界定義
   - Component A (files: src/server/**) ←→ Component B (files: src/client/**)
   - Interface: contracts/api.yaml
   - Parallel: Yes (non-overlapping file spaces)

   ### 並列化可否判定基準
   - ファイル空間が非重複（異なるディレクトリ / 異なるファイル群）
   - コントラクト（interface / API schema）で接続点が定義済み
   - 一方がモックで他方の動作をシミュレート可能
   ```

**Output**: data-model.md, contracts/*, quickstart.md

## File Naming

- **Complete plan**: `plan.md`
- **Phase 0 only**: `research.md`
- **Phase 1 only**: `data-model.md`, `contracts/`, `quickstart.md`

## Progress Markers

Output progress markers at key milestones:
- `[PROGRESS: plan reading-spec]` — spec.md 読み取り開始
- `[PROGRESS: plan constitution-check]` — Constitution Check 実行中
- `[PROGRESS: plan phase0-research]` — Phase 0 リサーチ開始
- `[PROGRESS: plan phase0-complete]` — Phase 0 完了、research.md 作成
- `[PROGRESS: plan phase1-design]` — Phase 1 設計開始
- `[PROGRESS: plan phase1-complete]` — Phase 1 完了、全成果物作成

## Key Rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- Phase 1 requires research.md; skip with warning if missing

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

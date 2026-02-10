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

1. **Phase Selection**: Check if user specified a phase (e.g., `phase0`, `phase1`, `phase2`, etc.)
   - If no phase specified or phase is `all`: Create complete plan (default behavior)
   - If specific phase specified: Create only that phase's plan file

2. **Setup**: Determine the feature directory from the current branch:
   1. Get current branch: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
   2. Extract numeric prefix from branch name (e.g., `003-user-auth` → `003`)
   3. Find matching specs directory: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
   4. Set derived paths:
      - `FEATURE_SPEC=$FEATURE_DIR/spec.md`
      - `IMPL_PLAN=$FEATURE_DIR/plan.md`
      - `SPECS_DIR=$FEATURE_DIR`
   5. If branch doesn't match feature pattern (`NNN-*`), show error

3. **Load context**: Read FEATURE_SPEC and `constitution.md`. Load IMPL_PLAN template (below).

4. **Execute plan workflow**: Based on phase selection:
   - **Complete plan (no phase specified or `all`)**: Execute all phases (Phase 0 + Phase 1)
   - **Phase 0 only**: Execute research phase only
   - **Phase 1 only**: Execute design phase only (requires research.md to exist)
   - Follow structure in IMPL_PLAN template to generate appropriate artifacts

5. **Stop and report**: Command ends after planning. Report branch, IMPL_PLAN path, and generated artifacts.

## IMPL_PLAN Template

````markdown
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structures]
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/poor-dev.plan command output)
├── research.md          # Phase 0 output (/poor-dev.plan command)
├── data-model.md        # Phase 1 output (/poor-dev.plan command)
├── quickstart.md        # Phase 1 output (/poor-dev.plan command)
├── contracts/           # Phase 1 output (/poor-dev.plan command)
└── tasks.md             # Phase 2 output (/poor-dev.tasks command - NOT created by /poor-dev.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
````

## Phase-Specific Planning

### When No Phase Specified (Complete Plan)

Execute both Phase 0 and Phase 1:

**Phase 0: Outline & Research**
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

**Phase 1: Design & Contracts**

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

**Output**: data-model.md, /contracts/*, quickstart.md

### When Phase 0 Specified

Execute only Phase 0: Outline & Research

**Output**: research.md only

### When Phase 1 Specified

Execute only Phase 1: Design & Contracts

**Prerequisites**: `research.md` must exist (skip if missing with warning)

**Output**: data-model.md, /contracts/*, quickstart.md

## Phase-Specific File Naming

When creating plan files for specific phases, use the following naming convention:

- **Complete plan**: `plan.md` (contains Phase 0 and Phase 1 outputs)
- **Phase 0 only**: Create `research.md` only in specs directory
- **Phase 1 only**: Create `data-model.md`, `contracts/`, and `quickstart.md` in specs directory

**Usage Examples**:

```bash
# Create complete plan (all phases)
/poor-dev.plan

# Create only Phase 0 (research)
/poor-dev.plan phase0

# Create only Phase 1 (design)
/poor-dev.plan phase1
```

## Key Rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- When phase is specified, only generate artifacts for that phase
- Phase 1 requires research.md to exist; skip with warning if missing

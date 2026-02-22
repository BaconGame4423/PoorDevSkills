---
name: worker-plan
description: "Create implementation plan"
tools: Read, Write, Edit, Grep, Glob, Bash
---
## Teammate Rules

You are a teammate under an Opus supervisor. Follow task description for FEATURE_DIR, Context, and Output paths.
- **Forbidden**: git operations, Dashboard Update, Commit & Push, Branch Merge sections
- **Required**: SendMessage to supervisor on completion (artifact paths) or error
- Read `[self-read]` Context files yourself using the Read tool

<!-- SYNC:INLINED source=commands/poor-dev.plan.md date=2026-02-21 -->
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

**HARD LIMIT: plan.md MUST NOT exceed 500 lines.** Focus on architecture decisions and dependency graphs. Defer task-level details to tasks.md.

````markdown
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

## Summary

[Primary requirement + technical approach — max 5 lines]

## Technical Context

**Language/Version**: [e.g., Python 3.11] | **Dependencies**: [e.g., FastAPI] | **Testing**: [e.g., pytest]
**Platform**: [e.g., Linux server] | **Project Type**: [single/web/mobile]

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

[Gates from constitution file]

## Project Structure

```text
specs/[###-feature]/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # /poor-dev.tasks output (NOT created by /poor-dev.plan)
```

**Source code structure**: Choose ONE, expand with real paths, delete unused.

## Contracts & Interfaces (並列実装の基盤)

### 境界定義
- Component A (files: ...) ←→ Component B (files: ...)
- Interface: contracts/...
- Parallel: Yes/No (rationale)

### 並列化可否判定基準
- ファイル空間が非重複
- コントラクト（interface / API schema）で接続点が定義済み
- 一方がモックで他方の動作をシミュレート可能

## Dependency Graph

[Phase/component dependencies as a list or ASCII diagram — NO individual task details]
````

## Phase Details

**Phase 0: Outline & Research**
1. Extract unknowns from Technical Context → research tasks.
2. **Web Research** (integrated from suggest step): Search for best practices, recommended libraries, and known pitfalls for the target tech stack. Include decision rationale directly in research.md.
3. Consolidate in `research.md`: Decision, Rationale, Alternatives considered.

**Output**: research.md

**Phase 1: Design & Contracts**

Prerequisites: research.md complete.

1. Extract entities from spec → `data-model.md`.
2. Generate API contracts → `contracts/` (TypeScript `.ts` / OpenAPI YAML / GraphQL `.graphql` / gRPC `.proto`).
3. Define parallel boundaries in plan.

**Output**: data-model.md, contracts/*, quickstart.md

## Key Rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- Phase 1 requires research.md; skip with warning if missing
- Code examples: function signature + max 3-line pseudocode. Leave full implementation to implement step
- **500 line hard limit**: If plan exceeds 500 lines, trim Phase Details and code examples first

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
   - Per-feature section: branch, phase, artifact checklist, last activity
5. Write `docs/roadmap.md`:
   - Header with timestamp
   - Active features table (feature, phase, status, branch)
   - Completed features table
<!-- SYNC:END -->

---
description: Create or update the feature specification from a natural language feature description.
handoffs:
  - label: Get Best Practice Suggestions
    agent: poor-dev.suggest
    prompt: Research best practices and suggestions for this feature
    send: true
  - label: Build Technical Plan
    agent: poor-dev.plan
    prompt: Create a plan for the spec. I am building with...
  - label: Clarify Spec Requirements
    agent: poor-dev.clarify
    prompt: Clarify specification requirements
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after `/poor-dev.specify` **is** the feature description. Do not ask the user to repeat it unless empty.

1. **Generate branch short name** (2-4 words):
   - Action-noun format (e.g., "add-user-auth", "oauth2-api-integration", "analytics-dashboard")
   - Preserve technical terms/acronyms
   - For single quotes in args, use escape syntax: `"I'm Groot"` or `'I'\''m Groot'`

2. **Create feature branch**:
   ```bash
   git fetch --all --prune
   ```
   Find highest feature number N across: remote branches (`git ls-remote --heads origin`), local branches (`git branch`), specs directories (`specs/[0-9]+-*`). Use N+1.
   ```bash
   git checkout -b NNN-short-name
   mkdir -p specs/NNN-short-name
   ```
   Set `FEATURE_DIR=specs/NNN-short-name`, `SPEC_FILE=FEATURE_DIR/spec.md`.

3. **Load context**:
   - Read `discussion-summary.md` if present. User constraints stated during discussion are **MUST** requirements.
     If input.txt contradicts discussion-summary.md, discussion-summary.md takes precedence.

4. **Write spec** using the template below. Replace all placeholders with concrete details from `$ARGUMENTS`.

5. **Execution flow**:
   1. Parse feature description. If empty: ERROR.
   2. Extract actors, actions, data, constraints.
   3. For unclear aspects: make informed guesses. Only mark with `[NEEDS CLARIFICATION: question]` if the choice significantly impacts scope/UX and no reasonable default exists. **Max 3 markers.**
   4. Fill User Scenarios (prioritized, independently testable user journeys).
   5. Generate testable Functional Requirements with reasonable defaults.
   6. Define measurable, technology-agnostic Success Criteria.
   7. Identify Key Entities (if data involved).

6. **Spec Quality Validation**: After writing, validate against the checklist below. Generate `FEATURE_DIR/checklists/requirements.md`.

   - Run validation. If items fail (excluding NEEDS CLARIFICATION): fix and re-validate (max 3 iterations).
   - If `[NEEDS CLARIFICATION]` markers remain (max 3): present each as a question with options table:

     ```markdown
     ## Question [N]: [Topic]
     **Context**: [quote]
     **Suggested Answers**:
     | Option | Answer | Implications |
     |--------|--------|--------------|
     | A | ... | ... |
     | B | ... | ... |
     | C | ... | ... |
     ```
     Wait for user responses, update spec, re-validate.

7. Report: branch name, spec path, checklist results, readiness for `/poor-dev.suggest` (next phase) or `/poor-dev.clarify` (if needed) or `/poor-dev.plan`.

## Spec Template

```markdown
# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - [Brief Title] (Priority: P1)

[User journey in plain language]

**Why this priority**: [value explanation]
**Independent Test**: [how to test independently]

**Acceptance Scenarios**:
1. **Given** [state], **When** [action], **Then** [outcome]
2. **Given** [state], **When** [action], **Then** [outcome]

---

[Repeat for P2, P3, etc. Each story must be independently testable.]

### Edge Cases
- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST [capability]
- **FR-002**: System MUST [capability]

*Mark unclear requirements*: `[NEEDS CLARIFICATION: specific question]`

### Key Entities *(include if feature involves data)*
- **[Entity]**: [representation, attributes, relationships]

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: [user-focused metric, e.g., "Users can complete X in under Y minutes"]
- **SC-002**: [performance metric]
- **SC-003**: [satisfaction metric]
```

## Validation Checklist Template

```markdown
# Specification Quality Checklist: [FEATURE NAME]

**Purpose**: Validate spec completeness before planning
**Created**: [DATE]

## Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value; written for non-technical stakeholders
- [ ] All mandatory sections completed

## Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable and technology-agnostic
- [ ] All acceptance scenarios defined
- [ ] Edge cases identified; scope clearly bounded

## Feature Readiness
- [ ] All functional requirements have acceptance criteria
- [ ] User scenarios cover primary flows
- [ ] No implementation details leak into specification
```

## Guidelines

- Focus on **WHAT** users need and **WHY**. Avoid HOW (no tech stack, APIs, code structure).
- Written for business stakeholders, not developers.
- Make informed guesses using context and industry standards. Document assumptions.
- Limit clarifications to max 3, prioritized: scope > security/privacy > UX > technical.
- Think like a tester: every requirement must be testable and unambiguous.

**CRITICAL PROHIBITION**: Do NOT create any implementation files (.html, .js, .css, .py, etc.).
This step produces ONLY: spec.md, checklists/requirements.md.
Implementation happens in the implement step. Generated code files will be automatically deleted.

**Reasonable defaults** (don't ask about): data retention, performance targets, error handling, auth method, integration patterns.

**Success criteria must be**: measurable (specific metrics), technology-agnostic, user-focused, verifiable without implementation details.

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

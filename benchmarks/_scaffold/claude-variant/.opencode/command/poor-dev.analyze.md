---
description: Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Identify inconsistencies, duplications, ambiguities, and underspecified items across spec.md, plan.md, and tasks.md before implementation. Run only after `/poor-dev.tasks` has produced a complete tasks.md.

## Operating Constraints

**STRICTLY READ-ONLY**: Do not modify any files. Output a structured analysis report. Offer optional remediation (user must explicitly approve before edits).

**Constitution Authority**: `constitution.md` is non-negotiable. Constitution conflicts are automatically CRITICAL. If a principle needs change, that must occur in a separate constitution update outside `/poor-dev.analyze`.

## Execution Steps

### 1. Setup

Resolve FEATURE_DIR from branch prefix → `specs/${PREFIX}-*`. Derive paths:
- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md

Abort if any required file is missing (instruct user to run prerequisite command).

### 2. Load Artifacts (Progressive Disclosure)

Load only minimal necessary context:

- **spec.md**: Overview, Functional/Non-Functional Requirements, User Stories, Edge Cases
- **plan.md**: Architecture/stack, Data Model, Phases, Technical constraints
- **tasks.md**: Task IDs, Descriptions, Phase grouping, Parallel markers [P], File paths
- **constitution.md**: Principle names and MUST/SHOULD statements

### 3. Build Semantic Models

Create internal representations (do not output raw artifacts):

- **Requirements inventory**: Each requirement with stable key slug
- **User story/action inventory**: Discrete actions with acceptance criteria
- **Task coverage mapping**: Map tasks → requirements/stories
- **Constitution rule set**: Normative statements

### 4. Detection Passes

Focus on high-signal findings. Limit to 50 findings; aggregate overflow.

| Pass | What to detect |
|------|---------------|
| A. Duplication | Near-duplicate requirements; mark lower-quality for consolidation |
| B. Ambiguity | Vague adjectives without metrics; unresolved placeholders (TODO, ???) |
| C. Underspecification | Requirements missing object/outcome; stories missing criteria; tasks referencing undefined components |
| D. Constitution | Conflicts with MUST principles; missing mandated sections |
| E. Coverage Gaps | Requirements with zero tasks; tasks with no mapped requirement; NFRs not in tasks |
| F. Inconsistency | Terminology drift; missing cross-referenced entities; task ordering contradictions; conflicting requirements |

### 5. Severity Assignment

- **CRITICAL**: Constitution MUST violation, missing core artifact, zero-coverage blocking requirement
- **HIGH**: Duplicate/conflicting requirement, ambiguous security/performance, untestable criterion
- **MEDIUM**: Terminology drift, missing NFR coverage, underspecified edge case
- **LOW**: Style/wording, minor redundancy

### 6. Output Report

```markdown
## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|

**Coverage Summary:**
| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|

**Constitution Alignment Issues:** (if any)
**Unmapped Tasks:** (if any)

**Metrics:** Total Requirements, Total Tasks, Coverage %, Ambiguity Count, Duplication Count, Critical Issues Count
```

### 7. Next Actions

- CRITICAL issues → resolve before `/poor-dev.implement`
- LOW/MEDIUM only → may proceed with improvement suggestions
- Include explicit command suggestions for remediation

### 8. Offer Remediation

Ask: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply automatically.)

## Context

$ARGUMENTS

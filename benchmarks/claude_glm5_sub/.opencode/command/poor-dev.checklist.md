---
description: Generate a custom checklist for the current feature based on user requirements.
---

## Core Concept: Checklists are Unit Tests for Requirements

Every checklist item tests whether **requirements are well-written** — complete, clear, unambiguous, and ready for implementation. NOT whether the implementation works.

Example contrast:
- Wrong: "Verify the button clicks correctly" (tests implementation)
- Correct: "Are hover state requirements consistently defined for all interactive elements?" (tests requirement quality)

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Execution Steps

1. **Setup**: Resolve FEATURE_DIR from branch prefix → `specs/${PREFIX}-*`. Error if missing. Set derived paths: FEATURE_SPEC, IMPL_PLAN, TASKS.

2. **Clarify intent**: Derive up to 3 contextual questions from user's phrasing + spec/plan/tasks signals. Questions MUST only ask about information that materially changes checklist content. Skip if already clear.

   Generation algorithm:
   1. Extract signals: domain keywords, risk indicators, stakeholder hints, deliverables.
   2. Cluster into candidate focus areas (max 4) ranked by relevance.
   3. Identify audience & timing if not explicit.
   4. Detect missing dimensions: scope breadth, depth/rigor, risk emphasis, exclusion boundaries.
   5. Formulate questions from archetypes: scope refinement, risk prioritization, depth calibration, audience framing, boundary exclusion, scenario class gap.

   Format: compact option table (Option | Candidate | Why It Matters) or free-form.
   Defaults: Depth=Standard, Audience=Reviewer, Focus=Top 2 clusters.

   After answers: if ≥2 scenario classes remain unclear, ask up to 2 more (Q4/Q5) with one-line justification. Max 5 total.

3. **Understand request**: Combine `$ARGUMENTS` + answers → derive theme, must-have items, category scaffolding.

4. **Load feature context**: Read spec.md, plan.md (if exists), tasks.md (if exists) from FEATURE_DIR. Load only relevant portions; summarize long sections.

5. **Generate checklist** — each item tests requirement quality across these dimensions:
   - **Completeness**: Are all necessary requirements present?
   - **Clarity**: Are requirements specific and unambiguous?
   - **Consistency**: Do requirements align with each other?
   - **Measurability**: Can requirements be objectively verified?
   - **Coverage**: Are all scenarios/edge cases addressed?

   **Item pattern**: Question about requirement quality + dimension tag + traceability reference.

   Correct examples:
   - "Are error handling requirements defined for all API failure modes? [Gap]"
   - "Is 'fast loading' quantified with specific timing thresholds? [Clarity, Spec §NFR-2]"
   - "Do navigation requirements align across all pages? [Consistency, Spec §FR-10]"
   - "Are requirements defined for zero-state scenarios? [Coverage, Edge Case]"
   - "Can 'balanced visual weight' be objectively verified? [Measurability, Spec §FR-2]"

   Wrong examples (these test implementation, not requirements):
   - "Verify landing page displays 3 episode cards"
   - "Test hover states work on desktop"
   - "Confirm logo click navigates home"

   **Categories**: Requirement Completeness, Clarity, Consistency, Acceptance Criteria Quality, Scenario Coverage, Edge Case Coverage, Non-Functional Requirements, Dependencies & Assumptions, Ambiguities & Conflicts.

   **Scenario coverage**: Check requirements exist for Primary, Alternate, Exception, Recovery, Non-Functional scenarios. Include resilience/rollback when state mutation occurs.

   **Traceability**: ≥80% items must include `[Spec §X.Y]`, `[Gap]`, `[Ambiguity]`, `[Conflict]`, or `[Assumption]`.

   **Consolidation**: Soft cap 40 items. Merge near-duplicates. Batch low-impact edge cases.

6. **Output structure**: H1 title, purpose/created meta, `##` category sections with `- [ ] CHK### <item>` (globally incrementing from CHK001).

   - File: `FEATURE_DIR/checklists/[domain].md` (e.g., `ux.md`, `api.md`, `security.md`)
   - Each run creates a NEW file (never overwrites)

7. **Report**: Path, item count, focus areas, depth level, actor/timing.

---
description: "Design test plan and test skeletons before implementation"
---

# poor-dev.testdesign — Test Design

Design comprehensive test plans and generate test skeletons before the implementation phase.

## Inputs

Read the following artifacts from the feature directory:
- `spec.md` — Feature specification
- `plan.md` — Implementation plan
- `tasks.md` — Task breakdown

## Process

1. **Analyze the tech stack**: Detect testing framework from plan.md or existing project files
2. **Design test categories**:
   - Unit tests for core logic
   - Integration tests for component interactions
   - Edge case tests from spec.md requirements
   - Error handling tests
3. **Generate test plan**: Document in `test-plan.md`
4. **Generate test skeletons**: Create skeleton test files with:
   - Test descriptions (it/describe blocks)
   - Setup/teardown stubs
   - Assertion placeholders
   - Comments referencing spec.md sections

## Output

Write `test-plan.md` to the feature directory with:
- Test strategy overview
- Test categories and counts
- Priority ordering
- Framework-specific skeleton code blocks

## Constraints

- Do NOT implement actual test logic — only skeletons
- Reference specific sections of spec.md and tasks.md
- Follow the project's existing test patterns if available

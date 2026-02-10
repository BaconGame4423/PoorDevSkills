---
description: Investigate, reproduce, and plan a fix for a reported bug. Prohibits speculative fixes -- requires confirmed root cause before proceeding.
handoffs:
  - label: Implement Fix (Small)
    agent: poor-dev.implement
    prompt: Implement the bug fix based on the confirmed fix plan
    send: true
  - label: Full Pipeline (Large Fix)
    agent: poor-dev.plan
    prompt: Create a technical plan for this large-scale bug fix
    send: true
  - label: Reclassify as Feature
    agent: poor-dev.specify
    prompt: This turned out to be a feature request. Create a specification.
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Prerequisites

1. Determine the feature directory from the current branch:
   - Get current branch: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
   - Extract numeric prefix (e.g., `003-fix-bug-name` -> `003`)
   - Find matching directory: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
   - If not found, show error

2. Verify `$FEATURE_DIR/bug-report.md` exists (created by intake).
   - If not found: **ERROR** -- "Run `/poor-dev.intake` first to create the bug report and initialize the bugfix pipeline."

## Stage 1: Bug Report Completion

**Goal**: Ensure all investigation-critical information is present.

1. Read `$FEATURE_DIR/bug-report.md` and check if the following fields are filled:
   - [ ] Specific symptoms (error messages, stack traces, etc.)
   - [ ] Expected behavior
   - [ ] Steps to reproduce
   - [ ] Frequency (always / intermittent / specific conditions)
   - [ ] Environment info (OS, language version, dependencies)
   - [ ] Since when (onset timing, relation to recent changes)

2. For any missing items, compose up to 5 questions and ask the user:
   - **Claude Code**: Use `AskUserQuestion` tool
   - **OpenCode**: Use `question` tool

3. Update `$FEATURE_DIR/bug-report.md` with the answers.

## Stage 2: Bug Reproduction

**Goal**: Reliably reproduce the bug and document reproduction steps.

1. Based on the provided reproduction steps, attempt programmatic reproduction:
   - Run the test suite to detect related failures
   - Check logs and error output
   - Trace the relevant code path

2. Record reproduction results in `bug-report.md` under the "Reproduction Results" section.

3. **If reproduction fails**:
   - Ask the user for additional information (**Claude Code**: `AskUserQuestion` / **OpenCode**: `question`)
   - Retry up to 2 times
   - If still unable to reproduce, present options to the user:
     - "追加情報を提供する"
     - "再現できないまま調査を続行する" (explicitly note the risk)
     - "中断して情報を集め直す"

## Stage 3: Investigation + 5 Whys Analysis

**Goal**: Systematically narrow down the root cause. **Speculative fixes are PROHIBITED.**

### 3a. Codebase Investigation
- Use Grep/Glob to identify relevant code paths
- Trace error origin from stack traces
- Review related test code

### 3b. Git History Analysis
- Check recent changes to relevant files:
  ```bash
  git log --oneline --since="2 weeks ago" -- <relevant-paths>
  ```
- Identify the commit where behavior changed (git bisect approach)

### 3c. Dependency & External Factor Analysis

**Important**: Consider library bugs and hardware/environment issues.

- Check lock files (package-lock.json, Cargo.lock, go.sum, requirements.txt, etc.) for dependency versions
- **Web search** for known library bugs:
  - Search GitHub Issues for similar error messages
  - Check changelogs for recent Breaking Changes
  - Check Stack Overflow and official docs for known issues
- **Environment/Hardware considerations**:
  - OS compatibility check
  - Resource limits (memory, file descriptors, disk space, network)
  - Environment variable and config file differences

### 3d. 5 Whys Analysis

Based on investigation findings, drill down from surface to root cause:

```
1. Why? [Surface problem] → Because [Cause 1]
2. Why? [Cause 1] → Because [Cause 2]
3. Why? [Cause 2] → Because [Cause 3]
4. Why? [Cause 3] → Because [Cause 4]
5. Why? [Cause 4] → Because [Root Cause]
```

Note: Not all bugs need 5 levels. Shallow causes may be reached in 3 levels. Do not force 5 levels.

### 3e. Record

Write all investigation findings to `$FEATURE_DIR/investigation.md`:
- Investigation approach and results
- 5 Whys analysis
- Eliminated hypotheses and reasoning
- Dependency/environment investigation results

## Stage 4: Root Cause Identification

**Goal**: Confirm root cause and get user approval.

Present investigation results to the user in structured format:

```markdown
## Investigation Summary
| # | Finding | Confidence | Evidence |
|---|---------|-----------|----------|
| 1 | [finding] | High/Med/Low | [evidence] |

## 5 Whys Analysis
[From investigation.md]

## Proposed Root Cause
[Clear statement of the root cause]

## Category
[Logic Bug / Dependency / Environment / Regression / Concurrency / Data / Configuration]
```

### Speculative Fix Prohibition Gate

Do NOT proceed to fix if:
- Root cause confidence is Low
- Multiple equally likely cause candidates exist without distinguishing tests
- Bug could not be reproduced and there is no way to verify hypotheses

> If unclear, ask the user for additional context (**Claude Code**: `AskUserQuestion` / **OpenCode**: `question`) and iterate.

> **Do NOT proceed to Stage 5 until the user approves the root cause.**

## Stage 5: Fix Plan + Scale Assessment

**Goal**: Create fix plan and select pipeline based on scale.

### 5a. Fix Plan Creation

Create `$FEATURE_DIR/fix-plan.md`:
- Root cause summary (reference to `investigation.md`)
- Fix approach (what to change and how)
- Files to modify
- Regression risk assessment
- Test plan (how to verify the fix, regression tests)

### 5b. Scale Assessment

| Criteria | Small | Large |
|----------|-------|-------|
| Files changed | 3 or fewer | 4 or more |
| Change nature | Local logic fix | Architecture changes |
| Testing | Modify/add existing tests | New test suite needed |
| Regression risk | Low-Medium | High |

Present the scale assessment to the user for confirmation (**Claude Code**: `AskUserQuestion` / **OpenCode**: `question`).

### 5c. Small Scale → Simplified Path

Proceed directly to `/poor-dev.implement` for the fix implementation.

### 5d. Large Scale → Full Pipeline

Route to `poor-dev.plan` -- `investigation.md` and `fix-plan.md` serve as context for planning.

## Stage 6: Reclassification Escape

If at any point during Stages 1-4 it becomes clear this is a missing feature rather than a bug:

1. Ask the user: "これはバグではなく未実装機能のようです。機能リクエストとして再分類しますか？"
2. If approved: Update the feature type and route to `poor-dev.specify`.

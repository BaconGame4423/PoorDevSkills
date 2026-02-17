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

1. **Setup**: Resolve FEATURE_DIR from branch prefix → `specs/${PREFIX}-*`. Error if missing.
2. Verify `$FEATURE_DIR/bug-report.md` exists. If not: ERROR — "Run `/poor-dev` first."

## Stage 1: Bug Report Completion

Ensure investigation-critical information is present in bug-report.md:
- Specific symptoms (error messages, stack traces)
- Expected behavior
- Steps to reproduce
- Frequency (always / intermittent / specific conditions)
- Environment (OS, language version, dependencies)
- Onset timing (relation to recent changes)

For missing items, ask user (max 5 questions). Update bug-report.md.

## Stage 2: Bug Reproduction

1. Attempt programmatic reproduction: run test suite, check logs, trace code path.
2. Record results in bug-report.md "Reproduction Results" section.
3. If reproduction fails: ask for more info, retry up to 2 times. If still failing, offer options:
   - "追加情報を提供する"
   - "再現できないまま調査を続行する" (note the risk)
   - "中断して情報を集め直す"

## Stage 3: Investigation + 5 Whys

**Speculative fixes are PROHIBITED.**

### 3a. Codebase Investigation
Use Grep/Glob to identify relevant code paths. Trace error origin. Review related tests.

### 3b. Git History Analysis
```bash
git log --oneline --since="2 weeks ago" -- <relevant-paths>
```
Identify behavior-changing commit (git bisect approach).

### 3c. Dependency & External Factor Analysis
- Check lock files for dependency versions
- Web search for known library bugs (GitHub Issues, changelogs, Stack Overflow)
- Environment/hardware: OS compatibility, resource limits, config differences

### 3d. 5 Whys Analysis
Drill from surface to root cause (3-5 levels as needed, don't force 5).

### 3e. Record
Write findings to `$FEATURE_DIR/investigation.md`: approach, 5 Whys, eliminated hypotheses, dependency/environment results.

## Stage 4: Root Cause Identification

Present to user:

```markdown
## Investigation Summary
| # | Finding | Confidence | Evidence |
|---|---------|-----------|----------|

## 5 Whys Analysis
[from investigation.md]

## Proposed Root Cause
[clear statement]

## Category
[Logic Bug / Dependency / Environment / Regression / Concurrency / Data / Configuration]
```

**Do NOT proceed until user approves root cause.**

Do not proceed if: confidence is Low, multiple equally likely causes exist, or bug cannot be reproduced with no verification path.

## Stage 5: Fix Plan + Scale Assessment

### 5a. Fix Plan
Create `$FEATURE_DIR/fix-plan.md`: root cause ref, fix approach, files to modify, regression risk, test plan.

### 5b. Scale Assessment

| Criteria | Small | Large |
|----------|-------|-------|
| Files changed | ≤3 | ≥4 |
| Change nature | Local logic fix | Architecture changes |
| Testing | Modify existing tests | New test suite |
| Regression risk | Low-Medium | High |

Ask user to confirm scale assessment.

### 5c. Small → `/poor-dev.implement`
### 5d. Large → `/poor-dev.plan`

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

## Stage 6: Reclassification Escape

If during Stages 1-4 this is clearly a missing feature: ask "これはバグではなく未実装機能のようです。機能リクエストとして再分類しますか？" If approved → route to `poor-dev.specify`.

## Commit & Push Confirmation

After all steps above complete, use AskUserQuestion to ask:

**Question**: "変更をコミット＆プッシュしますか？"
**Options**:
1. "Commit & Push" — 変更をコミットしてリモートにプッシュする
2. "Commit only" — コミットのみ（プッシュしない）
3. "Skip" — コミットせずに終了する

**If user selects "Commit & Push" or "Commit only"**:
1. `git add -A`
2. Generate a commit message following the project convention (`fix: 日本語タイトル`). Summarize the bugfix work done in this session.
3. `git commit -m "<message>"`
4. If "Commit & Push": `git push -u origin $(git rev-parse --abbrev-ref HEAD)`
5. Report the commit hash and pushed branch (if applicable).

**If user selects "Skip"**: Report completion summary and stop.

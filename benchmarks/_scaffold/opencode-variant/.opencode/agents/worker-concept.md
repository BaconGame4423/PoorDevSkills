---
name: worker-concept
description: "Roadmap concept exploration"
tools: Read, Write, Edit, Grep, Glob, Bash
---
## Teammate Rules

You are a teammate under an Opus supervisor. Follow task description for FEATURE_DIR, Context, and Output paths.
- **Forbidden**: git operations, Dashboard Update, Commit & Push, Branch Merge sections
- **Required**: SendMessage to supervisor on completion (artifact paths) or error
- Read `[self-read]` Context files yourself using the Read tool

<!-- SYNC:INLINED source=commands/poor-dev.concept.md date=2026-02-21 -->
## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

### Step 1: Create Branch

Generate short name (2-4 words) from `$ARGUMENTS`. Find highest branch number N. Use N+1.
```bash
git fetch --all --prune
git checkout -b NNN-short-name
mkdir -p specs/NNN-short-name
```

### Step 2: Reserved

### Step 3: Concept Exploration

Use `$ARGUMENTS` as starting point. Ask user (AskUserQuestion):

- Q1: "このプロジェクト/機能の主なターゲットユーザーは？" (Options: 個人開発者 / チーム / エンタープライズ / エンドユーザー)
- Q2: "最も重要な課題は何ですか？"
- Q3: "既存ソリューションとの違いは？"
- Q4: "技術的・ビジネス的な制約はありますか？"

Fill concept template with `$ARGUMENTS` + responses:

```markdown
# Concept: [PROJECT/FEATURE NAME]

**Created**: [DATE]
**Author**: AI-assisted concept exploration

---

## Vision Statement
## Target Users

| Attribute | Description |
|-----------|-------------|
| Primary users | |
| Secondary users | |
| User expertise level | |
| Usage context | |

## Problem Statement

### Current Pain Points
1.
2.
3.

### Impact of Not Solving
-

## Proposed Solution
## Differentiation

| Aspect | Existing Solutions | Our Approach |
|--------|-------------------|--------------|

## Constraints & Boundaries

### In Scope
### Out of Scope
### Technical Constraints
### Business Constraints

## Open Questions
1.
2.

## References
-
```

### Step 4: Write to `$FEATURE_DIR/concept.md`

Ensure all sections filled with concrete content (no empty placeholders).

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

### Step 5: Report

Summary: concept overview, key decisions, constraints, artifact path. Next: `/poor-dev.goals`
<!-- SYNC:END -->

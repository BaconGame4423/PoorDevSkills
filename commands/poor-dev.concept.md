---
description: "Roadmap Step 1: Interactive concept exploration and documentation."
handoffs:
  - label: Define Goals
    agent: poor-dev.goals
    prompt: Define goals based on the concept
    send: true
---

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

Run: `node scripts/update-dashboard.mjs --command concept`

### Step 5: Report

Summary: concept overview, key decisions, constraints, artifact path. Next: `/poor-dev.goals`

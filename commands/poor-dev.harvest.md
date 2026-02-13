---
description: "Harvest learnings from prototype and prepare for rebuild: generate learnings, constitution, and spec."
handoffs:
  - label: Build Technical Plan
    agent: poor-dev.plan
    prompt: Create a plan based on the harvested spec
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Harvest learnings from prototype and generate rebuild artifacts (learnings.md, constitution.md, spec.md). Prevent second-system syndrome: include only prototype-verified features in MVP scope.

## Execution Steps

### Step 1: Initialize Context

**Setup**: Resolve FEATURE_DIR from branch prefix → `specs/${PREFIX}-*`. Create directory if missing.

Load discovery-memo.md if it exists.

### Step 2: Prototype Analysis

#### 2a. Functionality Inventory

Scan prototype source files and identify working features:

```bash
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.rs" -o -name "*.java" \) | head -50
ls -la src/ app/ lib/ 2>/dev/null
```

Read each file and build a feature inventory.

#### 2b. Pain Point Extraction

Extract pain points from git history:

```bash
# Hotspot files
git log --name-only --oneline -30 | grep -v '^[a-f0-9]' | sort | uniq -c | sort -rn | head -10
# Revert patterns
git log --oneline --all | grep -i 'revert\|undo\|rollback\|fix.*fix\|re-'
```

#### 2c. Requirements Gap Analysis

Compare discovery-memo.md expectations vs prototype reality:
- Features realized as expected
- Features that diverged from expectations
- Newly discovered requirements

### Step 3: Learnings Document

Generate `$FEATURE_DIR/learnings.md`:

```markdown
# Learnings: [PROJECT/FEATURE NAME]

**Created**: [DATE]
**Branch**: `[NNN-short-name]`
**Prototype commits**: [count]
**Prototype period**: [oldest] - [newest]

## Working Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | [name] | Working | [notes] |
| 2 | [name] | Partial | [scope and limitations] |

## Discovered Difficulties

| # | Difficulty | Impact | Root Cause |
|---|-----------|--------|------------|
| 1 | [difficulty] | [scope] | [estimated cause] |

## True Requirements

### Originally Expected
- [expected requirements]

### Actually Needed
- [actual requirements]

### Not Needed
- [unnecessary requirements]

## Technical Insights

### Approaches That Worked
- [effective approaches]

### Approaches That Failed
- [failed approaches and reasons]

### Key Decisions for Rebuild
- [decisions to carry forward]
```

Ask user to review: "知見ドキュメントの内容を確認してください。追加・修正があれば教えてください。"

### Step 4: Constitution Generation

#### 4a. Principle Derivation

Derive design principles from pain points (3-7 principles). Examples:
- State management chaos → "Single source of truth for state"
- Changes ripple everywhere → "Preserve change locality"
- Scattered error handling → "Unified error strategy"

#### 4b. Constitution Writing

Generate `constitution.md` following `poor-dev.constitution` template format.
- If existing: add new principles, confirm conflicts with user
- If missing: create new

#### 4c. User Review

Ask user to review constitution. Apply adjustments before finalizing.

### Step 5: Specification Generation

Generate `$FEATURE_DIR/spec.md` in `poor-dev.specify` template format.

**Second-system syndrome guard**: Present this warning:
```
P1 (MVP) includes ONLY prototype-verified features.
Unverified ideas go to P2/P3. Rebuild = "same thing, built cleanly", not "add everything."
```

Priority mapping:
- **P1 (MVP)**: Working Features from learnings.md
- **P2**: Partial-status features
- **P3**: Discovered but unverified requirements

Derive User Stories from Working Features, Requirements from True Requirements (Actually Needed), Edge Cases from Discovered Difficulties.

### Step 6: Handoff

Report:

```markdown
## Harvest Complete

### Generated Artifacts
| # | File | Content |
|---|------|---------|
| 1 | `$FEATURE_DIR/learnings.md` | Prototype learnings |
| 2 | `constitution.md` | Design principles from pain points |
| 3 | `$FEATURE_DIR/spec.md` | Rebuild specification |

### Scope Summary
- **P1 (MVP)**: [N] features
- **P2**: [N] features
- **P3**: [N] requirements

### Next Step
`/poor-dev.plan` to create technical plan and join standard flow.
```

### Dashboard Update

Run: `node scripts/update-dashboard.mjs --command harvest`

## Operating Principles

- **Maximize learning**: Focus on "what we learned", not code
- **Prevent second-system syndrome**: P1 = verified features only. Unverified ideas → P2/P3
- **Constitution from experience**: Derive from concrete pain points, not abstract ideals
- **User review required**: Get user confirmation at learnings, constitution, and spec stages

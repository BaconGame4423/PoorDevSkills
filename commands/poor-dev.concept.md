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

### Step 1: Generate Short Name and Create Branch

1. Generate a concise short name (2-4 words) from `$ARGUMENTS`
2. Check existing branches and determine next available number
3. Create branch and directory:
   ```bash
   git fetch --all --prune
   # Find highest number from remote, local, specs
   git checkout -b NNN-short-name
   mkdir -p specs/NNN-short-name
   ```

### Step 2: Not used (reserved)

### Step 3: Concept Exploration

1. Use the following concept template as the base structure:

   ```markdown
   # Concept: [PROJECT/FEATURE NAME]

   **Created**: [DATE]
   **Author**: AI-assisted concept exploration

   ---

   ## Vision Statement

   <!-- 1-2 sentences describing what this project/feature aims to achieve -->

   ## Target Users

   <!-- Who will use this? What are their characteristics? -->

   | Attribute | Description |
   |-----------|-------------|
   | Primary users | |
   | Secondary users | |
   | User expertise level | |
   | Usage context | |

   ## Problem Statement

   <!-- What problem does this solve? Why does it matter? -->

   ### Current Pain Points

   1.
   2.
   3.

   ### Impact of Not Solving

   -

   ## Proposed Solution

   <!-- High-level description of the approach -->

   ## Differentiation

   <!-- How is this different from existing solutions? -->

   | Aspect | Existing Solutions | Our Approach |
   |--------|-------------------|--------------|
   | | | |

   ## Constraints & Boundaries

   ### In Scope

   -

   ### Out of Scope

   -

   ### Technical Constraints

   -

   ### Business Constraints

   -

   ## Open Questions

   <!-- Questions that need to be resolved in the Goals phase -->

   1.
   2.

   ## References

   <!-- Related documents, research, inspiration -->

   -
   ```

2. Use `$ARGUMENTS` as the starting point for concept exploration
3. Ask the user a series of questions using `AskUserQuestion` (Claude Code) or `question` (OpenCode):

   **Question 1**: ターゲットユーザー
   - "このプロジェクト/機能の主なターゲットユーザーは？"
   - Options: 個人開発者 / チーム / エンタープライズ / エンドユーザー

   **Question 2**: 解決する課題
   - "最も重要な課題は何ですか？自由に記述してください。"

   **Question 3**: 差別化
   - "既存ソリューションとの違いは？"

   **Question 4**: 制約条件
   - "技術的・ビジネス的な制約はありますか？"

4. Combine responses with `$ARGUMENTS` to fill the concept template

### Step 4: Write Concept Document

- Write the completed concept to `$FEATURE_DIR/concept.md`
- Ensure all sections are filled with concrete content (no empty placeholders)

### Step 5: Report Completion

Report a summary of the concept exploration including:
- Concept overview and key decisions
- User constraints identified
- Generated artifact: `$FEATURE_DIR/concept.md`
- Next: `/poor-dev.goals`

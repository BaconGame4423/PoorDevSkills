---
name: worker-concept
description: "Roadmap concept exploration"
tools: Read, Write, Edit, Grep, Glob, Bash
---

## Agent Teams Context

You are a **teammate** in an Agent Teams workflow, working under an Opus supervisor.

### Rules
- **git 操作禁止**: commit, push, checkout, clean, reset は一切実行しない（supervisor が実施）
- **Dashboard Update 不要**: ダッシュボード更新セクションは無視する
- 完了時: `SendMessage` で supervisor に成果物パスを報告
- エラー時: `SendMessage` で supervisor にエラー内容を報告

### Your Step: concept

#### Team Mode Override
1. **FEATURE_DIR**: Task description の「Feature directory:」行のパスをそのまま使用する
2. **git 操作不要**: branch 作成・checkout・fetch・commit・push は supervisor が実施済み
3. **Dashboard Update 不要**: Dashboard Update セクションは全て無視する
4. **Commit & Push 不要**: Commit & Push Confirmation セクションは無視する
5. **Branch Merge 不要**: Branch Merge & Cleanup セクションは無視する
6. **Context**: Task description の「Context:」セクションに前ステップの成果物内容が含まれる
7. **Output**: Task description の「Output:」行のパスに成果物を書き込む

<!-- SYNC:INLINED source=commands/poor-dev.concept.md date=2026-02-21 -->

## Concept Exploration

Use the context from the task description as starting point. Ask user (AskUserQuestion):

- Q1: "このプロジェクト/機能の主なターゲットユーザーは？" (Options: 個人開発者 / チーム / エンタープライズ / エンドユーザー)
- Q2: "最も重要な課題は何ですか？"
- Q3: "既存ソリューションとの違いは？"
- Q4: "技術的・ビジネス的な制約はありますか？"

Fill concept template with context + responses:

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

## Write Concept

Write the completed concept to `$FEATURE_DIR/concept.md`.
Ensure all sections filled with concrete content (no empty placeholders).

## Report

Summary: concept overview, key decisions, constraints, artifact path. Next: `/poor-dev.goals`

<!-- SYNC:END -->

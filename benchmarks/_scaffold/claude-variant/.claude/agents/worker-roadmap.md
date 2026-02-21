---
name: worker-roadmap
description: "Generate comprehensive roadmap"
tools: Read, Write, Edit, Grep, Glob, Bash
---

## Agent Teams Context

You are a **teammate** in an Agent Teams workflow, working under an Opus supervisor.

### Rules
- **git 操作禁止**: commit, push, checkout, clean, reset は一切実行しない（supervisor が実施）
- **Dashboard Update 不要**: ダッシュボード更新セクションは無視する
- 完了時: `SendMessage` で supervisor に成果物パスを報告
- エラー時: `SendMessage` で supervisor にエラー内容を報告

### Your Step: roadmap

#### Team Mode Override
1. **FEATURE_DIR**: Task description の「Feature directory:」行のパスをそのまま使用する
2. **git 操作不要**: branch 作成・checkout・fetch・commit・push は supervisor が実施済み
3. **Dashboard Update 不要**: Dashboard Update セクションは全て無視する
4. **Commit & Push 不要**: Commit & Push Confirmation セクションは無視する
5. **Branch Merge 不要**: Branch Merge & Cleanup セクションは無視する
6. **Context**: Task description の「Context:」セクションに前ステップの成果物内容が含まれる
7. **Output**: Task description の「Output:」行のパスに成果物を書き込む

<!-- SYNC:INLINED source=commands/poor-dev.roadmap.md date=2026-02-21 -->

## Outline

### Step 1: Read All Artifacts

- Read `$FEATURE_DIR/concept.md` -- vision, problem, solution
- Read `$FEATURE_DIR/goals.md` -- strategic goals, success criteria
- Read `$FEATURE_DIR/milestones.md` -- milestones, dependencies, effort

### Step 2: Generate Roadmap

1. Use the following template as a base:

   ```markdown
   # Roadmap: [PROJECT/FEATURE NAME]

   **Created**: [DATE]
   **Input**: concept.md, goals.md, milestones.md

   ---

   ## Executive Summary

   <!-- 3-5 sentences summarizing the entire roadmap -->

   ## Phase Plan

   ### Phase 1: Foundation

   - **Timeline**: [Estimate]
   - **Milestones**: M1
   - **Key Deliverables**:
     -
   - **Exit Criteria**:
     -

   ### Phase 2: Core Development

   - **Timeline**: [Estimate]
   - **Milestones**: M2
   - **Key Deliverables**:
     -
   - **Exit Criteria**:
     -

   ### Phase 3: Enhancement & Polish

   - **Timeline**: [Estimate]
   - **Milestones**: M3
   - **Key Deliverables**:
     -
   - **Exit Criteria**:
     -

   ## Timeline View

   ```
   Phase 1          Phase 2          Phase 3
   [Foundation]     [Core Dev]       [Enhancement]
   ├── M1           ├── M2           ├── M3
   └── ...          └── ...          └── Launch
   ```

   ## Success Metrics Tracking

   | Metric | Baseline | Phase 1 Target | Phase 2 Target | Final Target |
   |--------|----------|---------------|---------------|-------------|
   | | | | | |

   ## Communication Plan

   | Audience | Frequency | Format | Content |
   |----------|-----------|--------|---------|
   | Stakeholders | Weekly | Report | Progress summary |
   | Team | Daily | Standup | Blockers & progress |

   ## Review Points

   | Review | After Phase | Focus | Participants |
   |--------|------------|-------|-------------|
   | Phase Gate 1 | Phase 1 | Foundation completeness | |
   | Phase Gate 2 | Phase 2 | Core feature validation | |
   | Launch Review | Phase 3 | Launch readiness | |

   ## Next Steps

   <!-- Immediate actions after roadmap approval -->

   1.
   2.
   3.
   ```

2. Synthesize all artifacts into a comprehensive roadmap:
   - **Executive Summary**: Distill concept + goals into 3-5 sentences
   - **Phase Plan**: Map milestones to phases with timelines
   - **Timeline View**: Visual ASCII timeline
   - **Success Metrics**: Track goals across phases
   - **Review Points**: Phase gates for validation
   - **Next Steps**: Concrete actions after roadmap approval

### Step 3: Write Roadmap

- Write the completed roadmap to `$FEATURE_DIR/roadmap.md`

### Step 4: Final Report

Present a summary to the user:
- Generated artifacts: concept.md, goals.md, milestones.md, roadmap.md
- Key decisions and assumptions
- Suggested next steps (e.g., move to feature development for specific milestones)

<!-- SYNC:END -->

---
description: "Roadmap Step 4 (Final): Generate comprehensive roadmap from all artifacts."
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

### Step 0: Feature ディレクトリの特定

1. 現在のブランチ名を取得: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
2. ブランチ名から数字プレフィックスを抽出
3. 対応するディレクトリを特定: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
4. `$FEATURE_DIR/milestones.md` が存在することを確認
   - 存在しない場合: Error: "milestones ステップを先に完了してください。`/poor-dev.milestones` を実行してください。"

### Step 1: Read All Artifacts

- Read `$FEATURE_DIR/concept.md` — vision, problem, solution
- Read `$FEATURE_DIR/goals.md` — strategic goals, success criteria
- Read `$FEATURE_DIR/milestones.md` — milestones, dependencies, effort

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

### Dashboard Update

Run: `node scripts/update-dashboard.mjs --command roadmap`

### Step 4: Final Report

Present a summary to the user:
- Generated artifacts: concept.md, goals.md, milestones.md, roadmap.md
- Key decisions and assumptions
- Suggested next steps (e.g., move to feature development for specific milestones)

### Branch Merge & Cleanup

Roadmap 策定完了後、以下を実行する。

1. `BRANCH=$(git rev-parse --abbrev-ref HEAD)` — 現在のブランチ取得
2. `$BRANCH` が `main` または `master` → **スキップ**
3. 未コミットの変更を確認: `git status --porcelain`
   - 変更あり → `git add -A && git commit -m "docs: ロードマップ策定完了"`
4. `git checkout main`
5. `git pull origin main --ff-only` — 失敗時はユーザーに報告して中断
6. `git merge $BRANCH --no-edit` — コンフリクト時はユーザーに報告して中断
7. `git push origin main`
8. `git branch -d $BRANCH`
9. リモートブランチ存在確認後、存在すれば `git push origin --delete $BRANCH`
10. 出力: `"✅ ブランチ '$BRANCH' を main にマージし、削除しました。"`

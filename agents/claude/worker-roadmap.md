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
<!-- SYNC:END -->

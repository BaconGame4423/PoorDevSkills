---
description: "Discovery flow: explore ideas through prototyping and learn from existing code."
handoffs:
  - label: Rebuild Check
    agent: poor-dev.rebuildcheck
    prompt: Run rebuild check on the current prototype
    send: true
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification based on discoveries
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Discovery flow entry point: "build first, break, rebuild with learnings."

### Step 0: Detect Existing Code → Mode A or Mode B

1. Check for source files and git history:
   ```bash
   ls -d src/ app/ lib/ 2>/dev/null
   find . -maxdepth 3 -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.rb" -o -name "*.php" 2>/dev/null | head -5
   git log --oneline 2>/dev/null | wc -l
   ```
2. No source files OR ≤5 commits → **Mode A** (start from zero)
   Source files AND ≥6 commits → **Mode B** (existing code)

---

### Mode A: Start from Zero

**Step A1**: Create feature branch. Generate short name from `$ARGUMENTS`.
```bash
git fetch --all --prune
```
Find highest number N across remote/local branches and specs dirs. Use N+1.
```bash
git checkout -b NNN-short-name
mkdir -p specs/NNN-short-name
```

**Step A2**: Create `$FEATURE_DIR/discovery-memo.md`:

```markdown
# Discovery Memo: [PROJECT/FEATURE NAME]

**Created**: [DATE]
**Mode**: Zero-start (Mode A)
**Branch**: `[NNN-short-name]`

## Idea
## What We Want to Learn
1.
2.
3.

## Known Unknowns
-

## Constraints
-
```

Ask user (AskUserQuestion):
- Q1: "このプロトタイプで一番検証したいことは何ですか？"
- Q2: "技術的な制約や使いたい技術はありますか？" (Options: 特になし / 言語指定あり / フレームワーク指定あり / その他)

Fill memo from answers.

**Step A3**: Append rebuild trigger to CLAUDE.md (skip if already present):

```markdown
## リビルドトリガー（探索フロー）

以下のシグナルを検知したら `/poor-dev.rebuildcheck` の実行を提案してください：

1. **変更の局所性の喪失**: 1 変更に 3 ファイル以上の修正が必要
2. **修正の振り子**: 直近 3 変更で同ファイルを 2 回以上修正
3. **コンテキストの肥大化**: 指示の前提条件・注意事項が 5 つ以上

提案時は「この辺にしよか」というトーンで、得られた知見を整理して提示してください。
```

**Step A4**: Present guidance:
```
探索フローを開始しました。
ガイドライン:
- 保守性を気にせず、動くものを最優先で作ってください
- コードではなく「何が難しいか」を発見するのが目的です
- 完璧を目指さず、学びを最大化してください

手動でリビルド判定をしたい場合: /poor-dev.rebuildcheck
```

---

### Mode B: Existing Code

**Step B1**: Create feature branch (same as Step A1).

**Step B2**: Scan codebase and create `$FEATURE_DIR/discovery-memo.md`:

Scan: file structure, language/framework detection (package.json, requirements.txt, etc.), entry points, git history scale.

```markdown
# Discovery Memo: [PROJECT/FEATURE NAME]

**Created**: [DATE]
**Mode**: Existing code (Mode B)
**Branch**: `[NNN-short-name]`

## Codebase Overview
- **Languages**: [detected]
- **Framework**: [detected]
- **File count**: [source files]
- **Git history**: [N] commits over [period]

## File Structure
```
[tree output]
```

## Detected Functionality
1.
2.
3.

## Initial Observations
-
```

**Step B3**: Append rebuild trigger to CLAUDE.md (same as Step A3).

**Step B4**: Ask user (AskUserQuestion):
- "既存コードをどうしますか？"
- Options:
  1. "機能追加を続ける" → present guidance (same as A4), continue coding
  2. "リビルド判定を実行する" → handoff to `/poor-dev.rebuildcheck`
  3. "すぐに再構築する" → handoff to `/poor-dev.harvest`

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

# Implementation Plan: レビュー修正確認フロー＋パイプライン管理

**Branch**: `004-review-fix-confirmation-pipeline` | **Date**: 2026-02-12 | **Spec**: specs/004-review-fix-confirmation-pipeline/spec.md
**Input**: Feature specification from `/specs/004-review-fix-confirmation-pipeline/spec.md`

## Summary

全5種類のレビューオーケストレーター（planreview, tasksreview, architecturereview, qualityreview, phasereview）の auto-fix ループに、修正前のユーザー確認ステップ（STEP 3.5）を挿入する。修正規模を SMALL/LARGE に自動判定し、SMALL は従来の fixer で即修正、LARGE は BugFix フロー準拠の独立パイプラインで管理する。非対話モードでも確認を強制し、パイプラインを一時停止する。

## Technical Context

**Language/Version**: Markdown（プロンプトエンジニアリング）、Shell scripts
**Primary Dependencies**: Claude Code CLI, OpenCode CLI
**Testing**: 手動実行テスト（各レビュータイプでの修正検出→確認フロー発火を確認）
**Target Platform**: Linux / macOS
**Project Type**: Developer workflow tool (single project)
**Constraints**: 既存のレビューループ構造（STEP 1-4）を維持しつつ拡張

## Constitution Check

既存の constitution.md を確認:
- Section III（Adversarial Review）: 影響なし。adversarial review は qualityreview 固有で、確認フローの後に実行
- Section VIII（Quality Gates）: 影響なし。quality gates は STEP 0 で実行済み
- Section IX（Hivemind）: 影響なし

## Decisions & Rationale

| ID | Decision | Rationale | Alternatives Rejected |
|----|----------|-----------|----------------------|
| D-001 | STEP 3 → STEP 4 間に新 STEP 3.5 挿入 | 全オーケストレーター共通構造、read-only/write-only 分離維持 | STEP 4 内での一時停止（fixer 責務変更）、STEP 2 直後（判断材料不足） |
| D-002 | 確認フローを `lib/fix-confirmation.md` として共有化 | 5オーケストレーター全てで同一ロジックのため DRY | 各オーケストレーターにインライン（重複） |
| D-003 | LARGE パスはレビューループを中断し独立パイプラインへ | ループ内で完全パイプラインを回すと再帰的で複雑 | ループ内で全ステップ実行（制御が困難） |
| D-004 | 非対話モードは `[FIX CONFIRMATION REQUIRED]` マーカー | オーケストレーター（poor-dev.md）が出力をパースして確認を中継 | 非対話モードでは確認スキップ（ユーザー要望で却下） |
| D-005 | 修正提案に一意 ID (FIX-NNN) 付与 | 個別承認/却下の特定に必要 | インデックス番号のみ（複数イテレーションで混乱） |

## Project Structure

### Documentation (this feature)

```text
specs/004-review-fix-confirmation-pipeline/
├── spec.md
├── research.md
├── plan.md              # This file
└── tasks.md             # /poor-dev.tasks output
```

### Source Code Changes (repository root)

```text
commands/
├── poor-dev.md                          # MODIFY: パイプライン確認中継ロジック追加
├── poor-dev.review.md                   # MODIFY: フロー図に STEP 3.5 追加
├── poor-dev.planreview.md               # MODIFY: STEP 3.5 挿入
├── poor-dev.tasksreview.md              # MODIFY: STEP 3.5 挿入
├── poor-dev.architecturereview.md       # MODIFY: STEP 3.5 挿入
├── poor-dev.qualityreview.md            # MODIFY: STEP 3.5 挿入
└── poor-dev.phasereview.md              # MODIFY: STEP 3.5 挿入
lib/
└── fix-confirmation.md                  # NEW: 確認フロー共有テンプレート
```

**Structure Decision**: 既存のコマンド/lib 構造をそのまま活用。新ファイルは lib/ に1つのみ。

## Architecture: 変更後のレビューループフロー

```
STEP 1: 4x Review sub-agents (parallel, READ-ONLY)
   ↓ wait for all to complete
STEP 2: Aggregate (orchestrator counts issues by C/H/M/L)
   ↓
STEP 3: Branch
   ├─ Issues = 0 → DONE + handoff
   └─ Issues > 0 → STEP 3.5
   ↓
STEP 3.5: Fix Confirmation (NEW)
   ├─ 3.5a: 修正提案を構造化（ID, target, proposed_change, scale判定）
   ├─ 3.5b: ユーザーに提示
   │   ├─ 対話モード → AskUserQuestion（全承認/全却下/個別選択）
   │   └─ 非対話モード → [FIX CONFIRMATION REQUIRED] マーカー出力
   ├─ 3.5c: スケール判定提示（SMALL/LARGE）+ ユーザー上書きオプション
   ├─ 3.5d: ユーザー判断
   │   ├─ 全承認 + SMALL → STEP 4
   │   ├─ 個別承認 + SMALL → STEP 4（承認分のみ）
   │   ├─ 全承認/個別承認 + LARGE → STEP 4L（独立パイプライン）
   │   └─ 全却下 → rejected_issues に記録 → DONE（ループ終了）
   └─ 3.5e: 却下分を rejected_issues に記録
   ↓
STEP 4: 1x Fix sub-agent (sequential, WRITE) — SMALL パスのみ
   ↓ wait for completion
   → Back to STEP 1 (new sub-agents, fresh context)

STEP 4L: LARGE Fix Pipeline (レビューループ中断)
   ├─ plan(fix-plan.md) → planreview(fix-plan.md) → implement → qualityreview
   └─ 完了後 → STEP 1 に復帰（再レビュー）
```

## STEP 3.5 詳細仕様

### 3.5a: 修正提案の構造化

集計済み issues に以下を追加:
```yaml
scale: SMALL|LARGE  # 自動判定
proposals:
  - id: FIX-001
    severity: H
    persona: RISK
    target: plan.md
    description: "auth strategy missing"
    proposed_change: "Add authentication section with JWT approach"
  - id: FIX-002
    severity: M
    persona: PM
    target: plan.md
    description: "naming inconsistency"
    proposed_change: "Rename 'auth' to 'authentication' consistently"
```

### 3.5b: ユーザー提示形式

対話モード（AskUserQuestion）:
```
レビューで N 件の問題が検出されました（規模判定: SMALL）:

FIX-001 [H] (RISK): auth strategy missing → plan.md
  提案: Add authentication section with JWT approach
FIX-002 [M] (PM): naming inconsistency → plan.md
  提案: Rename 'auth' to 'authentication' consistently

選択してください:
- 全承認（修正を実行）
- 全却下（修正をスキップ）
- 個別選択
- 規模を変更（SMALL → LARGE）
```

### 3.5c: スケール自動判定ルール

| 条件 | 判定 |
|------|------|
| 修正対象ファイル ≤3 かつ 局所的変更のみ | SMALL |
| 修正対象ファイル ≥4 | LARGE |
| Critical severity の issue が ≥2 | LARGE |
| 新ファイル作成が必要 | LARGE |
| アーキテクチャ変更を含む | LARGE |

### 3.5d: 個別選択フロー

```
FIX-001 [H] (RISK): auth strategy missing
  → 承認 / 却下

FIX-002 [M] (PM): naming inconsistency
  → 承認 / 却下
```

承認された FIX のみ fixer に渡す。却下分は `rejected_issues` に記録。

### 3.5e: rejected_issues 追跡

```yaml
rejected_issues:
  - id: FIX-002
    reason: "user rejected"
    iteration: 3
```

rejected_issues は次のイテレーションでレビューペルソナが再度指摘しても、自動的にスキップする（同一 issue の再提案防止）。

## STEP 4L: LARGE Fix Pipeline 詳細

LARGE と判定された場合、レビューループを一時中断し、独立パイプラインを実行:

1. **fix-plan.md 作成**: 承認された修正を FEATURE_DIR/fix-plan.md に記録
2. **planreview(fix-plan.md)**: fix-plan.md を対象にプランレビュー実行
3. **implement**: fix-plan.md に基づいて修正を実装
4. **qualityreview**: 修正後のコードを品質レビュー
5. **復帰**: 完了後、元のレビューループの STEP 1 に復帰

pipeline-state.json にネストされた状態を記録:
```json
{
  "flow": "feature",
  "completed": ["specify", "plan", "planreview"],
  "current": "tasks",
  "status": "active",
  "fixPipeline": {
    "parentStep": "planreview",
    "iteration": 3,
    "scale": "LARGE",
    "approvedFixes": ["FIX-001", "FIX-003"],
    "rejectedFixes": ["FIX-002"],
    "fixCompleted": ["plan", "planreview"],
    "fixCurrent": "implement"
  }
}
```

## 非対話モード対応

非対話モード（NON_INTERACTIVE_HEADER 付き）での確認フロー:

1. STEP 3.5 で `[FIX CONFIRMATION REQUIRED]` マーカーを出力に含める
2. 修正提案 YAML を全文出力
3. パイプラインオーケストレーター（poor-dev.md）が出力をパース
4. `[FIX CONFIRMATION REQUIRED]` を検出 → AskUserQuestion でユーザーに確認を中継
5. ユーザー応答を受け取り、承認/却下情報をレビューオーケストレーターに再注入
6. pipeline-state.json: `status: "paused"`, `pauseReason: "fix-confirmation"` を記録（中継待ち中）

## lib/fix-confirmation.md テンプレート

```markdown
## Fix Confirmation Procedure

Read this file and follow the steps below at STEP 3.5 of the review loop.

### Input
- Aggregated issue list from STEP 2 (YAML format)

### Steps

1. **Construct proposals**: For each issue, create a fix proposal with:
   - `id`: FIX-NNN (sequential within this review session)
   - `severity`: C/H/M/L (from aggregation)
   - `persona`: originating persona name
   - `target`: file path to be modified
   - `description`: issue description
   - `proposed_change`: brief description of the proposed fix

2. **Assess scale**: Apply rules:
   - Count unique target files → ≥4 files = LARGE
   - Count Critical severity → ≥2 = LARGE
   - Check for new file creation or architecture changes → LARGE
   - Otherwise → SMALL

3. **Present to user**:
   - IF `## Execution Mode: Non-Interactive` header present:
     - Output `[FIX CONFIRMATION REQUIRED]` on a new line
     - Output full proposals YAML
     - Output `[SCALE: SMALL]` or `[SCALE: LARGE]`
     - STOP and wait for orchestrator to relay confirmation
   - ELSE (interactive mode):
     - AskUserQuestion with options:
       a. 全承認（修正を実行）
       b. 全却下（修正をスキップ）
       c. 個別選択
       d. 規模を変更（SMALL↔LARGE）

4. **Process response**:
   - 全承認 → pass all proposals to STEP 4/4L
   - 全却下 → record all in rejected_issues → exit loop
   - 個別選択 → for each proposal, ask approve/reject → pass approved to STEP 4/4L
   - 規模変更 → flip SMALL↔LARGE

5. **Route by scale**:
   - SMALL → proceed to STEP 4 (fixer) with approved proposals only
   - LARGE → proceed to STEP 4L (independent pipeline) with approved proposals
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 8 ファイル変更 | 5 オーケストレーター + router + orchestrator + lib | 共有テンプレートで重複最小化済み |
| LARGE パスのネスト状態 | pipeline-state.json にfixPipeline を追加 | LARGE 修正を独立ブランチにする案は既存フローとの統合が困難 |

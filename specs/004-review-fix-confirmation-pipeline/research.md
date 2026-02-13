# Research: レビュー修正確認フロー＋パイプライン管理

**Branch**: `004-review-fix-confirmation-pipeline` | **Date**: 2026-02-12

## R-001: 確認フロー挿入ポイント

**Decision**: 全5オーケストレーター共通の STEP 3 → STEP 4 間に新 STEP 3.5 を導入
**Rationale**: STEP 3 で「Issues > 0」を検出した直後、STEP 4（fixer）に渡す前が最も自然な挿入ポイント。全オーケストレーター（planreview, tasksreview, architecturereview, qualityreview, phasereview）が同一構造のため、共通パターンとして追加可能。
**Alternatives rejected**:
- STEP 4 内でfixer が修正前に一時停止 → fixer エージェントの責務を変えてしまい、read-only/write-only の分離が崩れる
- STEP 2 直後に挿入 → 集計前に確認を求めても判断材料が不十分

## R-002: SMALL/LARGE 判定基準

**Decision**: BugFix フロー基準を流用（files ≤3 = SMALL, ≥4 = LARGE）に加え、severity ベースの判定を追加
**Rationale**: レビュー修正は BugFix とは異なり、severity が重要な判断軸。Critical/High のみ = 通常 SMALL、構造的変更が必要 = LARGE。
**判定ルール**:
- SMALL: 修正対象ファイル ≤3 かつ 変更が局所的（テキスト修正、セクション追加、値変更等）
- LARGE: 修正対象ファイル ≥4 またはアーキテクチャ変更・新ファイル作成が必要
- ユーザーは自動判定を上書き可能（SMALL↔LARGE）

## R-003: 修正提案の表示形式

**Decision**: 集計済み YAML にスケール判定を追加し、確認プロンプトとして表示
**Rationale**: 既存の aggregated YAML 形式を拡張することで、一貫性を維持しつつ新情報を追加。
**形式**:
```yaml
type: plan
target: plan.md
n: 3
scale: SMALL  # NEW: auto-assessed scale
i:
  H:
    - id: FIX-001
      issue: "auth strategy missing (RISK)"
      target: plan.md
      proposed: "Add authentication section with JWT approach"
  M:
    - id: FIX-002
      issue: "minor naming inconsistency (PM)"
      target: plan.md
      proposed: "Rename 'auth' to 'authentication' consistently"
ps: {PM: GO, RISK: CONDITIONAL, VAL: GO, CRIT: GO}
act: CONFIRM  # NEW: was FIX, now CONFIRM
```

## R-004: 非対話モードでの確認

**Decision**: `[FIX CONFIRMATION REQUIRED]` マーカーを出力し、パイプライン状態を `paused` に設定
**Rationale**: ユーザーの明示的要望により、非対話モードでも確認を強制。パイプラインを一時停止してユーザー応答を待つ。
**実装**:
- 非対話モード: 標準出力に `[FIX CONFIRMATION REQUIRED]` マーカー + 修正提案 YAML を出力
- オーケストレーター（poor-dev.md）が出力をパースし、AskUserQuestion で確認を中継
- 応答をオーケストレーターが記録し、パイプラインを再開

## R-005: LARGE パスのパイプライン構成

**Decision**: LARGE パスは既存のレビューループを中断し、BugFix-LARGE と同等の独立パイプラインに移行
**Rationale**: LARGE 修正はレビューループ内で処理するには重すぎる。独立パイプラインとして分離。
**LARGE パス**: `plan(fix) → planreview → tasks → tasksreview → implement → qualityreview`
**注意**: LARGE パス完了後、元のレビューループに復帰して再レビューを実施

## R-006: 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `commands/poor-dev.review.md` | フロー図に STEP 3.5 追加、確認フロー説明 |
| `commands/poor-dev.planreview.md` | STEP 3.5 挿入 |
| `commands/poor-dev.tasksreview.md` | STEP 3.5 挿入 |
| `commands/poor-dev.architecturereview.md` | STEP 3.5 挿入 |
| `commands/poor-dev.qualityreview.md` | STEP 3.5 挿入 |
| `commands/poor-dev.phasereview.md` | STEP 3.5 挿入 |
| `commands/poor-dev.md` | パイプラインオーケストレーターに確認中継ロジック追加 |
| `lib/fix-confirmation.md` | 新規: 共有テンプレート（確認フロー手順） |

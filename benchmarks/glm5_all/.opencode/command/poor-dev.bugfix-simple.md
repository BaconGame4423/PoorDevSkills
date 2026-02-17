---
description: "簡略版 bugfix。調査・分類のみ。SCALE/RECLASSIFY マーカー維持。"
---

## User Input

```text
$ARGUMENTS
```

## 指示

バグ報告を読み、調査して分類する。

**ルール**:
- 調査にはツール（Read, Grep, Glob, Bash）を使用してよい
- ファイル変更（Edit, Write）はバグ報告ドキュメントのみ許可
- 修正コードは書かない（implement ステップで行う）

## 実行手順

1. **バグ報告読み込み**: `FEATURE_DIR/bug-report.md` を読む

2. **コード調査**:
   - 関連コードパスを Grep/Glob で特定
   - エラーの根本原因を特定
   - git log で関連する最近の変更を確認

3. **5 Whys 分析**: 表層から根本原因へ掘り下げる（3-5レベル）

4. **調査結果の記録**: `FEATURE_DIR/investigation.md` を作成

5. **スケール分類**:

| 基準 | Small | Large |
|------|-------|-------|
| 変更ファイル数 | 3以下 | 4以上 |
| 変更の性質 | ローカル修正 | アーキテクチャ変更 |
| テスト | 既存テスト修正 | 新テストスイート |
| リグレッションリスク | 低〜中 | 高 |

6. **マーカー出力**（必須）:

分類結果に応じて以下のいずれかを出力する:

```
[SCALE: SMALL]
```
または
```
[SCALE: LARGE]
```
または（バグではなく機能リクエストだった場合）:
```
[RECLASSIFY: FEATURE]
```

7. **修正計画**: `FEATURE_DIR/fix-plan.md` を作成
   - 根本原因の参照
   - 修正アプローチ
   - 変更予定ファイル
   - リグレッションリスク

## 進捗マーカー

```
[PROGRESS: bugfix investigation-start]
[PROGRESS: bugfix root-cause-identified]
[PROGRESS: bugfix scale-assessed]
[PROGRESS: bugfix complete]
```

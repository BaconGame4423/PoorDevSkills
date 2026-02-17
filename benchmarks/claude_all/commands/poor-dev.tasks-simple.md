---
description: "コンテンツ生成のみ tasks。タスクリストをマークダウンで stdout に出力。"
---

## User Input

```text
$ARGUMENTS
```

## 指示

コンテキストの plan と spec を読み、実装タスクリストを生成せよ。

**ルール**:
- 出力はマークダウンテキストのみ
- ツール（Edit, Write, Bash）は使用しない
- plan.md の技術スタック、アーキテクチャ、プロジェクト構造に基づく
- spec.md の User Stories の優先順位を反映する

## タスクフォーマット（必須）

全タスクは以下の形式に厳密に従うこと:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
  - depends: [TaskID, ...]    # optional
  - files: glob, glob, ...    # optional (parallel marker がある場合は必須)
```

**フォーマット要素**:
1. **Checkbox**: 必ず `- [ ]` で開始
2. **Task ID**: 連番 (T001, T002, T003...)
3. **[P] マーカー**: 並列実行可能な場合のみ付与。`files:` メタデータ必須
4. **[Story] ラベル**: User Story フェーズのタスクのみ ([US1], [US2] 等)
5. **Description**: 具体的なアクションとファイルパス

## フェーズ構造

```markdown
# Tasks: [FEATURE NAME]

## Phase 1: Setup
- [ ] T001 プロジェクト構造の作成
- [ ] T002 依存関係のインストール

## Phase 2: Foundational
- [ ] T003 共有モデル/型定義の作成
  - files: src/models/**

## Phase 3: User Story 1 - [Title] (P1)
**Story Goal**: [spec の User Story 1 から]
**Independent Test**: [独立テスト方法]

- [ ] T004 [US1] [モデル実装の説明] in src/models/xxx
  - depends: [T003]
  - files: src/models/xxx.*
- [ ] T005 [US1] [サービス実装の説明] in src/services/xxx
  - depends: [T004]
  - files: src/services/xxx.*

## Phase 4: User Story 2 - [Title] (P2)
[同様の構造]

## Phase N: Integration & Polish
- [ ] T0XX E2E テストと最終統合
  - depends: [前フェーズの最終タスク]
```

## ガイドライン

- 各タスクは LLM が追加コンテキストなしで実行できるほど具体的であること
- Phase 境界は順次実行の壁とする
- 同一 Phase 内の `[P]` タスクは並列実行可能
- `files:` glob が重複する場合は `[P]` マーカーを付与しない
- `[PROGRESS: tasks complete]` を末尾に出力する

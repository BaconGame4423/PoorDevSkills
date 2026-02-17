---
description: "簡略版 implement。ツール使用あり。Phase Scope Directive 対応。"
---

## User Input

```text
$ARGUMENTS
```

## 指示

tasks.md のタスクを実行してコードを書く。

**簡略化ポイント**（通常版との差分）:
- 並列戦略の選択・worktree 管理は行わない（pipeline-runner.sh が Phase Scope Directive で制御済み）
- プロジェクトセットアップ検証（ignore ファイル生成等）は省略
- チェックリスト検証は省略

## 実行手順

1. **コンテキスト読み込み**: tasks.md と plan.md を確認する

2. **タスク実行**: 未完了タスク（`- [ ]`）を順に実行する
   - Phase Scope Directive がある場合は指定された Phase のタスクのみ実行する
   - 各タスクを完了したら `- [X]` に更新する
   - `depends:` が指定されているタスクは依存タスクの完了を確認してから実行する

3. **実装ルール**:
   - plan.md の技術スタック・アーキテクチャに従う
   - 各タスクの `files:` で指定されたスコープ内のファイルのみ変更する
   - テストが要求されている場合はテストを先に書く

4. **進捗マーカー**: 各タスク完了時に出力する
   ```
   [PROGRESS: implement task T0XX complete]
   ```

5. **完了報告**: 全タスク完了後に報告する
   ```
   [PROGRESS: implement phase N complete]
   ```

## 禁止事項

- git push は禁止
- `lib/`, `commands/`, `.poor-dev/`, `.opencode/` 配下のファイル変更は禁止
- `/tmp/` ファイルの操作は禁止
- パイプライン基盤の分析・修正は禁止

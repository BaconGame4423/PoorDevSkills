---
description: "GLM5 用簡略版 intake。1コマンド + spec承認だけで全パイプラインを自動実行。"
---

## User Input

```text
$ARGUMENTS
```

## Step 1: 入力分類

ユーザー入力 `$ARGUMENTS` を以下のカテゴリに分類する:

| カテゴリ | flow 値 | 次のステップ |
|---------|---------|-------------|
| 新機能・機能追加 | feature | Step 2 |
| バグ修正 | bugfix | Step 2 |
| 調査・原因分析 | investigation | Step 2 |
| ロードマップ | roadmap | Step 2 |
| プロトタイプ・探索 | discovery | Step 2 |
| 質問・Q&A | — | 直接回答して終了 |
| ドキュメント | — | 直接回答して終了 |

Q&A またはドキュメントの場合は直接回答して終了する。

## Step 2: intake + specify 実行

```bash
bash lib/intake-and-specify.sh --flow <flow> --project-dir "$(pwd)" <<'USERINPUT'
$ARGUMENTS
USERINPUT
```

**重要**: `timeout: 360000` を指定すること（dispatch-step.sh のタイムアウトより長くする）。

結果の JSON から `branch`, `feature_dir`, `spec_content` を取得する。

## Step 3: Spec 確認

取得した `spec_content` をユーザーに提示する:

```markdown
## 仕様書ドラフト

[spec_content をここに表示]

---

この仕様書で進めてよいですか？修正が必要な場合は修正指示を入力してください。
```

ユーザーの応答を待つ:

- **承認**（「OK」「はい」「進めて」等） → Step 4 へ
- **修正指示** → `spec.md` を Edit ツールで修正してから Step 4 へ

## Step 4: パイプライン再開

```bash
bash lib/resume-pipeline.sh --feature-dir <feature_dir> --project-dir "$(pwd)"
```

結果を報告して終了:

```
パイプラインを開始しました。
- ブランチ: <branch>
- 仕様ディレクトリ: <feature_dir>
- ログ: <log_path>

`pipeline-state.json` でパイプラインの進捗を確認できます。
```

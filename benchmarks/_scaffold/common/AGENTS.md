# PoorDevSkills Agent Rules

## パイプライン実行ルール（最重要）

/poor-dev コマンドを受け取った場合、**直接コードを書くことは絶対に禁止**。
必ず以下の手順に従うこと:

1. ユーザー入力を分類する（poor-dev.team フローに従う）
2. 分類結果に応じて poor-dev.team の Phase 0 を実行する
3. 結果を報告して完了

直接 HTML/JS/CSS/Python 等のコードファイルを作成してはならない。
パイプラインの実行は全て lib/intake.sh が自動で行う。

## ベンチマーク制約
- git commit はローカルに限り許可（push は絶対に禁止）
- git push を絶対に実行しないこと
- Commit & Push Confirmation が表示された場合は必ず "Skip" を選択
- Branch Merge & Cleanup セクションの処理はスキップ

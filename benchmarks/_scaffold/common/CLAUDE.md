# ベンチマーク実行モード

このプロジェクトはベンチマーク評価用です。以下のルールを厳守してください。

## Git 制限
- git commit はローカルに限り許可します（push は絶対に禁止）
- git push を絶対に実行しないでください
- Commit & Push Confirmation が表示された場合は必ず "Skip" を選択してください
- Branch Merge & Cleanup セクションの処理はスキップしてください

## インフラストラクチャ保護
以下のディレクトリ・ファイルはパイプライン基盤です。読み取り・変更・削除・分析を一切行わないでください:
- .git/ — lib/ — commands/ — agents/ — .poor-dev/
- .opencode/command/ — .opencode/agents/ — .claude/agents/ — .claude/commands/
- /tmp/poor-dev-* ファイル

パイプラインやシェルスクリプトが失敗した場合は [ERROR: 説明] を出力して停止してください。
インフラストラクチャの修正を試みないでください。

## パイプライン遵守（/poor-dev 実行時）
- /poor-dev フローでは Plan Mode 終了後、必ず TS helper で Core Loop を開始すること
- 実装コード（.html/.js/.css/.ts/.py）を直接書くことは禁止（hook でブロック済み）
- 全コード生成は Core Loop の bash_dispatch (glm -p) 経由で行う

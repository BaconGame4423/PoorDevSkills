# CLAUDE.md

## コミットとプッシュ

- コードの変更が完了したら、確認を求めずに自己判断で `git add`, `git commit`, `git push` を実行する
- コミットメッセージは既存の規約に従う: `type: 日本語タイトル`
  - type: feat / fix / refactor / chore / docs / test
- 機密ファイル（.env, credentials 等）はコミットしない

## README 自動更新

- コミットを作成する際、変更内容が README.md に影響する場合は README.md も更新してから同じコミットに含める
- README 更新が必要なケース:
  - コマンドの追加・削除・名称変更 → コマンドリファレンス表を更新
  - 開発フローのステップ変更 → 開発フロー表を更新
  - レビューペルソナの追加・削除 → レビューシステムセクションを更新
  - 新しいユーティリティやテンプレートの追加 → 該当セクションを更新
- README 更新が不要なケース:
  - 既存コマンドの内部ロジック変更のみ
  - テンプレートの内容修正（構造変更なし）
  - バグ修正で外部仕様が変わらない場合
- README.md の構造（セクション順・見出しレベル）は既存を維持する

## バージョン管理

- リリース時の手順:
  1. `npm run version:patch` / `version:minor` / `version:major` でバージョン更新
  2. CHANGELOG.md の [Unreleased] を新バージョンに移動し日付追加
  3. コミット: `chore: バージョン X.Y.Z リリース`
  4. `git tag vX.Y.Z` でタグ付け
- バージョン番号は package.json が Single Source of Truth
- .poor-dev-version はターゲットプロジェクト側のファイル。ソースリポジトリにはコミットしない
- バンプ基準:
  - patch: バグ修正、内部リファクタリング
  - minor: コマンド追加、エージェント追加、機能追加
  - major: 破壊的変更（コマンド体系変更、ディレクトリ構造変更）

## Agent Teams フロー (poor-dev.team)

- `/poor-dev.team` 実行中は TS ヘルパー (`node .poor-dev/dist/bin/poor-dev-next.js`) の JSON 指示に従う
- Phase 0 はチームメイト不使用。Opus が直接ユーザーと議論
- レビューループは Opus 仲介: reviewer → Opus → fixer → Opus（直接通信しない）
- compaction 後の回復: `pipeline-state.json` を読み、`node .poor-dev/dist/bin/poor-dev-next.js` 再実行
- チーム名: `pd-<step>-<NNN>`
- カスタムフロー: `.poor-dev/flows.json` でユーザー定義フローを追加可能

## Agent Teams アーキテクチャ

- poor-dev.team が唯一のパイプライン実行パス（レガシーパスは削除済み）
- TeamMate のモデルは `CLAUDE_CODE_TEAMMATE_COMMAND` 環境変数でプロセスレベル差し替え
  - Orchestrator (Opus) = Anthropic API
  - TeamMate (GLM-5) = Z.AI API (`scripts/setup-glm-teammate.sh` で構成)
- config.json の overrides/tiers は poor-dev.config コマンドの設定管理用に残存するが、team パスのモデル選択には使われない

## 実装の並列化ルール

- Plan 承認後の実装は、必ず複数の TeamMate で並列実行する
- 独立したファイル群・Phase 単位でタスクを分割し、TeamCreate + Task で並列にディスパッチする
- 単一エージェントでの逐次実装は禁止
- 例外: spec の成果物が単一ファイルの場合、または全タスクが同一ファイルを対象とする場合は逐次実装を許可

## ベンチマーク

- ベンチマーク基盤の詳細は [docs/benchmarks.md](docs/benchmarks.md) を参照
- `benchmarks/` ソースファイルは npm パッケージに含まれる（CLI: `poor-dev benchmark`）

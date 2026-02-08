# PoorDevSkills 開発ワークフロー

**バージョン**: 1.0.0
**作成日**: 2026-02-08

PoorDevSkillsは、SpecKitとReviewスキルを統合した構造化された開発ワークフローを提供します。このワークフローは、品質主導の開発、敵対的レビュー、段階的配信を推進します。

---

## 目次

- [概要](#概要)
- [クイックスタート](#クイックスタート)
- [ワークフロー](#ワークフロー)
- [コマンドリファレンス](#コマンドリファレンス)
- [品質ゲート](#品質ゲート)
- [レビュー戦略](#レビュー戦略)
- [リソース](#リソース)

---

## 概要

PoorDevSkillsは以下の原則に基づいて設計されています：

- **仕様主導**: ユーザー価値から始める
- **計画レビュー**: 実装前に品質を担保
- **検証ゲート**: 自動化された品質チェック
- **敵対的レビュー**: VDDスタイルの厳格なコードレビュー
- **段階的配信**: MVP優先の漸進的開発

### コアコンポーネント

1. **SpecKit**: 仕様化・計画・タスク分解の構造化されたアプローチ
2. **Reviewスキル**: 多角的レビューによる品質保証
3. **敵対的レビュー**: VDDスタイルの厳密なコードレビュー
4. **品質ゲート**: 自動化された検証チェック
5. **SwarmTools**: 並列エージェント実行のためのツールセット

---

## クイックスタート

### 新しい機能を開発する

```bash
# 1. 仕様を作成
/speckit.specify "ユーザー認証機能を追加する"

# 2. 技術計画を作成
/speckit.plan

# 3. プランをレビュー
/review plan plan.md

# 4. タスクを分解
/speckit.tasks

# 5. タスクをレビュー
/review tasks tasks.md

# 6. 実装
/speckit.implement

# 7. 品質ゲートとレビュー
/finish
/review quality

# 8. フェーズ完了レビュー
/review phase phase0
```

### 並列実行で開発する

```bash
# 1. タスクを分解
/speckit.tasks

# 2. タスクをレビュー
/review tasks tasks.md

# 3. 並列実行で実装
/swarm "phase0を実装"

# 4. 品質ゲートとレビュー
/finish
/review quality

# 5. フェーズ完了レビュー
/review phase phase0
```

---

## ワークフロー

### 標準フロー

```
1. 仕様作成
   /speckit.specify "機能の説明"

2. 技術計画
   /speckit.plan

3. プランレビュー
   /review plan plan.md

4. タスク分解
   /speckit.tasks

5. タスクレビュー
   /review tasks tasks.md

6. 設計レビュー（必要時）
   /review architecture data-model.md

7. 実装
   /speckit.implement または  /swarm "フェーズを実装"

8. 品質ゲート
   /finish

9. 品質レビュー
   /review quality

10. フェーズ完了レビュー
    /review phase [フェーズ名]
```

### MVP開発フロー

```
1. 仕様作成（P1ユーザーストーリーのみ）
   /speckit.specify "MVP機能"

2. 技術計画
   /speckit.plan

3. プランレビュー
   /review plan plan.md

4. タスク分解（P1のみ）
   /speckit.tasks

5. タスクレビュー
   /review tasks tasks.md

6. 実装（P1のみ）
   /speckit.implement

7. 品質ゲートとレビュー
   /finish
   /review quality

8. フェーズ完了レビュー
   /review phase phase0

9. デプロイ
```

---

## コマンドリファレンス

### SpecKit系コマンド

| コマンド | 用途 | 入力 | 出力 |
|----------|------|------|------|
| `/speckit.specify` | 仕様作成 | 機能説明 | spec.md |
| `/speckit.plan` | 技術計画 | なし | plan.md |
| `/speckit.tasks` | タスク分解 | なし | tasks.md |
| `/speckit.implement` | 実行実行 | なし | 実装コード |
| `/speckit.clarify` | 仕様明確化 | なし | 更新されたspec.md |
| `/speckit.analyze` | 整合性分析 | なし | 分析レポート |
| `/speckit.checklist` | チェックリスト作成 | ドメイン | ドメインチェックリスト |

### Review系コマンド

| コマンド | 用途 | ターゲット |
|----------|------|----------|
| `/review plan` | 計画レビュー | plan.md |
| `/review tasks` | タスク分解レビュー | tasks.md |
| `/review architecture` | 設計レビュー | data-model.md |
| `/review quality` | 品質レビュー | 実装コード |
| `/review phase` | フェーズ完了レビュー | フェーズ成果物 |

### 実装・品質系コマンド

| コマンド | 用途 | 関連ツール |
|----------|------|----------|
| `/swarm` | 並列エージェント実行 | SwarmTools |
| `/finish` | 品質ゲート | 型チェック + テスト |

### 詳細

各コマンドの詳細は以下のドキュメントを参照してください：

- [AGENT.md](AGENT.md) - 完全なワークフロードキュメント
- [.opencode/command/review.md](.opencode/command/review.md) - Reviewコマンドの詳細
- [.opencode/command/speckit.*.md](.opencode/command/) - SpecKitコマンドの詳細

---

## 品質ゲート

`/finish` コマンド実行時に自動チェック:

### 1. 型チェック

```bash
# TypeScript/JavaScript
tsc --noEmit

# Python
mypy . || ruff check

# Rust
cargo check
```

### 2. リンティング

```bash
# TypeScript/JavaScript
eslint . --max-warnings 0

# Python
ruff lint || flake8 . --max-line-length=88

# Rust
cargo clippy -- -D warnings
```

### 3. フォーマットチェック

```bash
# TypeScript/JavaScript
prettier --check "**/*.{ts,tsx,js,jsx,json,md}"

# Python
black --check .

# Rust
cargo fmt --check
```

### 4. テスト

```bash
# TypeScript/JavaScript
npm test -- --coverage

# Python
pytest --cov

# Rust
cargo test
```

### カバレッジ要件

- **重要パス**: 100% カバレッジ（TDD必須）
- **通常パス**: 80% 以上のカバレッジ
- **全体**: 70% 以上のカバレッジ

---

## レビュー戦略

### レビューの種別

#### 1. プランレビュー

**ペルソナ**: PM・リスク・価値・批判

**目的**: 技術計画の品質と実現可能性を評価

#### 2. タスクレビュー

**ペルソナ**: テックリード・シニア・DevOps・ジュニア

**目的**: タスク分解の正確性と実行可能性を評価

#### 3. アーキテクチャレビュー

**ペルソナ**: アーキテクト・セキュリティ・性能・運用

**目的**: 設計の品質と拡張性を評価

#### 4. 品質レビュー

**ペルソナ**: QA・テスト設計・コード・セキュリティ

**目的**: 実装品質とテスト網羅性を評価

**敵対的レビュー**: `swarm_adversarial_review` を実行

#### 5. フェーズ完了レビュー

**ペルソナ**: 品質保証・リグレッション・文書化・UX

**目的**: フェーズが完了基準を満たしているかを評価

### レビューの判定

- **GO**: 重大な問題なし、実装を進めてよい
- **CONDITIONAL**: 軽微な問題あり、修正後に進めてよい
- **NO-GO**: 重大な問題あり、修正が必要

---

## リソース

### ドキュメント

- [AGENT.md](AGENT.md) - エージェントワークフローの完全ドキュメント
- [.specify/memory/constitution.md](.specify/memory/constitution.md) - PoorDevSkills憲法
- [.opencode/command/review.md](.opencode/command/review.md) - Reviewコマンドの詳細
- [.specify/templates/](.specify/templates/) - テンプレートファイル

### ツール

- [SpecKit](.specify/) - 仕様化・計画・タスク分解のフレームワーク
- [SwarmTools](https://github.com/dollspace-gay/swarm-tools) - 並列エージェント実行
- [Hivemind](https://github.com/dollspace-gay/hivemind) - 知識管理
- [CASS](https://github.com/dollspace-gay/cass) - コードAI検索システム

---

## 貢献

このワークフローを改善するために、フィードバックや提案を歓迎します。GitHub IssuesまたはPull Requestでご連絡ください。

---

## ライセンス

MIT License

---

**バージョン**: 1.0.0
**作成日**: 2026-02-08
**最終更新**: 2026-02-08

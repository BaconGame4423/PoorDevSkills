# PoorDevSkills

> **PoorDevSkills** is a structured AI-driven development workflow for solo developers
> using affordable but less reliable models (e.g., GLM4.7).
> It compensates for model quality gaps through multi-persona reviews
> with automatic fix loops, ensuring production-grade output from budget AI.

---

## このプロジェクトについて

### 対象読者

**GLM4.7 など安価だが品質にばらつきがある AI モデル**で開発を進める**個人開発者**のためのツールセットです。

### 解決する問題

安価モデルはハルシネーション・品質低下が起きやすく、1 人では全てをレビューしきれません。

### 解決策

**構造化ワークフロー + 多角的 AI レビュー + 自動修正ループ**で品質を底上げします。

「貧乏開発者（Poor Dev）」のための開発スキルセット ── それが **PoorDevSkills** です。

---

## 開発フロー

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 1 | 仕様作成 | `/poor-dev.specify` | 自然言語の機能説明から、ユーザーストーリー・受け入れ基準・非機能要件を含む仕様書（spec.md）を生成 |
| 2 | 技術計画 | `/poor-dev.plan` | 仕様をもとに、アーキテクチャ・技術選定・フェーズ分割を含む実装計画（plan.md）を作成 |
| 3 | 計画レビュー | `/poor-dev.planreview` | 4ペルソナが計画を多角的にレビューし、指摘ゼロまで自動修正ループを実行 |
| 4 | タスク分解 | `/poor-dev.tasks` | 計画を実行可能な粒度のタスク（tasks.md）に分解。依存関係と優先度を明示 |
| 5 | タスクレビュー | `/poor-dev.tasksreview` | 4ペルソナがタスクの粒度・依存関係・実行可能性をレビュー |
| 6 | 設計レビュー | `/poor-dev.architecturereview` | 必要に応じて、設計のSOLID原則準拠・脆弱性・性能をレビュー |
| 7 | 実装 | `/poor-dev.implement` | tasks.md に従いタスクを順次実装 |
| 8 | 品質レビュー | `/poor-dev.qualityreview` | 品質ゲート（型チェック・リント・テスト）実行後、コード品質を4ペルソナ+敵対的レビューで検証 |
| 9 | 完了レビュー | `/poor-dev.phasereview` | 完了基準・リグレッション・ドキュメントを最終確認し、デプロイ可能判定 |

---

## レビューシステム

PoorDevSkills の核心は **多角的 AI レビュー**と**自動修正ループ**です。

### 自動修正ループ

各レビューは以下のループで**指摘ゼロになるまで自動修正**します。

1. **並列レビュー** — 4つのペルソナが独立してコードを評価（読み取り専用、書き込み権限なし）
2. **指摘集約** — 全ペルソナの指摘を Critical / High / Medium / Low に分類して集約
3. **判定** — 指摘が0件なら **GO**。1件以上あれば修正フェーズへ
4. **自動修正** — 書き込み権限を持つ修正エージェントが指摘に基づきコードを修正（レビュー判定の変更権限なし）
5. **再レビュー** — ステップ1に戻り、修正結果を新しいペルソナインスタンスが再評価

### 5 種類のレビューとペルソナ構成

| レビュー | コマンド | ペルソナ | 何を見るか |
|---------|---------|---------|----------|
| 計画 | `/poor-dev.planreview` | PM, リスク, 価値, 批判 | ビジネス価値、リスク、実現可能性 |
| タスク | `/poor-dev.tasksreview` | TechLead, Senior, DevOps, Junior | 依存関係、粒度、実行可能性 |
| 設計 | `/poor-dev.architecturereview` | Architect, Security, Performance, SRE | SOLID 原則、脆弱性、性能 |
| 品質 | `/poor-dev.qualityreview` | QA, TestDesign, Code, Security | テスト網羅性、コード品質 + 敵対的レビュー |
| 完了 | `/poor-dev.phasereview` | QA, Regression, Docs, UX | 完了基準、リグレッション、ドキュメント |

### ペルソナ詳細

#### 計画レビュー
- **PM**: ビジネス価値・ユーザー影響・ROI の観点から計画を評価
- **リスク**: 技術的リスク・スケジュールリスク・依存関係リスクを洗い出す
- **価値**: 優先順位の妥当性、MVP スコープの適切さを検証
- **批判**: 計画の矛盾・楽観的見積もり・見落としを厳しく指摘

#### タスクレビュー
- **TechLead**: 全体アーキテクチャとの整合性、技術的方向性を確認
- **Senior**: 実装の現実性、エッジケース、技術的負債のリスクを評価
- **DevOps**: CI/CD・デプロイ・インフラ観点でのタスク漏れを指摘
- **Junior**: 初見で理解できるか、ドキュメントや前提知識の不足を指摘

#### 設計レビュー
- **Architect**: SOLID 原則・レイヤー構成・拡張性を評価
- **Security**: 認証・認可・入力検証・脆弱性を精査
- **Performance**: ボトルネック・N+1 問題・キャッシュ戦略を検証
- **SRE**: 可観測性・障害耐性・運用負荷を評価

#### 品質レビュー
- **QA**: テスト網羅性・境界値テスト・異常系テストの充足度を確認
- **TestDesign**: テスト設計の品質、テストケースの独立性・再現性を評価
- **Code**: コード品質・可読性・命名規約・重複の排除を審査
- **Security**: 実装レベルでのセキュリティ脆弱性（インジェクション・XSS等）を検出

#### 完了レビュー
- **QA**: Definition of Done の全項目を照合し、完了基準の充足を最終判定
- **Regression**: 既存機能への影響、リグレッションテストの実行結果を確認
- **Docs**: API ドキュメント・CHANGELOG・ユーザー向けドキュメントの整備状況を確認
- **UX**: ユーザー体験の一貫性、エラーメッセージの親切さ、アクセシビリティを評価

### 安全機構

- **読み取り専用レビュア / 書き込み専用修正者の分離**: レビュアはコードを変更できず、修正者はレビュー判定を変更できない
- **10 回ループ安全弁**: 修正ループが 10 回を超えた場合、自動停止して人間に判断を委ねる
- **3 ストライクルール**: 同一指摘が 3 回修正に失敗した場合、エスカレーションする

---

## クイックスタート

```bash
# 1. 仕様を作成
/poor-dev.specify "ユーザー認証機能を追加する"

# 2. 技術計画を作成
/poor-dev.plan

# 3. 計画をレビュー（自動修正ループ付き）
/poor-dev.planreview

# 4. タスクを分解
/poor-dev.tasks

# 5. タスクをレビュー（自動修正ループ付き）
/poor-dev.tasksreview

# 6. 実装
/poor-dev.implement

# 7. 品質レビュー（品質ゲート + 自動修正ループ付き）
/poor-dev.qualityreview

# 8. フェーズ完了レビュー
/poor-dev.phasereview
```

---

## コマンドリファレンス

### 仕様・計画系

| コマンド | 用途 | 出力 |
|---------|------|------|
| `/poor-dev.specify` | 機能仕様の作成 | spec.md |
| `/poor-dev.clarify` | 仕様の曖昧箇所を質問で解消 | 更新された spec.md |
| `/poor-dev.plan` | 技術計画の作成 | plan.md |
| `/poor-dev.tasks` | タスク分解 | tasks.md |
| `/poor-dev.implement` | タスクに従い実装 | 実装コード |
| `/poor-dev.analyze` | 仕様・計画・タスクの整合性分析 | 分析レポート |
| `/poor-dev.checklist` | ドメイン別チェックリスト生成 | チェックリスト |

### レビュー系

| コマンド | 用途 | ペルソナ数 |
|---------|------|----------|
| `/poor-dev.planreview` | 計画レビュー + 自動修正 | 4 |
| `/poor-dev.tasksreview` | タスクレビュー + 自動修正 | 4 |
| `/poor-dev.architecturereview` | 設計レビュー + 自動修正 | 4 |
| `/poor-dev.qualityreview` | 品質レビュー + 自動修正 | 4 |
| `/poor-dev.phasereview` | フェーズ完了レビュー + 自動修正 | 4 |

### ユーティリティ

| コマンド | 用途 |
|---------|------|
| `/poor-dev.constitution` | プロジェクト憲法の作成・更新 |
| `/poor-dev.taskstoissues` | タスクを GitHub Issues に変換 |

---

## 詳細ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [AGENT.md](AGENT.md) | 完全なワークフロードキュメント |
| [constitution.md](.poor-dev/memory/constitution.md) | 10 原則の詳細（プロジェクト憲法） |
| [templates/](.poor-dev/templates/) | 仕様・計画・タスクのテンプレート |

---

## ライセンス

MIT License

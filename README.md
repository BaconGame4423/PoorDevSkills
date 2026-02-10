# PoorDevSkills

> AI-powered development slash command framework -- 安価モデルでもプロダクション品質を実現するスラッシュコマンド集

- **20 の AI ペルソナによる多角的自動レビュー+修正ループ**
- **Claude Code / OpenCode マルチランタイム対応**

GLM4.7 など安価だが品質にばらつきがある AI モデルで開発を進める個人開発者のためのツールセットです。
安価モデルはハルシネーション・品質低下が起きやすく、1 人では全てをレビューしきれません。
**構造化ワークフロー + 多角的 AI レビュー + 自動修正ループ**で品質を底上げします。

「貧乏開発者（Poor Dev）」のための開発スキルセット ── それが **PoorDevSkills** です。

---

## 推奨する開発の進め方

PoorDevSkills は「まず探索し、動くものを触って学び、知見だけ残してリセットし、慎重に構築する」アプローチを推奨します。

1. **探索** — `/poor-dev "〜を試したい"` で探索フローを開始。保守性を気にせず動くものを作る
2. **検証** — `/poor-dev.rebuildcheck` で客観的にプロトタイプの健全性を判定
3. **収穫** — `/poor-dev.harvest` で知見・設計原則・仕様を抽出。コードではなく学びを残す
4. **構築** — `/poor-dev.plan` 以降の構造化フローで、検証済み機能だけを慎重に実装

> いきなり仕様を書くのではなく、まず手を動かして「何が難しいか」を発見する。
> 完璧な設計より、プロトタイプからの学びが良い設計を生む。

---

## インストール

### 新規プロジェクトにインストール

```bash
npx poor-dev init
```

### 既存インストールを最新版に更新

```bash
npx poor-dev@latest update
```

### インストール状況の確認

```bash
npx poor-dev status
```

---

## クイックスタート

Claude Code または OpenCode のチャット内からスラッシュコマンドで各ステップを実行します。
**`/poor-dev`** がメインエントリポイントです。入力内容を自動分類して適切なフローにルーティングします。

```bash
# 探索フロー（推奨: まず作って学ぶ）
/poor-dev "認証の仕組みをプロトタイプしたい"     # → 探索フローへ

# 機能開発
/poor-dev "ユーザー認証機能を追加する"           # → 機能開発フローへ

# バグ修正
/poor-dev "ログイン時に500エラーが発生する"      # → バグ修正フローへ

# Q&A / ドキュメント
/poor-dev "認証の仕組みを教えて"                 # → Q&Aフローへ
/poor-dev "実装済み機能の進捗レポート"            # → ドキュメントフローへ

# 個別ステップを直接実行
/poor-dev.specify    # 仕様作成
/poor-dev.plan       # 技術計画
/poor-dev.implement  # 実装
```

---

## 開発フロー

### 探索フロー（スクラップ＆ビルド） ⭐ 推奨

`/poor-dev` が探索・プロトタイプと判定した場合、以下のフローに切り替わります。
「まず作って、壊して、知見をもとに再構築する」サイクルです。

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 0 | 受付 | `/poor-dev` | 入力を分類し探索フローにルーティング |
| 1 | 探索開始 | `/poor-dev.discovery` | 既存コード検出で自動分岐。discovery-memo.md 生成、CLAUDE.md にリビルドトリガー設定 |
| 2 | プロトタイプ | （自由コーディング） | 保守性を気にせず動くものを最優先で作る |
| 3 | リビルド判定 | `/poor-dev.rebuildcheck` | 4シグナル分析（変更局所性・修正振り子・コンテキスト肥大化・ホットスポット） |
| 4 | 知見収穫 | `/poor-dev.harvest` | learnings.md + constitution.md + spec.md を生成 |
| 5 | 標準フローへ | `/poor-dev.plan` | 以降は機能開発フロー（計画→タスク→実装→レビュー）に合流 |

> ゼロから始める場合と既存コードがある場合の両方に対応。discovery が自動判別します。

### 機能開発フロー

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 0 | 受付 | `/poor-dev` | ユーザー入力を分類し、適切なフロー（機能/バグ/ロードマップ/Q&A/ドキュメント）にルーティング |
| 1 | 仕様作成 | `/poor-dev.specify` | 自然言語の機能説明から、ユーザーストーリー・受け入れ基準・非機能要件を含む仕様書（spec.md）を生成 |
| 2 | 技術計画 | `/poor-dev.plan` | 仕様をもとに、アーキテクチャ・技術選定・フェーズ分割を含む実装計画（plan.md）を作成 |
| 3 | 計画レビュー | `/poor-dev.planreview` | 4ペルソナが計画を多角的にレビューし、指摘ゼロまで自動修正ループを実行 |
| 4 | タスク分解 | `/poor-dev.tasks` | 計画を実行可能な粒度のタスク（tasks.md）に分解。依存関係と優先度を明示 |
| 5 | タスクレビュー | `/poor-dev.tasksreview` | 4ペルソナがタスクの粒度・依存関係・実行可能性をレビュー |
| 6 | 設計レビュー | `/poor-dev.architecturereview` | 必要に応じて、設計のSOLID原則準拠・脆弱性・性能をレビュー |
| 7 | 実装 | `/poor-dev.implement` | tasks.md に従いタスクを順次実装 |
| 8 | 品質レビュー | `/poor-dev.qualityreview` | 品質ゲート（型チェック・リント・テスト）実行後、コード品質を4ペルソナ+敵対的レビューで検証 |
| 9 | 完了レビュー | `/poor-dev.phasereview` | 完了基準・リグレッション・ドキュメントを最終確認し、デプロイ可能判定 |

### バグ修正フロー

`/poor-dev` がバグ報告と判定した場合、以下の専用フローに切り替わります。

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 0 | 受付 | `/poor-dev` | 入力を分類しバグ修正フローにルーティング。過去のバグパターンを参照 |
| 1 | バグ調査 | `/poor-dev.bugfix` | 再現→調査→5 Whys分析→根本原因特定→修正計画。推測的修正を禁止 |
| 2 | 実装 | `/poor-dev.implement` | 修正計画に基づき実装（小規模の場合） |
| 3 | 品質レビュー | `/poor-dev.qualityreview` | 修正の品質検証 + ポストモーテム自動生成 + バグパターンDB更新 |

> 大規模修正の場合は `/poor-dev.plan` → `/poor-dev.planreview` → `/poor-dev.tasks` → `/poor-dev.implement` → `/poor-dev.qualityreview` の既存パイプラインに合流します。

### ロードマップフロー

`/poor-dev` がロードマップ・戦略策定と判定した場合、以下の企画フローに切り替わります。

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 0 | 受付 | `/poor-dev` | 入力を分類しロードマップフローにルーティング |
| 1 | コンセプト | `/poor-dev.concept` | ターゲットユーザー・課題・差別化を整理し concept.md を生成 |
| 2 | ゴール定義 | `/poor-dev.goals` | 戦略ゴールと成功基準を定義し goals.md を生成 |
| 3 | マイルストーン | `/poor-dev.milestones` | ゴールをマイルストーンに分解し milestones.md を生成 |
| 4 | ロードマップ | `/poor-dev.roadmap` | 全成果物を統合しフェーズ計画を含む roadmap.md を生成 |

> ロードマップ完了後、各マイルストーンを `/poor-dev` で機能開発フローに移行できます。

### ドキュメント/Q&Aフロー

`/poor-dev` が質問・ドキュメント作成と判定した場合、以下のコマンドに直接ルーティングされます。
個別に直接実行することも可能です。

| コマンド | 用途 |
|---------|------|
| `/poor-dev.ask` | コードベースや仕様に関する質問応答 |
| `/poor-dev.report` | プロジェクトレポート・ドキュメント生成 |

---

## コマンドリファレンス（スラッシュコマンド）

### 探索・発見系

| コマンド | 用途 | 出力 |
|---------|------|------|
| `/poor-dev` | 入力の受付（全フロー自動分類） | ルーティング判定 |
| `/poor-dev.discovery` | 探索フロー開始（プロトタイプ / 既存コード整理） | discovery-memo.md |
| `/poor-dev.rebuildcheck` | リビルド判定（4シグナル分析） | 分析レポート + CONTINUE/REBUILD 判定 |
| `/poor-dev.harvest` | 知見収穫 + 再構築準備 | learnings.md, constitution.md, spec.md |

### 仕様・計画・実装系

| コマンド | 用途 | 出力 |
|---------|------|------|
| `/poor-dev.specify` | 機能仕様の作成 | spec.md |
| `/poor-dev.clarify` | 仕様の曖昧箇所を質問で解消 | 更新された spec.md |
| `/poor-dev.bugfix` | バグ調査・根本原因特定・修正計画 | bug-report.md, investigation.md, fix-plan.md |
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

### ロードマップ系

| コマンド | 用途 | 出力 |
|---------|------|------|
| `/poor-dev.concept` | コンセプト壁打ち・ビジョン定義 | concept.md |
| `/poor-dev.goals` | ゴール定義・成功基準策定 | goals.md |
| `/poor-dev.milestones` | マイルストーン分解・依存関係整理 | milestones.md |
| `/poor-dev.roadmap` | 全成果物を統合しロードマップ生成 | roadmap.md |

### ユーティリティ

| コマンド | 用途 |
|---------|------|
| `/poor-dev.ask` | コードベースや仕様に関する質問応答 |
| `/poor-dev.report` | プロジェクトレポート・ドキュメント生成 |
| `/poor-dev.switch` | フローを直接選択して開始（intake スキップ） |
| `/poor-dev.review` | レビューコマンドのルーター（レビュー種別を選択） |
| `/poor-dev.constitution` | プロジェクト憲法の作成・更新 |
| `/poor-dev.taskstoissues` | タスクを GitHub Issues に変換 |
| `/poor-dev.config` | ハイブリッドモデル設定（CLI/モデルのカテゴリ別設定） |

---

## デュアルランタイム戦略

PoorDevSkills は **Claude Code** と **OpenCode** の両方から利用でき、レビューごとに CLI とモデルを使い分けられます。

### 推奨ワークフロー

| フェーズ | CLI | モデル | 理由 |
|---------|-----|--------|------|
| planreview (4 ペルソナ) | OpenCode | GLM4.7 | 安価。一次レビューとして十分 |
| tasksreview (4 ペルソナ) | OpenCode | GLM4.7 | 同上 |
| architecturereview (4 ペルソナ) | OpenCode | GLM4.7 | 同上 |
| qualityreview (4 ペルソナ) | OpenCode | GLM4.7 | 同上 |
| **phasereview** (4 ペルソナ) | **Claude** | **haiku** | 最終ゲートキーパー。品質保証 |
| **fixer** (修正エージェント) | **Claude** | **sonnet** | コード修正。正確さが必要 |

### 設定方法

```bash
/poor-dev.config show                          # 現在の設定 + 利用可能モデル一覧
/poor-dev.config default opencode zai-coding-plan/glm-4.7  # デフォルト設定
/poor-dev.config set phasereview claude haiku   # カテゴリ上書き
/poor-dev.config set fixer claude sonnet        # 個別エージェント上書き
/poor-dev.config unset qualityreview            # 上書きを削除（デフォルトに戻る）
/poor-dev.config reset                          # 推奨デフォルトにリセット
```

設定はプロジェクトルートの `.poor-dev/config.json` に保存され、`npx poor-dev update` で上書きされません。

### 利用可能モデルの確認

```bash
# OpenCode のモデル一覧
opencode models

# Claude Code のモデル（固定）
# haiku, sonnet, opus
```

---

## リビングダッシュボード

各コマンド完了時に `docs/` 配下のファイルが自動更新され、プロジェクト全体の進捗を常時把握できます。

| ファイル | 用途 | 対象読者 |
|---------|------|---------|
| `docs/roadmap.md` | プロジェクト全体のロードマップ俯瞰 | 人間 |
| `docs/progress.md` | 全フィーチャーの進捗状況一覧 | 人間 + AI |

### 使い方

別ウィンドウで常時表示して、開発の進捗をリアルタイムに確認できます。

```bash
# 進捗ダッシュボードを監視
watch cat docs/progress.md

# ロードマップを監視
watch cat docs/roadmap.md
```

---

## レビューシステム

PoorDevSkills の核心は **多角的 AI レビュー**と**自動修正ループ**です。

### 自動修正ループ

各レビューは以下のループで**指摘ゼロになるまで自動修正**します。

1. **並列レビュー** -- 4つのペルソナが独立してコードを評価（読み取り専用、書き込み権限なし）
2. **指摘集約** -- 全ペルソナの指摘を Critical / High / Medium / Low に分類して集約
3. **判定** -- 指摘が0件なら **GO**。1件以上あれば修正フェーズへ
4. **自動修正** -- 書き込み権限を持つ修正エージェントが指摘に基づきコードを修正（レビュー判定の変更権限なし）
5. **再レビュー** -- ステップ1に戻り、修正結果を新しいペルソナインスタンスが再評価

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

## 詳細ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [AGENT.md](AGENT.md) | 完全なワークフロードキュメント |
| [constitution.md](constitution.md) | 10 原則の詳細（プロジェクト憲法） |

---

## ライセンス

MIT License

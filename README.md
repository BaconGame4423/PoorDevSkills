# PoorDevSkills

> AI-powered development slash command framework -- 安価モデルでもプロダクション品質を実現するスラッシュコマンド集

- **21 の AI ペルソナによる多角的自動レビュー+修正ループ**
- **Claude Code 対応**

GLM-5 など安価だが品質にばらつきがある AI モデルで開発を進める個人開発者のためのツールセットです。
安価モデルはハルシネーション・品質低下が起きやすく、1 人では全てをレビューしきれません。
**構造化ワークフロー + 多角的 AI レビュー + 自動修正ループ**で品質を底上げします。

「貧乏開発者（Poor Dev）」のための開発スキルセット ── それが **PoorDevSkills** です。

---

## 目次

- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [開発の進め方](#開発の進め方)
- [コマンドリファレンス](#コマンドリファレンス)
- [仕組み](#仕組み)
- [詳細ドキュメント](#詳細ドキュメント)
- [ライセンス](#ライセンス)

---

## インストール

### 新規プロジェクトにインストール

```bash
npx github:BaconGame4423/PoorDevSkills init
```

### 既存インストールを最新版に更新

```bash
npx github:BaconGame4423/PoorDevSkills update
```

### インストール状況の確認

```bash
npx github:BaconGame4423/PoorDevSkills status
```

---

## クイックスタート

Claude Code のチャット内からスラッシュコマンドで各ステップを実行します。
**`/poor-dev`** がメインエントリポイントです。入力内容を自動分類して適切なフローにルーティングします。

```bash
# 探索フロー（推奨: まず作って学ぶ）
/poor-dev "認証の仕組みをプロトタイプしたい"     # → 探索(exploration)フローへ

# 機能開発
/poor-dev "ユーザー認証機能を追加する"           # → 機能開発フローへ

# バグ修正
/poor-dev "ログイン時に500エラーが発生する"      # → バグ修正フローへ

# 調査（原因不明の問題）
/poor-dev "なぜAPIレスポンスが遅いのか調査したい"  # → 調査フローへ

# Q&A / ドキュメント
/poor-dev "認証の仕組みを教えて"                 # → Q&Aフローへ
/poor-dev "実装済み機能の進捗レポート"            # → ドキュメントフローへ

# 個別ステップを直接実行
/poor-dev.specify    # 仕様作成
/poor-dev.plan       # 技術計画
/poor-dev.implement  # 実装
```

---

## 開発の進め方

すべての開発は `/poor-dev` から始まります。自然言語で入力すると、内容を自動分類して最適なフローにルーティングします。

### 推奨フロー

1. **探索から始める** — いきなり仕様を書かず、まずプロトタイプで「何が難しいか」を発見する
2. **知見を収穫する** — プロトタイプから学びだけを抽出し、コードはリセットする
3. **構造化フローで構築する** — 検証済みの知見をもとに、仕様→計画→レビュー→実装で慎重に構築する

### 探索（スクラップ＆ビルド）

`discovery` → ユーザー選択:
- **ロードマップを作成** → `concept` → `goals` → `milestones` → `roadmap`
- **プロトタイプを評価** → `rebuildcheck`（4 シグナル分析で CONTINUE/REBUILD 判定）→ `harvest`（知見抽出）→ `plan` 以降の構造化フローに合流
- **探索を終了** → 完了

### ロードマップ

`concept`（コンセプト整理）→ `goals`（ゴール定義）→ `milestones`（マイルストーン分解）→ `roadmap`（統合ロードマップ生成）

### 機能開発（10 ステージパイプライン）

`specify` → `plan` → `planreview` → `tasks` → `tasksreview` → `implement` → `testdesign` → `architecturereview` → `qualityreview` → `phasereview`

各レビューステップでは 4 ペルソナによる並列レビュー + 自動修正ループが動き、指摘ゼロになるまで繰り返します。

### バグ修正

`bugfix`（再現→5 Whys→根本原因特定→修正計画）→ 小規模なら `implement`、大規模なら `plan` 以降のパイプラインに合流

### 調査

`investigate`（読み取り専用で現象・仮説を体系分析）→ 結果に応じて `bugfix` / `specify` / ドキュメント化

---

## コマンドリファレンス

### エントリポイント

| コマンド | 用途 |
|---------|------|
| `/poor-dev` | Bash Dispatch オーケストレーター（全フロー対応。メインエントリポイント） |
| `/poor-dev.switch` | フローを直接選択して開始（intake スキップ） |

### 仕様・計画・実装

| コマンド | 用途 | 出力 |
|---------|------|------|
| `/poor-dev.specify` | 機能仕様の作成 | spec.md |
| `/poor-dev.clarify` | 仕様の曖昧箇所を質問で解消 | 更新された spec.md |
| `/poor-dev.bugfix` | バグ調査・根本原因特定・修正計画 | bug-report.md, investigation.md, fix-plan.md |
| `/poor-dev.investigate` | 原因不明の問題調査・分析 | 調査レポート + 次アクション推奨 |
| `/poor-dev.plan` | 技術計画の作成 | plan.md |
| `/poor-dev.tasks` | タスク分解 | tasks.md |
| `/poor-dev.testdesign` | テスト計画・テストスケルトン設計 | test-plan.md |
| `/poor-dev.implement` | タスクに従い実装 | 実装コード |
| `/poor-dev.analyze` | 仕様・計画・タスクの整合性分析 | 分析レポート |
| `/poor-dev.checklist` | ドメイン別チェックリスト生成 | チェックリスト |

### レビュー

| コマンド | 用途 | ペルソナ数 |
|---------|------|----------|
| `/poor-dev.planreview` | 計画レビュー + 自動修正 | 4 |
| `/poor-dev.tasksreview` | タスクレビュー + 自動修正 | 4 |
| `/poor-dev.architecturereview` | 設計レビュー + 自動修正 | 4 |
| `/poor-dev.qualityreview` | 品質レビュー + 自動修正 | 4 |
| `/poor-dev.phasereview` | フェーズ完了レビュー + 自動修正 | 4 |

### 探索・発見

| コマンド | 用途 | 出力 |
|---------|------|------|
| `/poor-dev.discovery` | 探索フロー開始（プロトタイプ / 既存コード整理） | discovery-memo.md |
| `/poor-dev.rebuildcheck` | リビルド判定（4シグナル分析） | 分析レポート + CONTINUE/REBUILD 判定 |
| `/poor-dev.harvest` | 知見収穫 + 再構築準備 | learnings.md, constitution.md, spec.md |

### ロードマップ

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
| `/poor-dev.constitution` | プロジェクト憲法の作成・更新 |
| `/poor-dev.taskstoissues` | タスクを GitHub Issues に変換 |

### ベンチマーク

| コマンド | 用途 |
|---------|------|
| `poor-dev benchmark run <combo>` | ベンチマーク一括実行（セットアップ→パイプライン→分析→メトリクス収集） |
| `poor-dev benchmark setup` | ベンチマークディレクトリのセットアップ |
| `poor-dev benchmark compare` | COMPARISON.md の生成 |
| `/bench [タスク名\|combo]` | ベンチマーク実行 + Phase 0 自動応答 + PoorDevSkills 分析 + 飽和検出 |
| `/bench --results [タスク名]` | ベンチマーク結果表示 + 知見飽和検出 |

#### マルチタスクベンチマーク

benchmarks.json で複数タスクを定義可能。タスク名またはcombo名で指定:
- `/bench` — デフォルトタスク（task-manager-api）を実行
- `/bench 関数ビジュアライザー` — タスク名で指定
- `/bench claude_bash_glm5` — combo 名で直接指定

---

## 仕組み

### レビュー循環

すべてのレビューコマンドで以下のサイクルが動きます。

1. **並列レビュー** — 4 ペルソナが独立してコードを評価（読み取り専用）
2. **指摘集約** — Critical / High / Medium / Low に分類、review-log.yaml で重複排除
3. **収束判定** — C/H 新規 0 件が 2 回連続 or 全ペルソナ GO or C+H=0 で **GO**
4. **自動修正** — 修正エージェントが指摘に基づきコードを修正
5. **再レビュー** — ステップ 1 に戻り再評価。指摘ゼロまで繰り返し

| レビュー | コマンド | 何を見るか |
|---------|---------|----------|
| 計画 | `planreview` | ビジネス価値、リスク、実現可能性 |
| タスク | `tasksreview` | 依存関係、粒度、実行可能性 |
| 設計 | `architecturereview` | SOLID 原則、脆弱性、性能 |
| 品質 | `qualityreview` | テスト網羅性、コード品質 + 敵対的レビュー |
| 完了 | `phasereview` | 完了基準、リグレッション、ドキュメント |

権限分離（レビュアは読み取り専用 / 修正者は書き込み専用）、スコープ境界、サイズガード、自動停止で安全性を担保。リスクベース深度・早期終了・ハイブリッドコンテキスト注入で効率化。

### Bash Dispatch

`/poor-dev` は Bash Dispatch でパイプラインを駆動します。`glm -p` を直接呼び出し、各ステップを headless モードで実行します。

| 役割 | モデル | API |
|------|--------|-----|
| Orchestrator（リーダー） | opusplan (Plan=Opus, Execute=Sonnet) | Anthropic API |
| Worker（ワーカー・レビュアー） | GLM-5 等 | Z.AI API（`CLAUDE_CODE_TEAMMATE_COMMAND` で差し替え） |

Orchestrator が全体の進行を制御し、各ステップを `glm -p` で Worker に dispatch します。Worker のモデルはプロセスレベルで差し替え可能なため、**高品質な判断（Opus）+ 低コストな実行（GLM-5）** のハイブリッド構成が実現できます。

セットアップ手順は [docs/glm-teammate.md](docs/glm-teammate.md) を参照してください。

---

## 詳細ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [AGENT.md](AGENT.md) | 完全なワークフロードキュメント |
| [constitution.md](constitution.md) | 10 原則の詳細（プロジェクト憲法） |
| [docs/benchmarks.md](docs/benchmarks.md) | ベンチマーク基盤の詳細 |
| [docs/glm-teammate.md](docs/glm-teammate.md) | GLM-5 Teammate セットアップ |

---

## ライセンス

MIT License

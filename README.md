# PoorDevSkills

> AI-powered development CLI — 安価モデルでもプロダクション品質を実現する開発ツール

- **ワンコマンドで仕様→実装→レビューの全パイプライン実行**
- **20 の AI ペルソナによる多角的自動レビュー＋修正ループ**
- **Claude Code / OpenCode マルチランタイム対応**
- **tmux ベースの並列ステップ実行**

GLM4.7 など安価だが品質にばらつきがある AI モデルで開発を進める個人開発者のためのツールセットです。
安価モデルはハルシネーション・品質低下が起きやすく、1 人では全てをレビューしきれません。
**構造化ワークフロー + 多角的 AI レビュー + 自動修正ループ**で品質を底上げします。

「貧乏開発者（Poor Dev）」のための開発スキルセット ── それが **PoorDevSkills** です。

---

## インストール

### グローバルインストール（推奨）

```bash
git clone https://github.com/<your-account>/DevSkills.git
cd DevSkills
npm link
```

これで `poor-dev` コマンドがグローバルに使えるようになります。

### プロジェクトのセットアップ

作業したいディレクトリで:

```bash
cd your-project
poor-dev init
```

テンプレート・スクリプト・コマンド定義が `.poor-dev/` にコピーされ、自己完結型のプロジェクトがセットアップされます。

### 前提条件

| ツール | 必須/任意 | 備考 |
|--------|----------|------|
| [tmux](https://github.com/tmux/tmux) | 必須 | パイプラインの並列実行に使用 |
| [yq](https://github.com/mikefarah/yq#install) | 必須 | YAML 設定ファイルの読み取りに使用 |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude`) | いずれか必須 | デフォルトランタイム |
| [OpenCode](https://github.com/opencode-ai/opencode) (`opencode`) | いずれか必須 | 代替ランタイム |
| [gum](https://github.com/charmbracelet/gum) | 必須 | TUI レンダリング（`go install github.com/charmbracelet/gum@latest`） |

---

## クイックスタート

PoorDevSkills には **3 つの実行モード**があります。

### CLI モード（`poor-dev`）

tmux セッション内で全パイプラインを独立プロセスとして自動実行します。

```bash
# 基本実行 — 機能説明を渡すだけ
poor-dev "ユーザー認証機能を追加する"

# インタラクティブモード（即 tmux 起動 → tmux 内でプロンプト入力）
poor-dev

# 途中から再開
poor-dev --from plan --feature-dir specs/001-user-auth

# 確認プロンプトなしで自動進行
poor-dev --no-confirm "ユーザー認証機能を追加する"
```

### スラッシュコマンドモード

Claude Code / OpenCode のチャット内からスラッシュコマンドで個別ステップを実行します。

```bash
# 受付（自動で機能/バグを分類）
/poor-dev.intake "ユーザー認証機能を追加する"     # → 機能開発フローへ
/poor-dev.intake "ログイン時に500エラーが発生する"  # → バグ修正フローへ

# パイプラインモード: intake から自動遷移で全ステップ実行
# コンテキスト喪失時は /poor-dev.pipeline resume で復帰
```

---

## CLI リファレンス（`poor-dev`）

### Usage

```
poor-dev [command] [options] ["description"]
```

### Commands

| コマンド | 説明 |
|---------|------|
| `init [--force]` | 現在のディレクトリに poor-dev をセットアップ |
| `ask "質問"` | コードベースに関する質問応答（パイプライン不要） |
| `report [種別]` | プロジェクトレポート生成（パイプライン不要） |
| `config [args]` | パイプライン設定の表示・変更 |
| `switch` | フローを直接選択して開始（intake スキップ）※TUI 内では Tab で切替可能 |
| *(なし)* | インタラクティブモード（tmux 内でプロンプト入力 → Tab/Shift+Tab で6モード切替） |

### Options

| オプション | 説明 |
|-----------|------|
| `--runtime <claude\|opencode>` | デフォルトランタイムを上書き |
| `--model <model>` | デフォルトモデルを上書き |
| `--config <path>` | 設定ファイルパス（デフォルト: `.poor-dev/pipeline-config.yaml`） |
| `--from <step-id>` | 途中のステップからパイプラインを再開 |
| `--feature-dir <path>` | フィーチャーディレクトリ（`--from` と併用） |
| `--no-confirm` | 確認プロンプトなしで自動進行 |
| `--help, -h` | ヘルプを表示 |
| `--version` | バージョンを表示 |

**ステップ ID**: `intake`, `specify`, `clarify`, `plan`, `planreview`, `tasks`, `tasksreview`, `architecturereview`, `implement`, `qualityreview`, `phasereview`, `concept`, `goals`, `milestones`, `roadmap`

### 実行例

```bash
# プロジェクト初期化
poor-dev init

# インタラクティブモード
poor-dev

# 基本実行
poor-dev "Add user authentication"

# OpenCode + GLM-4.7 で実行
poor-dev --runtime opencode --model glm-4.7 "Add OAuth2 support"

# plan ステップから再開
poor-dev --from plan --feature-dir specs/003-auth

# 確認なし自動進行
poor-dev --no-confirm "Quick feature"

# 質問応答（パイプライン不要）
poor-dev ask "このプロジェクトのアーキテクチャは？"

# レポート生成
poor-dev report

# フロー直接選択
poor-dev switch

# 設定の表示・変更
poor-dev config
poor-dev config set intake.model haiku
poor-dev config set planreview.pm.model haiku
```

> **後方互換:** `./poor-dev-cli` も引き続き使用可能です（内部で `bin/poor-dev` に委譲）。

### 操作キー（tmux セッション内）

#### 入力ポップアップ

| キー | 動作 |
|------|------|
| `Tab` | 次のモードへ切替（intake → feature → bugfix → roadmap → ask → report） |
| `Shift+Tab` | 前のモードへ切替 |
| `Ctrl+S` | モデル設定画面を開く（インクリメンタルフィルタ＋カスタムモデル入力対応） |
| `Enter` | 送信（report は入力なしで実行） |
| `Esc` | キャンセル |
| `Ctrl+U` | 入力をクリア |

#### パイプライン実行中（ステップ開始後）

| キー | 動作 |
|------|------|
| `q` | パイプライン中止（y/n 確認） |
| `l` | ログ末尾3行の表示/非表示トグル |
| `Ctrl+C` | 強制停止 |

#### ステップ間（確認プロンプト時）

| キー | 動作 |
|------|------|
| `Enter` | 次のステップへ進む |
| `p` | パイプライン一時停止（ステップ完了後） |
| `s` | 次ステップをスキップ |
| `q` | パイプライン終了（状態保存、`--from` で再開可能） |
| `m` | 次ステップに追加指示を付与 |
| `←→` | tmux タブ切替（完了ステップのログ参照） |

---

## コマンドリファレンス（スラッシュコマンド）

### 仕様・計画系

| コマンド | 用途 | 出力 |
|---------|------|------|
| `/poor-dev.intake` | 入力の受付（機能/バグ分類） | ルーティング判定 |
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
| `/poor-dev.config` | パイプライン設定の対話的変更 |
| `/poor-dev.constitution` | プロジェクト憲法の作成・更新 |
| `/poor-dev.taskstoissues` | タスクを GitHub Issues に変換 |
| `/poor-dev.pipeline` | パイプライン状態確認・コンテキスト喪失後の復帰 |

---

## 開発フロー

### 機能開発フロー

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 0 | 受付 | `/poor-dev.intake` | ユーザー入力を分類し、機能開発フローまたはバグ修正フローにルーティング |
| 1 | 仕様作成 | `/poor-dev.specify` | 自然言語の機能説明から、ユーザーストーリー・受け入れ基準・非機能要件を含む仕様書（spec.md）を生成 |
| 2 | 技術計画 | `/poor-dev.plan` | 仕様をもとに、アーキテクチャ・技術選定・フェーズ分割を含む実装計画（plan.md）を作成 |
| 3 | 計画レビュー | `/poor-dev.planreview` | 4ペルソナが計画を多角的にレビューし、指摘ゼロまで自動修正ループを実行 |
| 4 | タスク分解 | `/poor-dev.tasks` | 計画を実行可能な粒度のタスク（tasks.md）に分解。依存関係と優先度を明示 |
| 5 | タスクレビュー | `/poor-dev.tasksreview` | 4ペルソナがタスクの粒度・依存関係・実行可能性をレビュー |
| 6 | 設計レビュー | `/poor-dev.architecturereview` | 必要に応じて、設計のSOLID原則準拠・脆弱性・性能をレビュー |
| 7 | 実装 | `/poor-dev.implement` | tasks.md に従いタスクを順次実装 |
| 8 | 品質レビュー | `/poor-dev.qualityreview` | 品質ゲート（型チェック・リント・テスト）実行後、コード品質を4ペルソナ+敵対的レビューで検証 |
| 9 | 完了レビュー | `/poor-dev.phasereview` | 完了基準・リグレッション・ドキュメントを最終確認し、デプロイ可能判定 |

> **パイプラインモード**: `/poor-dev.intake` から開始すると、各ステップ完了時に次のステップへ自動遷移します。コンテキスト喪失時は `/poor-dev.pipeline resume` で途中から復帰できます。

> **CLI オーケストレーター**: `poor-dev "説明"` で tmux セッション内の独立プロセスとして全ステップを実行できます。各ステップごとにランタイム（claude/opencode）やモデルを設定可能です。

### バグ修正フロー

`/poor-dev.intake` がバグ報告と判定した場合、以下の専用フローに切り替わります。

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 0 | 受付 | `/poor-dev.intake` | 入力を分類しバグ修正フローにルーティング。過去のバグパターンを参照 |
| 1 | バグ調査 | `/poor-dev.bugfix` | 再現→調査→5 Whys分析→根本原因特定→修正計画。推測的修正を禁止 |
| 2 | 実装 | `/poor-dev.implement` | 修正計画に基づき実装（小規模の場合） |
| 3 | 品質レビュー | `/poor-dev.qualityreview` | 修正の品質検証 + ポストモーテム自動生成 + バグパターンDB更新 |

> 大規模修正の場合は `/poor-dev.plan` → `/poor-dev.planreview` → `/poor-dev.tasks` → `/poor-dev.implement` → `/poor-dev.qualityreview` の既存パイプラインに合流します。

### ロードマップフロー

`/poor-dev.intake` がロードマップ・戦略策定と判定した場合、以下の企画フローに切り替わります。

| # | ステップ | コマンド | 内容 |
|---|---------|---------|------|
| 0 | 受付 | `/poor-dev.intake` | 入力を分類しロードマップフローにルーティング |
| 1 | コンセプト | `/poor-dev.concept` | ターゲットユーザー・課題・差別化を整理し concept.md を生成 |
| 2 | ゴール定義 | `/poor-dev.goals` | 戦略ゴールと成功基準を定義し goals.md を生成 |
| 3 | マイルストーン | `/poor-dev.milestones` | ゴールをマイルストーンに分解し milestones.md を生成 |
| 4 | ロードマップ | `/poor-dev.roadmap` | 全成果物を統合しフェーズ計画を含む roadmap.md を生成 |

> ロードマップ完了後、各マイルストーンを `/poor-dev.intake` で機能開発フローに移行できます。

### ドキュメント/Q&Aフロー

パイプライン管理なしの軽量コマンドです。tmux セッションを起動せず、ターミナル内で直接実行します。

| コマンド | CLI | 用途 |
|---------|-----|------|
| `/poor-dev.ask` | `poor-dev ask "質問"` | コードベースや仕様に関する質問応答 |
| `/poor-dev.report` | `poor-dev report` | プロジェクトレポート・ドキュメント生成 |

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

## 設定

パイプラインの動作は `.poor-dev/pipeline-config.yaml` でカスタマイズできます。

### デフォルト設定

```yaml
defaults:
  runtime: claude          # claude | opencode
  model: sonnet
  max_budget_usd: 5.0     # claude -p --max-budget-usd
  confirm: true            # ステップ間で確認プロンプトを表示

steps:
  intake:
    model: haiku           # 受付は軽量モデルで十分
  implement:
    model: opus            # 実装は高精度モデルを使用
```

### ステップごとのカスタマイズ例

`steps` 配下にステップ ID をキーとして、個別にランタイム・モデル・バジェットを上書きできます。

```yaml
steps:
  intake:
    model: haiku
  specify:
    model: sonnet
  plan:
    runtime: opencode       # このステップだけ OpenCode で実行
    model: glm-4.7
  implement:
    model: opus
    max_budget_usd: 10.0    # 実装ステップはバジェットを多めに
  qualityreview:
    model: sonnet
```

未指定のステップは `defaults` の値を継承します。

### サブエージェント別モデル設定

レビューステップのサブエージェント（ペルソナ）ごとにモデルを指定できます。

```yaml
steps:
  planreview:
    model: sonnet            # ステップレベルのデフォルト
    agents:
      pm:
        model: haiku         # PM ペルソナだけ軽量モデル
      critical:
        model: opus          # 批判ペルソナは高精度モデル
```

**モデル解決の優先順位**: エージェント設定 → ステップ設定 → デフォルト設定 → sonnet（フォールバック）

サブエージェントを持つステップ:

| ステップ | サブエージェント |
|---|---|
| `planreview` | pm, critical, risk, value |
| `tasksreview` | techlead, senior, devops, junior |
| `architecturereview` | architect, performance, security, sre |
| `qualityreview` | qa, testdesign, code, security |
| `phasereview` | qa, regression, docs, ux |

### CLI からの設定変更

```bash
# 現在の設定を表示
poor-dev config

# デフォルト値を変更
poor-dev config set defaults.runtime opencode
poor-dev config set defaults.model opus

# ステップ別設定
poor-dev config set intake.model haiku
poor-dev config set implement.runtime claude

# サブエージェント別設定
poor-dev config set planreview.pm.model haiku
poor-dev config set planreview.critical.model opus

# 設定をリセット
poor-dev config reset
```

スラッシュコマンドモードでは `/poor-dev.config` で対話的に設定変更ができます。

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

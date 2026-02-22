# PoorDevSkills

> AI-powered development slash command framework -- 安価モデルでもプロダクション品質を実現するスラッシュコマンド集

- **21 の AI ペルソナによる多角的自動レビュー+修正ループ**
- **Claude Code / OpenCode マルチランタイム対応**

GLM4.7 など安価だが品質にばらつきがある AI モデルで開発を進める個人開発者のためのツールセットです。
安価モデルはハルシネーション・品質低下が起きやすく、1 人では全てをレビューしきれません。
**構造化ワークフロー + 多角的 AI レビュー + 自動修正ループ**で品質を底上げします。

「貧乏開発者（Poor Dev）」のための開発スキルセット ── それが **PoorDevSkills** です。

---

## 目次

- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [開発の進め方](#開発の進め方)
  - [全体像](#全体像)
  - [アイデアを探索する（スクラップ＆ビルド）](#アイデアを探索するスクラップビルド)
  - [ロードマップを策定する](#ロードマップを策定する)
  - [機能を開発する](#機能を開発する)
  - [バグを修正する](#バグを修正する)
- [レビューと自動修正の仕組み](#レビューと自動修正の仕組み)
- [コマンドリファレンス](#コマンドリファレンス)
- [レビューペルソナ詳細](#レビューペルソナ詳細)
- [デュアルランタイム戦略](#デュアルランタイム戦略)
- [リビングダッシュボード](#リビングダッシュボード)
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

Claude Code または OpenCode のチャット内からスラッシュコマンドで各ステップを実行します。
**`/poor-dev.team`** がメインエントリポイントです。入力内容を自動分類して適切なフローにルーティングします。

```bash
# 探索フロー（推奨: まず作って学ぶ）
/poor-dev "認証の仕組みをプロトタイプしたい"     # → 探索フローへ

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

### 全体像

すべての開発は `/poor-dev.team` から始まります。自然言語で入力すると、内容を自動分類して最適なフローにルーティングします。

PoorDevSkills が推奨する開発の流れは以下のとおりです。

1. **探索から始める** — いきなり仕様を書かず、まずプロトタイプで「何が難しいか」を発見する
2. **知見を収穫する** — プロトタイプから学びだけを抽出し、コードはリセットする
3. **構造化フローで構築する** — 検証済みの知見をもとに、仕様→計画→レビュー→実装の構造化パイプラインで慎重に構築する

プロジェクト全体の方向性が未定なら、先にロードマップフローでコンセプトとゴールを整理してから探索に入ります。バグ報告や質問は `/poor-dev` が自動判定して専用フローにルーティングします。

### アイデアを探索する（スクラップ＆ビルド）

「まず作って、壊して、知見をもとに再構築する」── PoorDevSkills が推奨する開発の起点です。完璧な設計より、プロトタイプからの学びが良い設計を生みます。

1. **探索を開始する** — `/poor-dev.discovery` で探索フローを開始します。既存コードの有無を自動検出し、ゼロからの探索と既存コードの整理を自動で分岐します。discovery-memo.md が生成され、CLAUDE.md にリビルドトリガーが設定されます。

2. **プロトタイプを作る** — 保守性を気にせず、自由にコーディングして動くものを最優先で作ります。

3. **リビルド判定を行う** — `/poor-dev.rebuildcheck` で 4 つのシグナル（変更局所性・修正振り子・コンテキスト肥大化・ホットスポット）を分析し、このまま継続するか（CONTINUE）リビルドするか（REBUILD）を客観的に判定します。

4. **知見を収穫する** — `/poor-dev.harvest` でプロトタイプから学びを抽出します。learnings.md（知見）、constitution.md（設計原則）、spec.md（仕様）が生成されます。コードではなく「学び」を残すのがポイントです。

5. **構造化フローに合流する** — `/poor-dev.plan` 以降の機能開発パイプライン（計画→レビュー→タスク→実装→品質検証）に合流し、検証済みの知見をもとに慎重に再構築します。

### ロードマップを策定する

プロジェクト全体の方向性を定める企画フローです。何を作るか自体が未定の段階で、探索に入る前に実施します。

1. **コンセプトを練る** — `/poor-dev.concept` でターゲットユーザー・課題・差別化ポイントを整理し、concept.md を生成します。

2. **ゴールを定義する** — `/poor-dev.goals` で戦略ゴールと成功基準を定義し、goals.md を生成します。

3. **マイルストーンに分解する** — `/poor-dev.milestones` でゴールを具体的なマイルストーンに分解し、依存関係を整理します。

4. **ロードマップを生成する** — `/poor-dev.roadmap` で全成果物を統合し、フェーズ計画を含む roadmap.md を生成します。

ロードマップ完了後、各マイルストーンを `/poor-dev` で探索フローや機能開発フローに移行して実装を進められます。

### 機能を開発する

探索で得た知見や、明確な仕様がある機能を構造化パイプラインで構築します。

1. **仕様を作成する** — `/poor-dev.specify` で自然言語の機能説明から仕様書を生成します。ユーザーストーリー・受け入れ基準・非機能要件が構造化された spec.md が出力されます。曖昧な箇所があれば `/poor-dev.clarify` で質問を通じて仕様を精緻化できます。

2. **技術計画を立てる** — `/poor-dev.plan` で仕様をもとにアーキテクチャ・技術選定・フェーズ分割を含む実装計画を作成します。ベストプラクティスの Web 調査も計画フェーズに統合されています。

3. **計画をレビューする** — `/poor-dev.planreview` で PM・リスク・価値・批判の 4 ペルソナが計画を多角的にレビューします。指摘があれば自動修正ループが走り、指摘ゼロになるまで繰り返します。

4. **タスクに分解する** — `/poor-dev.tasks` で計画を実行可能な粒度のタスクに分解します。依存関係と優先度が明示された tasks.md が生成されます。

5. **タスクをレビューする** — `/poor-dev.tasksreview` で TechLead・Senior・DevOps・Junior の 4 ペルソナがタスクの粒度・依存関係・実行可能性を検証します。

6. **設計をレビューする（任意）** — 必要に応じて `/poor-dev.architecturereview` で Architect・Security・Performance・SRE の 4 ペルソナが SOLID 原則準拠・脆弱性・性能を検証します。

7. **実装する** — `/poor-dev.implement` で tasks.md に従いタスクを順次実装します。

8. **テスト設計** — `/poor-dev.testdesign` で実装コードに基づくテスト計画・テストスケルトンを設計します。

9. **品質を検証する** — `/poor-dev.qualityreview` で品質ゲート（型チェック・リント・テスト）を実行した後、QA・TestDesign・Code・Security の 4 ペルソナ + 敵対的レビューでコード品質を検証します。

10. **完了判定を行う** — `/poor-dev.phasereview` で完了基準・リグレッション・ドキュメントを最終確認し、デプロイ可能判定を行います。

### バグを修正する

`/poor-dev` がバグ報告と判定すると、バグ修正専用フローに入ります。

1. **バグを調査する** — `/poor-dev.bugfix` が再現→調査→5 Whys 分析→根本原因特定→修正計画の順で進みます。推測的修正は禁止されており、必ず根本原因を確認してから修正計画を立てます。過去のバグパターンも自動参照します。

2. **修正を実装する** — 小規模な修正なら `/poor-dev.implement` で直接修正します。大規模な修正の場合は `/poor-dev.plan` → `/poor-dev.planreview` → `/poor-dev.tasks` → `/poor-dev.implement` の構造化パイプラインに合流します。

3. **品質を検証する** — `/poor-dev.qualityreview` で修正の品質を検証します。ポストモーテムが自動生成され、バグパターン DB も更新されます。

### 調査する（原因不明の問題）

「何かがおかしいがバグかどうかわからない」「なぜこうなるのか理解したい」という場合の調査フローです。

1. **調査を開始する** — `/poor-dev.investigate` で問題の現象・証拠・仮説を体系的に分析します。読み取り専用でコードを変更しません。

2. **根本原因を特定する** — 複数の仮説を立て、証拠に基づいて可能性を評価します。5 Whys 分析なども活用します。

3. **次のアクションを決定する** — 調査結果に基づいて適切な次のステップを推奨します：
   - バグ確認 → `/poor-dev.bugfix`
   - 機能不足 → `/poor-dev.specify`
   - 想定内挙動 → ドキュメント化
   - 継続調査 → 追加データ収集

---

## レビューと自動修正の仕組み

PoorDevSkills の核心は **多角的 AI レビュー**と**自動修正ループ**です。すべてのレビューコマンドで以下のサイクルが動きます。

1. **並列レビュー** — 4 つのペルソナが独立してコードを評価（読み取り専用、書き込み権限なし）
2. **指摘集約・重複排除** — 全ペルソナの指摘を Critical / High / Medium / Low に分類し、レビューログ（review-log.yaml）と照合して修正済みの重複指摘を除外
3. **収束判定** — 以下のいずれかで **GO**: (a) C/H 新規 0 件が 2 回連続、(b) 全ペルソナ GO、(c) C+H=0。満たさなければ修正へ
4. **自動修正** — 書き込み権限を持つ修正エージェントが指摘に基づきコードを修正（レビュー判定の変更権限なし、スコープ外提案は自動 reject）
5. **再レビュー** — ステップ 1 に戻り、修正結果を新しいペルソナインスタンスが再評価

5 種類のレビューがそれぞれ異なる観点をカバーします。

| レビュー | コマンド | 何を見るか |
|---------|---------|----------|
| 計画 | `/poor-dev.planreview` | ビジネス価値、リスク、実現可能性 |
| タスク | `/poor-dev.tasksreview` | 依存関係、粒度、実行可能性 |
| 設計 | `/poor-dev.architecturereview` | SOLID 原則、脆弱性、性能 |
| 品質 | `/poor-dev.qualityreview` | テスト網羅性、コード品質 + 敵対的レビュー |
| 完了 | `/poor-dev.phasereview` | 完了基準、リグレッション、ドキュメント |

**安全機構**:
- **権限分離**: レビュアはコードを変更できず、修正者はレビュー判定を変更できない（読み取り専用 / 書き込み専用の分離）
- **レビューログ蓄積**: review-log.yaml で指摘履歴を管理し、修正済み問題の再指摘を防ぎ自然収束を保証
- **レビューログウィンドウ**: 最新 2 イテレーションの全詳細 + 古い fixed issue のサマリーのみ送信（トークン削減 + 回帰検知の両立）
- **スコープ境界**: 全ペルソナに spec.md 外の新機能提案を禁止するルールを適用
- **サイズガード**: 修正エージェントにファイル肥大化の制約（120%上限）を適用
- **自動停止**: 修正ループが深度に応じた上限を超えると自動停止して人間に判断を委ねる

**効率化機構**:
- **リスクベース深度**: 変更規模に応じてレビュー深度を自動調整（deep/standard/light）。小規模変更は 2 ペルソナ・最大 3 イテレーションで完了
- **早期終了**: 3/4 ペルソナが GO（C/H=0）を返した時点で残りをキャンセルし GO 判定。逆に 2/4 が NO-GO なら即座に FIX 移行
- **並列実装**: `[P:group]` マーカー付きタスクを DAG ベースで並列 dispatch（同一ブランチ / worktree / フェーズ分割の 3 戦略）
- **ハイブリッドコンテキスト注入**: ミッションクリティカルな成果物のみ Opus が事前注入、その他は Worker が自己読み込み（トークン節約）

---

## コマンドリファレンス

### エントリポイント

| コマンド | 用途 |
|---------|------|
| `/poor-dev.team` | Agent Teams オーケストレーター（全フロー対応。メインエントリポイント） |
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
| `poor-dev benchmark setup` | ベンチマークディレクトリのセットアップ |
| `poor-dev benchmark update` | ベンチマークスキルファイルの更新 |
| `poor-dev benchmark metrics <dir>` | 指定ディレクトリのメトリクス収集 |
| `poor-dev benchmark compare` | COMPARISON.md の生成 |
| `poor-dev benchmark run <combo> [version]` | ベンチマーク一括実行（セットアップ→非対話パイプライン→分析→メトリクス収集） |
| `/bench <combo>` | ベンチマーク全自動実行（右 tmux ペイン） + PoorDevSkills 分析 |
| `/bench --results <combo>` | ベンチマーク分析結果の表示 |
| `/bench.repair <combo>` | 前回ベンチの失敗診断・修正・smoke test + フルベンチ誘導 |
| `/bench-team <combo>` | Agent Teams ベンチマーク実行（右 tmux ペインで `/poor-dev.team` + Phase 0 自動応答） |
| `/bench-team --results <combo>` | Agent Teams ベンチマーク分析結果の表示 |

---

## レビューペルソナ詳細

### 計画レビュー
- **PM**: ビジネス価値・ユーザー影響・ROI の観点から計画を評価
- **リスク**: 技術的リスク・スケジュールリスク・依存関係リスクを洗い出す
- **価値**: 優先順位の妥当性、MVP スコープの適切さを検証
- **批判**: 計画の矛盾・楽観的見積もり・見落としを厳しく指摘

### タスクレビュー
- **TechLead**: 全体アーキテクチャとの整合性、技術的方向性を確認
- **Senior**: 実装の現実性、エッジケース、技術的負債のリスクを評価
- **DevOps**: CI/CD・デプロイ・インフラ観点でのタスク漏れを指摘
- **Junior**: 初見で理解できるか、ドキュメントや前提知識の不足を指摘

### 設計レビュー
- **Architect**: SOLID 原則・レイヤー構成・拡張性を評価
- **Security**: 認証・認可・入力検証・脆弱性を精査
- **Performance**: ボトルネック・N+1 問題・キャッシュ戦略を検証
- **SRE**: 可観測性・障害耐性・運用負荷を評価

### 品質レビュー
- **QA**: テスト網羅性・境界値テスト・異常系テストの充足度を確認
- **TestDesign**: テスト設計の品質、テストケースの独立性・再現性を評価
- **Code**: コード品質・可読性・命名規約・重複の排除を審査
- **Security**: 実装レベルでのセキュリティ脆弱性（インジェクション・XSS等）を検出

### 完了レビュー
- **QA**: Definition of Done の全項目を照合し、完了基準の充足を最終判定
- **Regression**: 既存機能への影響、リグレッションテストの実行結果を確認
- **Docs**: API ドキュメント・CHANGELOG・ユーザー向けドキュメントの整備状況を確認
- **UX**: ユーザー体験の一貫性、エラーメッセージの親切さ、アクセシビリティを評価

---

## デュアルランタイム戦略

PoorDevSkills は **Claude Code** と **OpenCode** の両方から利用でき、レビューごとに CLI とモデルを使い分けられます。

### Agent Teams モデル構成

Agent Teams パス (`/poor-dev.team`) では、Orchestrator（Opus）と Teammate で異なるモデルを使用するハイブリッド構成を取ります。

| 役割 | モデル | API |
|------|--------|-----|
| Orchestrator（リーダー） | Claude Opus | Anthropic API |
| Teammate（ワーカー・レビュアー） | GLM-5 等 | Z.AI API（`CLAUDE_CODE_TEAMMATE_COMMAND` で差し替え） |

Teammate のモデルはプロセスレベルで差し替えられるため、コード内のモデル指定は無視されます。

### Agent Teams で Teammate を GLM-5 に差し替える（非公式）

> **WARNING**: この方法は非公式です
> - `CLAUDE_CODE_TEAMMATE_COMMAND` は Anthropic 公式ドキュメントに記載されていない非公式の環境変数です（2026-02 時点）
> - Claude Code のアップデートで予告なく動作しなくなる可能性があります
> - Anthropic のサポート対象外です
> - Z.AI API の利用は Z.AI (智谱AI) の利用規約に従います

#### 概要

Agent Teams で Teammate を起動する際、環境変数 `CLAUDE_CODE_TEAMMATE_COMMAND` に glm ラッパーのパスを指定すると、Teammate プロセスだけが Z.AI API 経由で GLM-5 を使用します。リーダー（Opus）は通常の Anthropic API を使い続けるため、**リーダーは高品質な判断、Teammate は低コストな実行**というハイブリッド構成が可能です。

#### セットアップ

```bash
# Z.AI の API キーを用意して実行（対話的にキーを入力）
bash scripts/setup-glm-teammate.sh
```

スクリプトが生成するもの:

| 生成物 | パス | 用途 |
|--------|------|------|
| glm ラッパー | `/usr/local/bin/glm` | GLM-5 で Claude Code を起動。API キー埋め込み + model intercept |
| glm-setup | `/usr/local/bin/glm-setup` | API キー変更後の再生成ヘルパー |
| MCP 設定 | `~/.claude/glm-mcp.json` | Z.AI MCP サーバー（Web検索・Webリーダー・Vision） |
| 環境変数 | `~/.bashrc` | `ZAI_API_KEY` + `CLAUDE_CODE_TEAMMATE_COMMAND` |
| settings | `~/.claude/settings.json` | `env.CLAUDE_CODE_TEAMMATE_COMMAND` |

#### 仕組み

glm ラッパーは以下の 3 段階で動作します:

1. **環境変数の設定** — `ANTHROPIC_BASE_URL` を Z.AI エンドポイントに、`ANTHROPIC_AUTH_TOKEN` を API キーに設定。`ANTHROPIC_DEFAULT_*_MODEL` で全モデルエイリアスを GLM-5 にマッピング
2. **--model intercept** — Agent Teams は Teammate に `--model claude-opus-4-6` のようなリテラルモデル名を渡します。リテラル名は `ANTHROPIC_DEFAULT_*_MODEL` のエイリアスマッピングをバイパスするため、glm ラッパーが引数を書き換えてエイリアス（`opus`/`sonnet`/`haiku`）に変換します
3. **exec claude** — `--mcp-config` で Z.AI MCP サーバーを有効化し、Claude Code を起動

#### 既知の問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| settings.json だけでは Teammate に伝播しない | `env` ブロックが許可リスト外で `process.env` に入らない場合がある | `.bashrc` にも `CLAUDE_CODE_TEAMMATE_COMMAND` を export（ベルト＆サスペンダー方式） |
| OAuth が優先され Anthropic API に接続 | `--model claude-opus-4-6` のリテラル名で OAuth フローが起動 | glm ラッパーの `--model` intercept でエイリアスに変換 |
| API キー変更後に Teammate が認証失敗 | glm ラッパーにキーが埋め込まれている | `glm-setup` でラッパーと MCP 設定を再生成 |

#### 検証方法

```bash
# Teammate プロセスの環境変数を確認（PID は実際の値に置換）
cat /proc/<PID>/environ | tr '\0' '\n' | grep ANTHROPIC

# ネットワーク接続先が api.z.ai であることを確認
ss -tnp | grep <PID>

# api.anthropic.com への推論接続がないことを確認
# (api.z.ai: 128.14.69.x、api.anthropic.com: 160.79.104.x)
```

#### API キー変更時

```bash
# 1. 新しいキーを環境変数に設定
export ZAI_API_KEY="new-key-here"

# 2. glm-setup で glm ラッパーと MCP 設定を再生成
glm-setup

# 3. .bashrc のキーも更新（または setup-glm-teammate.sh を再実行）
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

## 詳細ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [AGENT.md](AGENT.md) | 完全なワークフロードキュメント |
| [constitution.md](constitution.md) | 10 原則の詳細（プロジェクト憲法） |

---

## ライセンス

MIT License

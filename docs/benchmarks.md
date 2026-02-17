# ベンチマーク基盤

## 概要

DevSkills のスキル（PoorDevSkill）が複数のLLMモデルで正しく動作するかを検証・比較するベンチマーク基盤。オーケストレーター×サブエージェントの組み合わせ（12パターン）で同一タスクを実行し、プロセス遵守・コード品質・完全性・UX・憲章準拠・効率の6次元で評価する。

`benchmarks/` ディレクトリは配布パッケージ（npm）には含まれない開発専用ツール。

## ディレクトリ構成

```
benchmarks/
├── benchmarks.json          # タスク定義・モデル定義・組み合わせ定義
├── setup-benchmarks.sh      # スキャフォールド同期 + ベンチ環境セットアップ
├── generate-comparison.sh   # 比較ダッシュボード (COMPARISON.md) 生成
├── _scaffold/               # ベンチマーク環境テンプレート
│   ├── common/              # 共通ファイル (constitution.md, templates/, .gitignore)
│   ├── claude-variant/      # Claude CLI 用バリアント (.opencode/command/)
│   └── opencode-variant/    # OpenCode CLI 用バリアント (.opencode/command/)
└── reviews/                 # レビューフレームワーク
    ├── collect-metrics.sh   # メトリクス収集スクリプト
    ├── COMPARISON.md        # 比較ダッシュボード（生成物）
    └── _templates/
        └── benchmark-review.yaml  # レビューテンプレート
```

## モデル定義

| キー | 表示名 | CLI | モデルID |
|---|---|---|---|
| `claude` | Claude | claude | opus |
| `m2.5` | MiniMax M2.5 | opencode | opencode/minimax-m2.5-free |
| `glm5` | GLM-5 | opencode | zai-coding-plan/glm-5 |

## 組み合わせマトリクス

| ディレクトリ | オーケストレーター | サブエージェント | 役割 |
|---|---|---|---|
| `m2.5_all` | MiniMax M2.5 | MiniMax M2.5 | solo |
| `glm5_all` | GLM-5 | GLM-5 | solo |
| `claude_all` | Claude | Claude | solo |
| `claude_glm5_sub` | Claude | GLM-5 | orch+sub |
| `claude_m2.5_sub` | Claude | MiniMax M2.5 | orch+sub |
| `m2.5_orch_glm5_sub` | MiniMax M2.5 | GLM-5 | orch+sub |
| `claude_baseline` | Claude | Claude | baseline |
| `glm5_baseline` | GLM-5 | GLM-5 | baseline |
| `m2.5_baseline` | MiniMax M2.5 | MiniMax M2.5 | baseline |
| `glm5_claude_plan` | GLM-5 | GLM-5 | step-override (plan=Claude) |
| `glm5_claude_specify` | GLM-5 | GLM-5 | step-override (specify=Claude) |
| `glm5_claude_design` | GLM-5 | GLM-5 | step-override (specify,suggest,plan=Claude) |

## ステップオーバーライドパターン

`step_overrides` を使うと、GLM-5 をベースモデルとしつつ特定のパイプラインステップだけ Claude Opus を使う組み合わせを定義できる。目的は「上流のどのステップに Opus を投入するとコスパよく全体品質が向上するか」のデータ取得。

| パターン | Opus 対象ステップ | テスト仮説 |
|---|---|---|
| `glm5_claude_plan` | plan | plan の設計品質がボトルネック |
| `glm5_claude_specify` | specify | 仕様品質が全体を決定（GIGO） |
| `glm5_claude_design` | specify + suggest + plan | 上流の設計フェーズ全体がボトルネック |

`config-resolver.sh` の既存 5-level resolution chain がそのまま動作する。`overrides.<step>` にマッチするステップだけ Claude Opus が使われ、それ以外は GLM-5 がデフォルトとして使われる。

`config_extras` フィールドにより、サブエージェントモデル固有のチューニング値（`command_variant`, `review_mode`, timeout 等）が base config に deep merge される。

## 使い方

### セットアップ（初回 or 全リセット）

```bash
./benchmarks/setup-benchmarks.sh
```

6つの組み合わせディレクトリが `benchmarks/` 下に生成される。各ディレクトリは独立した git リポジトリとして初期化される。

### スキルファイル更新（既存環境を維持したまま）

```bash
./benchmarks/setup-benchmarks.sh --update
```

DevSkills のコマンド/エージェントファイルをスキャフォールドに同期し、各ベンチマーク環境のスキルファイルだけを更新する。

### run-benchmark.sh

個別のフェーズを実行するユーティリティスクリプト。

```bash
# フル実行（セットアップ → パイプライン → 分析 → メトリクス）
./benchmarks/run-benchmark.sh <combo> [version]

# 環境セットアップのみ（lib/commands/pipeline.md 配置）
./benchmarks/run-benchmark.sh --setup <combo> [version]

# ポスト処理のみ（メトリクス収集 + PoorDevSkills 分析 + 完了マーカー）
./benchmarks/run-benchmark.sh --post <combo>

# メトリクス収集のみ
./benchmarks/run-benchmark.sh --collect <combo>
```

`/bench` スキルは `--setup` と `--post` を使用する。パイプライン実行自体は対話 TUI（`opencode` / `claude`）経由で行われる。

### ベンチマーク実行（/bench スキル）

`/bench <combo>` で対話 TUI 経由のベンチマーク実行を開始する:

1. `--setup` で環境セットアップ
2. 右 tmux ペインに対話 TUI（opencode / claude）を起動
3. `/poor-dev` プロンプトを TUI にキー入力として送信
4. pipeline-state.json をポーリングして完了監視
5. 完了後 `--post` でメトリクス収集・分析

TUI 内ではスキル（`/poor-dev`）が正しく認識・実行され、PoorDevSkills パイプライン（specify → plan → tasks → implement → review）が完全に動作する。

> **Note**: TUI モードでは `.bench-output.txt` は生成されない。パイプライン成果物（spec.md, plan.md, tasks.md, コード, pipeline-state.json）が実行結果となる。

### メトリクス収集

```bash
./benchmarks/reviews/collect-metrics.sh <dir_name>
# 例: ./benchmarks/reviews/collect-metrics.sh m2.5_all
```

ファイル統計・パイプライン状態・Git履歴・タイミング・モデル設定を出力する。

### 比較レポート再生成

```bash
./benchmarks/generate-comparison.sh
```

`benchmarks.json` から `reviews/COMPARISON.md` を再生成する。

## レビューフロー

1. ベンチマーク環境でタスクを実行
2. `./benchmarks/reviews/collect-metrics.sh <dir>` でメトリクス収集
3. `cp benchmarks/reviews/_templates/benchmark-review.yaml benchmarks/reviews/<dir>.review.yaml`
4. レビューテンプレートに記入
5. `reviews/COMPARISON.md` にスコアを追記

## ベースラインモード

`mode: "baseline"` の組み合わせは PoorDevSkills パイプライン（specify→plan→tasks→implement→review）を使わず、各モデルの CLI で素のプロンプト1発実行する。パイプラインの付加価値を測定するための比較対象。

- **Claude CLI**: `claude -p --output-format json` → 単一 JSON 出力
- **OpenCode CLI**: `opencode run --format json` → JSONL 出力（step_finish イベントから集約）

### baseline と pipeline の違い

| 項目 | pipeline | baseline |
|---|---|---|
| プロンプト | `/poor-dev` プレフィックス付き | 素のタスク説明 + 要件リスト |
| スキャフォールド | フル（constitution, templates, commands, lib） | 最小（.gitignore, CLAUDE.md のみ） |
| 成果物 | spec.md, plan.md, tasks.md, コード, review-log.yaml | コードのみ |
| メトリクス | ファイル統計, git 履歴, タイミング推定 | CLI 出力からトークン/コスト/実行時間を直接取得 |
| PoorDevSkills 分析 | あり（poordev-analysis.yaml） | なし |
| CLI オプション | `--output-format text` | Claude: `--output-format json`, OpenCode: `--format json` |

### baseline 実行フロー

```bash
# フル実行
./benchmarks/run-benchmark.sh claude_baseline

# セットアップのみ
./benchmarks/run-benchmark.sh --setup claude_baseline

# メトリクス収集のみ
./benchmarks/run-benchmark.sh --collect claude_baseline
```

実行後、`claude_baseline/.bench-metrics.json` にトークン数・コスト・実行時間が記録される。

## スコアリング次元

| 次元 | 重み | 概要 |
|---|---|---|
| Process (プロセス遵守) | 15% | DevSkills ワークフロー各段階の遵守 |
| Code Quality (コード品質) | 25% | バグ・セキュリティ・構造・スタイルの品質 |
| Completeness (完全性) | 25% | 機能要件 (FR-001〜FR-013) の充足度 |
| UX/Visual | 15% | ビジュアルデザイン・レスポンシブ・ユーザビリティ |
| Constitution (憲章準拠) | 10% | DevSkills 憲章の関連原則チェック |
| Efficiency (効率) | 10% | 実行時間・出力量・速度の相対評価 |

## 技術詳細

### config 導出ロジック

`setup-benchmarks.sh` の `derive_config()` が `.poor-dev/config.json` を生成する:

- **Solo** (orch=sub): CLI=サブ, model=サブ, fallback=モデル定義のfallback ?? サブ
- **Hybrid 同CLI**: CLI=サブ, model=サブ, fallback=オーケストレーター
- **Hybrid 異CLI**: CLI=サブ, model=サブ, fallback=サブ

### CLI ルーティング

- `claude` CLI → `.claude/commands/` にシンボリックリンク作成（`.opencode/command/` を参照）
- `opencode` CLI → `.opencode/command/` を直接使用、`opencode.json` にオーケストレーターモデルを設定

### スキャフォールド同期

`sync_scaffold()` が DevSkills のソースから以下を同期:
- `.opencode/command/poor-dev*.md` → 両バリアント（`pipeline.md` は除外）
- `.opencode/agents/` → 両バリアント
- `.claude/agents/` → 両バリアント
- `constitution.md`, `templates/` → common

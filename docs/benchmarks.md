# ベンチマーク基盤

## 概要

DevSkills のスキル（PoorDevSkill）が複数のLLMモデルで正しく動作するかを検証・比較するベンチマーク基盤。オーケストレーター×サブエージェントの組み合わせ（6パターン）で同一タスクを実行し、プロセス遵守・コード品質・完全性・UX・憲章準拠・効率の6次元で評価する。

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

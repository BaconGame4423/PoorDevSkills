# benchLLM 比較ダッシュボード

> タスク: 関数ビジュアライザー（微分機能付きインタラクティブ数学ツール）
> 最終更新: 2026-02-17

---

## ステータス一覧

| ディレクトリ | モデル構成 | 役割 | パイプライン段階 | 出力 | ステータス |
|---|---|---|---|---|---|
| `m2.5_all` | MiniMax M2.5 | solo | -- | -- | 未開始 |
| `glm5_all` | GLM-5 | solo | -- | -- | 未開始 |
| `claude_all` | Claude | solo | -- | -- | 未開始 |
| `claude_glm5_sub` | Claude + GLM-5 | orch+sub | -- | -- | 未開始 |
| `claude_m2.5_sub` | Claude + MiniMax M2.5 | orch+sub | -- | -- | 未開始 |
| `m2.5_orch_glm5_sub` | MiniMax M2.5 + GLM-5 | orch+sub | -- | -- | 未開始 |
| `claude_baseline` | Claude (Baseline) | baseline | -- | -- | 未開始 |
| `glm5_baseline` | GLM-5 (Baseline) | baseline | -- | -- | 未開始 |
| `m2.5_baseline` | MiniMax M2.5 (Baseline) | baseline | -- | -- | 未開始 |
| `glm5_claude_plan` | GLM-5 (plan=Claude) | step-override | -- | -- | 未開始 |
| `glm5_claude_specify` | GLM-5 (specify=Claude) | step-override | -- | -- | 未開始 |
| `glm5_claude_design` | GLM-5 (specify=Claude,suggest=Claude,plan=Claude) | step-override | -- | -- | 未開始 |

---

## スコア比較

| 次元 | 重み | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Process (プロセス遵守) | 15% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Code Quality (コード品質) | 25% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Completeness (完全性) | 25% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| UX/Visual | 15% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Constitution (憲章準拠) | 10% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Efficiency (効率) | 10% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| **総合** | **100%** | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

> `--` = 未レビュー（作業完了後にレビュー実施予定）

---

## 要件充足マトリクス

| 要件 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FR-001 インタラクティブ関数グラフ表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-002 数式入力フィールド | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-003 リアルタイムグラフ更新 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-004 自動ズーム/スケール | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-005 軸ラベルとグリッド線 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-006 複数関数サポート (sin,cos,tan,log,exp,sqrt,abs) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-007 微分（導関数）の計算と表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-008 導関数のグラフ重畳表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-009 カーソル追従ツールチップ (x, f(x), f'(x)) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-010 接線表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-011 レスポンシブデザイン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-012 エラーハンドリング（不正入力） | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| FR-013 プリセット関数ボタン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| **達成率** | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

---

## 効率メトリクス

| 指標 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 壁時計時間 (秒) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| セッション数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| 出力行数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| 出力バイト数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| 出力速度 (lines/sec) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| 生成ファイル数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| 入力トークン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| 出力トークン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| コスト (USD) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

---

## プロセス遵守比較

| 段階 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| specify | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| plan | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| planreview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| tasks | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| tasksreview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| implement | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| qualityreview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| phasereview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

---

## 課題サマリ (重要度別)

### Critical (C)
_(現時点で該当なし)_

### High (H)
| ID | ディレクトリ | 内容 |
|---|---|---|
| -- | -- | -- |

### Medium (M)
| ID | ディレクトリ | 内容 |
|---|---|---|
| -- | -- | -- |

### Low (L)
| ID | ディレクトリ | 内容 |
|---|---|---|
| -- | -- | -- |

---

## 強み / 弱み 比較

### m2.5_all (MiniMax M2.5 solo)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_all (GLM-5 solo)
- **強み**: --
- **弱み**: --
- **特徴**: --

### claude_all (Claude solo)
- **強み**: --
- **弱み**: --
- **特徴**: --

### claude_glm5_sub (Claude + GLM-5 orch+sub)
- **強み**: --
- **弱み**: --
- **特徴**: --

### claude_m2.5_sub (Claude + MiniMax M2.5 orch+sub)
- **強み**: --
- **弱み**: --
- **特徴**: --

### m2.5_orch_glm5_sub (MiniMax M2.5 + GLM-5 orch+sub)
- **強み**: --
- **弱み**: --
- **特徴**: --

### claude_baseline (Claude (Baseline) baseline)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_baseline (GLM-5 (Baseline) baseline)
- **強み**: --
- **弱み**: --
- **特徴**: --

### m2.5_baseline (MiniMax M2.5 (Baseline) baseline)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_claude_plan (GLM-5 (plan=Claude) step-override)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_claude_specify (GLM-5 (specify=Claude) step-override)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_claude_design (GLM-5 (specify=Claude,suggest=Claude,plan=Claude) step-override)
- **強み**: --
- **弱み**: --
- **特徴**: --

---

## レビューフロー

各ディレクトリの作業完了時:
1. `./reviews/collect-metrics.sh <dir>` でメトリクス収集
2. `cp reviews/_templates/benchmark-review.yaml reviews/<dir>.review.yaml`
3. レビュー記入
4. 本ファイル (COMPARISON.md) にスコアを追記

---

_Generated by benchLLM review framework_

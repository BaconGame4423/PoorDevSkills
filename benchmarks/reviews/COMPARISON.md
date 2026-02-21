# benchLLM 比較ダッシュボード

> タスク: 関数ビジュアライザー（微分機能付きインタラクティブ数学ツール）
> 最終更新: 2026-02-21

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
| `sonnet_all` | Claude Sonnet 4.6 | solo | -- | -- | 未開始 |
| `sonnet_glm5_sub` | Claude Sonnet 4.6 + GLM-5 | orch+sub | -- | -- | 未開始 |
| `sonnet_m2.5_sub` | Claude Sonnet 4.6 + MiniMax M2.5 | orch+sub | -- | -- | 未開始 |
| `sonnet_baseline` | Claude Sonnet 4.6 (Baseline) | baseline | -- | -- | 未開始 |
| `glm5_sonnet_plan` | GLM-5 (plan=Claude Sonnet 4.6) | step-override | -- | -- | 未開始 |
| `glm5_sonnet_specify` | GLM-5 (specify=Claude Sonnet 4.6) | step-override | -- | -- | 未開始 |
| `glm5_sonnet_design` | GLM-5 (specify=Claude Sonnet 4.6,suggest=Claude Sonnet 4.6,plan=Claude Sonnet 4.6) | step-override | -- | -- | 未開始 |
| `claude_team` | Claude (Opus 4.6 team) | team | 11/11完了 | index.html (1516行) | 完了 (Run 2) |
| `sonnet_team` | Claude Sonnet 4.6 | team | -- | -- | 未開始 |

---

## スコア比較

| 次元 | 重み | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` | `sonnet_all` | `sonnet_glm5_sub` | `sonnet_m2.5_sub` | `sonnet_baseline` | `glm5_sonnet_plan` | `glm5_sonnet_specify` | `glm5_sonnet_design` | `claude_team` | `sonnet_team` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Process (プロセス遵守) | 15% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 95 | -- |
| Code Quality (コード品質) | 25% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 88 | -- |
| Completeness (完全性) | 25% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 100 | -- |
| UX/Visual | 15% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 80 | -- |
| Constitution (憲章準拠) | 10% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 95 | -- |
| Efficiency (効率) | 10% | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 68 | -- |
| **総合** | **100%** | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | **90.05 (A-)** | -- |

> `--` = 未レビュー（作業完了後にレビュー実施予定）

---

## 要件充足マトリクス

| 要件 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` | `sonnet_all` | `sonnet_glm5_sub` | `sonnet_m2.5_sub` | `sonnet_baseline` | `glm5_sonnet_plan` | `glm5_sonnet_specify` | `glm5_sonnet_design` | `claude_team` | `sonnet_team` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FR-001 インタラクティブ関数グラフ表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-002 数式入力フィールド | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-003 リアルタイムグラフ更新 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-004 自動ズーム/スケール | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-005 軸ラベルとグリッド線 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-006 複数関数サポート (sin,cos,tan,log,exp,sqrt,abs) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-007 微分（導関数）の計算と表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-008 導関数のグラフ重畳表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-009 カーソル追従ツールチップ (x, f(x), f'(x)) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-010 接線表示 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-011 レスポンシブデザイン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-012 エラーハンドリング（不正入力） | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| FR-013 プリセット関数ボタン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | pass | -- |
| **達成率** | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 13/13 (100%) | -- |

---

## 効率メトリクス

| 指標 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` | `sonnet_all` | `sonnet_glm5_sub` | `sonnet_m2.5_sub` | `sonnet_baseline` | `glm5_sonnet_plan` | `glm5_sonnet_specify` | `glm5_sonnet_design` | `claude_team` | `sonnet_team` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 壁時計時間 (秒) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 4920 | -- |
| セッション数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 1 | -- |
| 出力行数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 4701 | -- |
| 出力バイト数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 45071 | -- |
| 出力速度 (lines/sec) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 0.96 | -- |
| 生成ファイル数 | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | 8 | -- |
| 入力トークン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| 出力トークン | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| コスト (USD) | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

---

## プロセス遵守比較

| 段階 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` | `glm5_claude_plan` | `glm5_claude_specify` | `glm5_claude_design` | `sonnet_all` | `sonnet_glm5_sub` | `sonnet_m2.5_sub` | `sonnet_baseline` | `glm5_sonnet_plan` | `glm5_sonnet_specify` | `glm5_sonnet_design` | `claude_team` | `sonnet_team` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| specify | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| suggest | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| plan | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| planreview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| tasks | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| tasksreview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| implement | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| architecturereview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| qualityreview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |
| phasereview | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | OK | -- |

---

## 課題サマリ (重要度別)

### Critical (C)
_(現時点で該当なし)_

### High (H)
_(現時点で該当なし)_

### Medium (M)
| ID | ディレクトリ | 内容 |
|---|---|---|
| CQ-R2-003 | claude_team | tasks.md の 217 AC が全て [ ] のまま通過 (2回連続再現) |

### Low (L)
| ID | ディレクトリ | 内容 |
|---|---|---|
| CQ-R2-001 | claude_team | TooltipManager で innerHTML 使用 (XSS リスクは実質なし) |
| CQ-R2-002 | claude_team | EventManager.listeners の fn が空アロー関数 (destroy() クリーンアップ不完全) |

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

### sonnet_all (Claude Sonnet 4.6 solo)
- **強み**: --
- **弱み**: --
- **特徴**: --

### sonnet_glm5_sub (Claude Sonnet 4.6 + GLM-5 orch+sub)
- **強み**: --
- **弱み**: --
- **特徴**: --

### sonnet_m2.5_sub (Claude Sonnet 4.6 + MiniMax M2.5 orch+sub)
- **強み**: --
- **弱み**: --
- **特徴**: --

### sonnet_baseline (Claude Sonnet 4.6 (Baseline) baseline)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_sonnet_plan (GLM-5 (plan=Claude Sonnet 4.6) step-override)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_sonnet_specify (GLM-5 (specify=Claude Sonnet 4.6) step-override)
- **強み**: --
- **弱み**: --
- **特徴**: --

### glm5_sonnet_design (GLM-5 (specify=Claude Sonnet 4.6,suggest=Claude Sonnet 4.6,plan=Claude Sonnet 4.6) step-override)
- **強み**: --
- **弱み**: --
- **特徴**: --

### claude_team (Claude Opus 4.6 team) — Run 2
- **強み**: 全13要件pass、math.js採用でCQ大幅向上(88)、fixサイクル0回、Pointer Events+ARIA改善
- **弱み**: AC全未チェック(2回連続)、review-log.yaml未生成、Canvasキーボード操作なし、82分
- **特徴**: Run 2でA-到達。Phase 0応答ミスがmath.js許可に→結果的にCQ+10pt。fix 0回=品質安定

### sonnet_team (Claude Sonnet 4.6 solo)
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

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
| `claude_baseline` | Claude (Baseline) | baseline | implement | index.html | レビュー済 |
| `glm5_baseline` | GLM-5 (Baseline) | baseline | implement | function-visualizer.html | レビュー済 |
| `m2.5_baseline` | MiniMax M2.5 (Baseline) | baseline | implement | index.html | レビュー済 |

---

## スコア比較

| 次元 | 重み | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` |
|---|---|---|---|---|---|---|---|---|---|---|
| Process (プロセス遵守) | 15% | -- | -- | -- | -- | -- | -- | 0 (N/A) | 0 (N/A) | 0 (N/A) |
| Code Quality (コード品質) | 25% | -- | -- | -- | -- | -- | -- | 78 | 62 | 35 |
| Completeness (完全性) | 25% | -- | -- | -- | -- | -- | -- | 100 | 77 | 33 |
| UX/Visual | 15% | -- | -- | -- | -- | -- | -- | 72 | 56 | 52 |
| Constitution (憲章準拠) | 10% | -- | -- | -- | -- | -- | -- | 0 (N/A) | 0 (N/A) | 0 (N/A) |
| Efficiency (効率) | 10% | -- | -- | -- | -- | -- | -- | 85 | 88 | 40 |
| **総合 (全項目)** | **100%** | -- | -- | -- | -- | -- | -- | **64 (D)** | **52 (D)** | **29 (F)** |
| **総合 (excl process)** | **75%換算** | -- | -- | -- | -- | -- | -- | **84 (B)** | **69 (C)** | **38 (F)** |

> `--` = 未レビュー（作業完了後にレビュー実施予定）
> baseline はプロセス/憲章が N/A のため、**excl process** が実質スコア

---

## 要件充足マトリクス

| 要件 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` |
|---|---|---|---|---|---|---|---|---|---|
| FR-001 インタラクティブ関数グラフ表示 | -- | -- | -- | -- | -- | -- | pass | partial | bug |
| FR-002 数式入力フィールド | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| FR-003 リアルタイムグラフ更新 | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| FR-004 自動ズーム/スケール | -- | -- | -- | -- | -- | -- | pass | partial | fail |
| FR-005 軸ラベルとグリッド線 | -- | -- | -- | -- | -- | -- | pass | pass | pass |
| FR-006 複数関数サポート (sin,cos,tan,log,exp,sqrt,abs) | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| FR-007 微分（導関数）の計算と表示 | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| FR-008 導関数のグラフ重畳表示 | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| FR-009 カーソル追従ツールチップ (x, f(x), f'(x)) | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| FR-010 接線表示 | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| FR-011 レスポンシブデザイン | -- | -- | -- | -- | -- | -- | pass | partial | partial |
| FR-012 エラーハンドリング（不正入力） | -- | -- | -- | -- | -- | -- | pass | partial | pass |
| FR-013 プリセット関数ボタン | -- | -- | -- | -- | -- | -- | pass | pass | bug |
| **達成率** | -- | -- | -- | -- | -- | -- | **100%** | **77%** | **33%** |

---

## 効率メトリクス

| 指標 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` |
|---|---|---|---|---|---|---|---|---|---|
| 壁時計時間 (秒) | -- | -- | -- | -- | -- | -- | 170 | 164 | 113 |
| セッション数 | -- | -- | -- | -- | -- | -- | 1 | 1 | 1 |
| 出力行数 | -- | -- | -- | -- | -- | -- | 1059 | 858 | 1176 |
| 出力バイト数 | -- | -- | -- | -- | -- | -- | 30633 | 30861 | 42391 |
| 出力速度 (lines/sec) | -- | -- | -- | -- | -- | -- | 6.23 | 5.23 | 10.41 |
| 生成ファイル数 | -- | -- | -- | -- | -- | -- | 1 | 1 | 1 |
| 入力トークン | -- | -- | -- | -- | -- | -- | 9 | 29466 | 29266 |
| 出力トークン | -- | -- | -- | -- | -- | -- | 13395 | 7562 | 10039 |
| コスト (USD) | -- | -- | -- | -- | -- | -- | $0.545 | $0.043 | $0.021 |

---

## コスト比較 (ベースライン)

| 指標 | Claude | GLM-5 | M2.5 |
|---|---|---|---|
| 推定コスト | $0.545 | $0.043 | $0.021 |
| コスト比 (vs Claude) | 1.0x | 0.08x (1/13) | 0.04x (1/26) |
| 完全性 | 100% | 77% | 33% |
| コスト/完全性1%あたり | $0.0055 | $0.0006 | $0.0006 |
| プラン | API従量 | Pro $27/月 | Plus-Highspeed $40/月 |
| 備考 | Opus $0.540 + Haiku $0.005 | ~400 prompts/5h | Free キャンペーン中 |

---

## プロセス遵守比較

| 段階 | `m2.5_all` | `glm5_all` | `claude_all` | `claude_glm5_sub` | `claude_m2.5_sub` | `m2.5_orch_glm5_sub` | `claude_baseline` | `glm5_baseline` | `m2.5_baseline` |
|---|---|---|---|---|---|---|---|---|---|
| specify | -- | -- | -- | -- | -- | -- | - | - | - |
| plan | -- | -- | -- | -- | -- | -- | - | - | - |
| planreview | -- | -- | -- | -- | -- | -- | - | - | - |
| tasks | -- | -- | -- | -- | -- | -- | - | - | - |
| tasksreview | -- | -- | -- | -- | -- | -- | - | - | - |
| implement | -- | -- | -- | -- | -- | -- | done | done | done |
| qualityreview | -- | -- | -- | -- | -- | -- | - | - | - |
| phasereview | -- | -- | -- | -- | -- | -- | - | - | - |

> baseline は implement のみ実施。パイプライン段階は評価対象外

---

## 課題サマリ (重要度別)

### Critical (C)
| ID | ディレクトリ | 内容 |
|---|---|---|
| CQ-001 | m2.5_baseline | tokenizer が `x` を FUNCTION 型で分類 → 全式パースエラー → アプリ動作不能 |
| CQ-002 | m2.5_baseline | simplifyDerivative の fallback が `{type: ast.op}` を返す → 導関数が NaN/'?' |

### High (H)
| ID | ディレクトリ | 内容 |
|---|---|---|
| CQ-003 | m2.5_baseline | autoScale チェックボックスのみで実装ロジック完全欠落 |

### Medium (M)
| ID | ディレクトリ | 内容 |
|---|---|---|
| CQ-001 | glm5_baseline | `new Function()` による数式評価 (eval 相当のセキュリティリスク) |
| CQ-002 | glm5_baseline | regex 逐次置換パーサー (単語境界なし、カスケード破損) |

### Low (L)
| ID | ディレクトリ | 内容 |
|---|---|---|
| CQ-001 | claude_baseline | switch case に break 文なし (return で問題なし) |
| CQ-002 | claude_baseline | autoZoom サンプリング範囲固定 (-10〜10) |
| CQ-003 | claude_baseline | drawCurve ステップ数が高DPIで過剰 |
| CQ-003 | glm5_baseline | range 入力のバリデーション不足 (0→falsy→-10) |
| CQ-004 | glm5_baseline | input デバウンスなし |
| CQ-005 | glm5_baseline | 859行モノリシック構造 |

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

### claude_baseline (Claude Baseline)
- **強み**: 全13要件完全充足 (100%)、AST パーサー + 記号微分、タッチ対応
- **弱み**: $0.545 のコスト (3モデル中最高)、アクセシビリティ未対応
- **特徴**: 品質の anchor。コスト度外視なら最も確実な選択肢

### glm5_baseline (GLM-5 Baseline)
- **強み**: 最高コスト効率 ($0.043 で 77% 完全性)、全基本機能動作、カラーピッカー
- **弱み**: new Function() セキュリティリスク、タッチ非対応、ドラッグパンなし
- **特徴**: コスト重視ユースケースで最良。Claude の 1/13 コストで 77% 品質

### m2.5_baseline (MiniMax M2.5 Baseline)
- **強み**: 最速 (113秒)、最低コスト ($0.021)、最多コード量 (1176行)、設計意図は健全
- **弱み**: Critical tokenizer バグでアプリ動作不能、autoScale 未実装
- **特徴**: 1行修正で大幅改善の可能性。量≠質の典型例。検証ゲートの重要性を示す

---

## レビューフロー

各ディレクトリの作業完了時:
1. `./reviews/collect-metrics.sh <dir>` でメトリクス収集
2. `cp reviews/_templates/benchmark-review.yaml reviews/<dir>.review.yaml`
3. レビュー記入
4. 本ファイル (COMPARISON.md) にスコアを追記

---

_Generated by benchLLM review framework_

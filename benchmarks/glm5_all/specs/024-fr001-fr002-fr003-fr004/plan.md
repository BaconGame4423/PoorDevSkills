# Implementation Plan: Interactive Function Visualizer with Differentiation

**Date**: 2026-02-17
**Input**: Feature specification from spec.md

## Summary

微分機能付きインタラクティブ数学ビジュアライザー。math.js による記号微分 + function-plot (D3) によるグラフ描画を組み合わせ、複数関数同時表示、手動パン/ズーム、リアルタイム更新、接線・ツールチップ機能を実現する。単一HTMLファイル（Vanilla JS/TypeScript）で完結し、CDN経由でライブラリを読み込む軽量構成。

## Technical Context

**Language/Version**: TypeScript 5.x (Vanilla, no framework)
**Primary Dependencies**: 
- math.js 12.x (CDN) - 式パース・記号微分・評価
- function-plot 1.x (CDN) - D3ベースのグラフ描画
**Storage**: なし（ステートレス、URLパラメータで関数共有はオプション）
**Testing**: Vitest (単体テスト), Playwright (E2E)
**Target Platform**: モダンブラウザ (Chrome 90+, Firefox 90+, Safari 14+, Edge 90+)

## Project Structure

```text
src/
├── index.html              # エントリーポイント
├── main.ts                 # アプリ初期化・イベントバインディング
├── styles.css              # レスポンシブスタイル
├── core/
│   ├── parser.ts           # math.js ラッパー・式パース・バリデーション
│   ├── differentiator.ts   # 記号微分エンジン
│   ├── evaluator.ts        # 関数評価（複数関数・ドメイン処理）
│   └── types.ts            # 共通型定義
├── graph/
│   ├── plotter.ts          # function-plot ラッパー・描画制御
│   ├── viewport.ts         # パン/ズーム・オートスケール管理
│   ├── tooltip.ts          # カーソル追従ツールチップ
│   └── tangent.ts          # 接線描画ロジック
├── ui/
│   ├── input.ts            # 入力フィールド・デバウンス処理
│   ├── presets.ts          # プリセットボタン
│   ├── error-display.ts    # エラーメッセージ表示
│   └── responsive.ts       # レスポンシブレイアウト制御
└── test/
    ├── parser.test.ts
    ├── differentiator.test.ts
    ├── plotter.test.ts
    └── e2e/
        └── graph-interaction.spec.ts
```

**Structure Decision**: 単一HTMLエントリで完結するフラット構成。コア機能とUI関心事を分離し、テスタビリティを確保。TypeScript採用で型安全性とドキュメンテーション性を高める。

## Architecture

### Component Overview

| Component | Responsibility |
|-----------|---------------|
| `parser` | ユーザー入力をmath.jsノードツリーに変換、構文エラー検出 |
| `differentiator` | math.js `derivative()` APIで記号微分、導関数文字列生成 |
| `evaluator` | パース済み式の数値評価、ドメイン外値の処理 |
| `plotter` | function-plot初期化、複数関数登録、色割り当て |
| `viewport` | オートスケール計算、マニュアルパン/ズーム状態管理 |
| `tooltip` | mousemoveイベントでx,f(x),f'(x)を計算・表示 |
| `tangent` | カーソル位置のf'(x)から接線のy切片・傾きを計算し描画 |
| `input` | 300msデバウンス、Enter/blurで即時更新 |
| `presets` | sin,cos,tan,log,exp,sqrt,absボタンクリック処理 |
| `error-display` | math.js例外をユーザーフレンドリーなメッセージに変換 |

### Data Flow

```
[User Input] 
    ↓ (debounce 300ms)
[parser.parse()] → syntax error? → [error-display]
    ↓ valid
[differentiator.derive()] → derivative expression
    ↓
[evaluator.sample(fn, viewport)] → point arrays
[evaluator.sample(fn', viewport)] → derivative points
    ↓
[plotter.render([fn, fn'], colors)] → SVG graph
    ↓ (mousemove)
[tooltip.update(x)] → compute f(x), f'(x)
[tangent.draw(x, f(x), f'(x))] → line overlay
```

### Contracts & Interfaces

```typescript
// core/types.ts
interface ParsedFunction {
  id: string;
  expression: string;
  node: math.MathNode;          // math.js AST
  derivativeNode: math.MathNode;
  derivativeExpr: string;       // 表示用文字列
  color: string;
  derivativeColor: string;
}

interface Viewport {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
}

interface TooltipData {
  x: number;
  values: Array<{ fn: string; y: number; yPrime: number }>;
}

// graph/plotter.ts
interface Plotter {
  render(functions: ParsedFunction[], viewport: Viewport): void;
  setViewport(viewport: Viewport): void;
  onViewportChange(callback: (v: Viewport) => void): void;
}

// core/parser.ts
interface Parser {
  parse(expr: string): ParsedFunction | ParseError;
  validate(expr: string): boolean;
}
```

## Implementation Approach

### Phase 0: Research (if needed)

**math.js 記号微分の挙動確認**:
- `derivative('x^3', 'x')` → `3 * x ^ 2` (期待通り)
- `derivative('sin(x)', 'x')` → `cos(x)` ✓
- `derivative('log(x)', 'x')` → `1 / x` ✓
- 複合関数チェーンルール対応確認済み

**function-plot 複数関数・tip オプション確認**:
- `data: [{ fn: 'x^2' }, { fn: '2*x' }]` で複数表示可能
- `tip: { xLine: true, yLine: true }` でカーソル位置表示
- `onMouseOver` コールバックでカスタムツールチップ可能

### Phase 1: Design

**主要設計決定**:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| グラフライブラリ | function-plot (D3) | JSXGraphより軽量、tip/tangent機能が内蔵、D3のpan/zoomが高性能 |
| 微分方式 | math.js記号微分 | 数値近似より正確、導関数の式を表示可能 |
| バンドル | CDN + 単一HTML | ビルド不要、教育ツールとして手軽 |
| 複数関数管理 | 配列 + Map | 追加順序維持 + 高速ID検索 |
| オートスケール | function-plot内蔵 + ヒューリスティック調整 | まず内蔵を使い、端数の場合は自前で調整 |

**トレードオフ**:
- function-plot vs JSXGraph: function-plotは軽量だがmobile touchが弱い → touch eventsは自前で補完
- SVG vs Canvas: SVG選択（tooltip/tangent実装容易、アクセシビリティ良好）
- 単一HTML vs build: ビルドなしでシンプルさ優先 → 大規模化したらVite導入検討

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| math.jsパース失敗でアプリクラッシュ | 高 | try-catch + エラーバウンダリ + フォールバック |
| tan(x)の漸近線でオートスケール破綻 | 中 | adaptive sampling + 漸近線検出で除外区間設定 |
| 50ms tooltip応答違反 | 中 | requestAnimationFrame + 評価結果キャッシュ |
| mobile touch pan/zoom不安定 | 中 | touch events polyfill + hammer.js検討 |
| 複数関数で色が重複 | 低 | 事前定義パレット + 動的生成 |
| log(-x)等ドメイン外でNaN連鎖 | 中 | evaluator で null/undefined 返し、描画スキップ |
| function-plotのメンテナンス停滞 | 低 | D3直接操作へのフォールバックパス確保 |

[PROGRESS: plan complete]

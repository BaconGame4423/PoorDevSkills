# Tasks: Interactive Function Visualizer with Differentiation

## Phase 1: Setup

- [X] T001 プロジェクトディレクトリ構造の作成 (src/, src/core/, src/graph/, src/ui/, src/test/, src/test/e2e/)
  - files: src/**

- [X] T002 index.html エントリーポイントの作成 (CDN script tags for math.js, function-plot, Vitest/Playwright config)
  - depends: [T001]
  - files: src/index.html

- [X] T003 tsconfig.json と package.json (Vitest, Playwright, TypeScript devDependencies) の作成
  - depends: [T001]
  - files: tsconfig.json, package.json

## Phase 2: Foundational

- [X] T004 共通型定義の作成 (ParsedFunction, Viewport, TooltipData interfaces) in src/core/types.ts
  - depends: [T002]
  - files: src/core/types.ts

- [X] T005 [P] styles.css ベーススタイルの作成 (CSS variables, layout grid, responsive breakpoints)
  - depends: [T002]
  - files: src/styles.css

- [X] T006 [P] error-display.ts エラーメッセージユーティリティの作成 (math.js exception → user-friendly message mapping)
  - depends: [T004]
  - files: src/ui/error-display.ts

## Phase 3: User Story 1 - Basic Function Graphing (P1)

**Story Goal**: 学生・教育者が標準記法で関数を入力し、即座にグラフを表示
**Independent Test**: "x^2" を入力し、放物線が軸ラベル付きで表示されることを確認

- [ ] T007 [US1] parser.ts - math.js ラッパー・式パース・バリデーション実装 (parse, validate functions)
  - depends: [T004]
  - files: src/core/parser.ts

- [ ] T008 [US1] evaluator.ts - 関数評価ロジック実装 (数値評価, ドメイン外値処理, adaptive sampling)
  - depends: [T007]
  - files: src/core/evaluator.ts

- [ ] T009 [US1] plotter.ts - function-plot ラッパー実装 (初期化, 複数関数登録, 色割り当て, 軸ラベル/グリッド線設定)
  - depends: [T008]
  - files: src/graph/plotter.ts

- [ ] T010 [US1] viewport.ts - オートスケール・パン/ズーム状態管理実装 (auto-scale calculation, manual pan/zoom state)
  - depends: [T009]
  - files: src/graph/viewport.ts

- [ ] T011 [US1] input.ts - 入力フィールド・デバウンス処理実装 (300ms debounce, Enter/blur immediate update)
  - depends: [T007, T009]
  - files: src/ui/input.ts

- [ ] T012 [US1] main.ts - アプリ初期化・イベントバインディング実装 (input → parser → plotter flow)
  - depends: [T009, T010, T011]
  - files: src/main.ts

- [ ] T013 [US1] parser.test.ts - パーサー単体テスト (有効/無効式, edge cases)
  - depends: [T007]
  - files: src/test/parser.test.ts

- [ ] T014 [US1] plotter.test.ts - プロッター単体テスト (複数関数表示, 色, グリッド線)
  - depends: [T009]
  - files: src/test/plotter.test.ts

## Phase 4: User Story 2 - Derivative Visualization (P1)

**Story Goal**: 微積分学生が関数と導関数の関係を理解するため、両方を比較表示
**Independent Test**: "x^3" を入力し、3次関数と導関数(3x^2)が異なる色で表示されることを確認

- [ ] T015 [US2] differentiator.ts - 記号微分エンジン実装 (math.js derivative API wrapper, derivative expression string generation)
  - depends: [T007]
  - files: src/core/differentiator.ts

- [ ] T016 [US2] plotter.ts 拡張 - 導関数グラフ重畳表示ロジック追加 (derivative rendering with distinct color, legend)
  - depends: [T015, T009]
  - files: src/graph/plotter.ts

- [ ] T017 [US2] tooltip.ts - カーソル追従ツールチップ実装 (mousemove event, x/f(x)/f'(x) calculation, display)
  - depends: [T008, T015]
  - files: src/graph/tooltip.ts

- [ ] T018 [US2] differentiator.test.ts - 微分エンジン単体テスト (x^3→3x^2, sin(x)→cos(x), chain rule)
  - depends: [T015]
  - files: src/test/differentiator.test.ts

## Phase 5: User Story 3 - Tangent Line Analysis (P2)

**Story Goal**: 学生が導関数が接線の傾きを表すことを視覚的に理解
**Independent Test**: f(x)=x^2 の x=1 で傾き2の接線が表示されることを確認

- [ ] T019 [US3] tangent.ts - 接線描画ロジック実装 (cursor position → f'(x) → tangent line y-intercept/slope calculation, line overlay)
  - depends: [T017]
  - files: src/graph/tangent.ts

- [ ] T020 [US3] main.ts 拡張 - tooltip/tangent イベント連携追加 (mousemove → tooltip.update + tangent.draw)
  - depends: [T019, T012]
  - files: src/main.ts

## Phase 6: User Story 4 - Preset Function Exploration (P2)

**Story Goal**: 初心者がプリセットボタンで素早く一般的な関数を探索
**Independent Test**: "sin(x)" プリセットボタンをクリックし、正弦波が表示されることを確認

- [X] T021 [US4] presets.ts - プリセットボタンクリック処理実装 (sin, cos, tan, log, exp, sqrt, abs buttons → input field population)
  - depends: [T011]
  - files: src/ui/presets.ts

- [X] T022 [US4] index.html 拡張 - プリセットボタンUI追加 (button elements for each preset function)
  - depends: [T021]
  - files: src/index.html

## Phase 7: User Story 5 - Responsive Multi-Device Access (P2)

**Story Goal**: 学生がデスクトップ/タブレット/スマートフォンでツールにアクセス
**Independent Test**: モバイル (width < 768px) でグラフが操作可能でラベルが読めることを確認

- [ ] T023 [US5] responsive.ts - レスポンシブレイアウト制御実装 (viewport detection, layout adjustment for 320px-2560px)
  - depends: [T010, T011]
  - files: src/ui/responsive.ts

- [ ] T024 [US5] styles.css 拡張 - レスポンシブメディアクエリ追加 (desktop ≥1024px, tablet 768-1023px, mobile <768px)
  - depends: [T005]
  - files: src/styles.css

## Phase 8: User Story 6 - Error Handling (P3)

**Story Goal**: ユーザーがタイプミスした際に明確なエラーフィードバックを受け取る
**Independent Test**: "sin((" (括弧不一致) を入力し、エラーメッセージが表示されることを確認

- [X] T025 [US6] parser.ts 拡張 - エラーバウンダリ・フォールバック実装 (try-catch, graceful empty state, domain error handling)
  - depends: [T007, T006]
  - files: src/core/parser.ts

- [X] T026 [US6] main.ts 拡張 - エラー表示連携追加 (parser error → error-display → UI message)
  - depends: [T025, T012]
  - files: src/main.ts

## Phase 9: Integration & Polish

- [X] T027 E2E テスト実装 - graph-interaction.spec.ts (Playwright: 入力→グラフ表示→ツールチップ→接線フロー)
  - depends: [T020, T026]
  - files: src/test/e2e/graph-interaction.spec.ts

- [X] T028 最終統合確認 - 全User Storyの動作確認 (US1-US6 acceptance scenarios)
  - depends: [T027]
  - files: src/**/*

---

**Files to be created/modified:**
- src/index.html
- src/main.ts
- src/styles.css
- src/core/types.ts
- src/core/parser.ts
- src/core/differentiator.ts
- src/core/evaluator.ts
- src/graph/plotter.ts
- src/graph/viewport.ts
- src/graph/tooltip.ts
- src/graph/tangent.ts
- src/ui/input.ts
- src/ui/presets.ts
- src/ui/error-display.ts
- src/ui/responsive.ts
- src/test/parser.test.ts
- src/test/differentiator.test.ts
- src/test/plotter.test.ts
- src/test/e2e/graph-interaction.spec.ts
- tsconfig.json
- package.json

**Unresolved items:** None

[PROGRESS: tasks complete]

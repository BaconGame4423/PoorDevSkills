
# Feature Specification: Interactive Function Visualizer with Differentiation

**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "微分機能付きインタラクティブ数学ツール「関数ビジュアライザー」を開発してください。要件: FR-001: インタラクティブ関数グラフ表示, FR-002: 数式入力フィールド, FR-003: リアルタイムグラフ更新, FR-004: 自動ズーム/スケール, FR-005: 軸ラベルとグリッド線, FR-006: 複数関数サポート (sin,cos,tan,log,exp,sqrt,abs), FR-007: 微分（導関数）の計算と表示, FR-008: 導関数のグラフ重畳表示, FR-009: カーソル追従ツールチップ (x, f(x), f'(x)), FR-010: 接線表示, FR-011: レスポンシブデザイン, FR-012: エラーハンドリング（不正入力）, FR-013: プリセット関数ボタン"

## User Scenarios & Testing

### User Story 1 - Basic Function Graphing (Priority: P1)

A student or educator wants to visualize a mathematical function by entering it in standard notation. They type a function expression and immediately see the graph rendered on a coordinate plane with proper axes and grid lines.

**Why this priority**: Core functionality - without graph display, no other features are usable.
**Independent Test**: Enter "x^2" and verify a parabola is displayed with labeled axes.

**Acceptance Scenarios**:
1. **Given** the application is loaded, **When** user enters "sin(x)" in the input field, **Then** a sine wave graph appears within 500ms with x and y axis labels visible.
2. **Given** a graph is displayed, **When** user modifies the expression to "cos(x)", **Then** the graph updates in real-time without requiring a submit button.

---

### User Story 2 - Derivative Visualization (Priority: P1)

A calculus student wants to understand the relationship between a function and its derivative. They want to see both plotted together to compare slopes and behaviors.

**Why this priority**: Core differentiator - this is the primary educational value proposition for learning differentiation.
**Independent Test**: Enter "x^3" and verify both the cubic function and its derivative (3x^2) are displayed with distinct colors.

**Acceptance Scenarios**:
1. **Given** a function "x^2" is displayed, **When** user enables derivative view, **Then** the derivative "2x" is calculated and overlaid on the same graph with a different color and a legend.
2. **Given** derivative is displayed, **When** user hovers over the graph, **Then** tooltip shows x, f(x), and f'(x) values at cursor position.

---

### User Story 3 - Tangent Line Analysis (Priority: P2)

A student wants to visualize how the derivative represents the slope of the tangent line at any point. They move their cursor and see a tangent line drawn at that point on the original function.

**Why this priority**: Enhances conceptual understanding of derivatives as instantaneous rate of change.
**Independent Test**: Hover over f(x)=x^2 at x=1 and verify a tangent line with slope 2 is displayed.

**Acceptance Scenarios**:
1. **Given** function and derivative are displayed, **When** user moves cursor over the graph, **Then** a tangent line at cursor position is drawn on the function curve.
2. **Given** cursor is at x=0 on f(x)=sin(x), **When** tangent line is displayed, **Then** the tangent line should be horizontal (slope=cos(0)=1, tangent value matches f'(0)).

---

### User Story 4 - Preset Function Exploration (Priority: P2)

A user wants to quickly explore common mathematical functions without manually typing expressions. They click preset buttons for standard functions.

**Why this priority**: Lowers barrier to entry for beginners; enables quick exploration and comparison.
**Independent Test**: Click "sin(x)" preset button and verify the sine wave is displayed.

**Acceptance Scenarios**:
1. **Given** the application is loaded, **When** user clicks the "exp(x)" preset button, **Then** the input field is populated with "exp(x)" and the exponential graph is displayed.
2. **Given** preset buttons are visible, **Then** at minimum the following presets are available: sin(x), cos(x), tan(x), log(x), exp(x), sqrt(x), abs(x).

---

### User Story 5 - Responsive Multi-Device Access (Priority: P2)

A student accesses the tool on various devices (desktop, tablet, smartphone). The interface adapts to screen size while maintaining functionality.

**Why this priority**: Accessibility and convenience - users may study on any device.
**Independent Test**: Open the app on a mobile device (width < 768px) and verify the graph remains interactive with readable labels.

**Acceptance Scenarios**:
1. **Given** the application is accessed on a mobile device, **When** the viewport width is 375px, **Then** all core features (input, graph, tooltip, presets) remain accessible without horizontal scroll.
2. **Given** the application is accessed on desktop, **When** the viewport width is 1920px, **Then** the graph utilizes available space efficiently with readable axis labels.

---

### User Story 6 - Error Handling for Invalid Input (Priority: P3)

A user makes a typo or enters an invalid mathematical expression. They receive clear feedback about the error.

**Why this priority**: Prevents frustration and guides users to correct input; not blocking for valid users.
**Independent Test**: Enter "sin((" (unbalanced parenthesis) and verify an error message is displayed.

**Acceptance Scenarios**:
1. **Given** the input field is empty, **When** user has not entered anything, **Then** no graph is displayed and no error is shown (graceful empty state).
2. **Given** user types "log(-x)", **When** expression is evaluated, **Then** an appropriate error message "Function undefined for given domain" is shown without crashing the application.

---

### Edge Cases
- What happens when the function has no real values in the visible domain (e.g., log(x) for x ≤ 0)?
- How does the system handle asymptotically growing functions (e.g., exp(x^2)) without breaking auto-scale?
- What happens when a function is undefined at isolated points (e.g., tan(x) at x=π/2)?
- How does the tooltip behave when cursor is outside the function's domain?

## Requirements

### Functional Requirements
- **FR-001**: System MUST render an interactive coordinate plane with graph visualization
- **FR-002**: System MUST provide a text input field for entering mathematical expressions
- **FR-003**: System MUST update the graph in real-time as the user types (debounced, within 300ms)
- **FR-004**: System MUST automatically adjust zoom and scale to fit the function's interesting regions
- **FR-005**: System MUST display axis labels (x, y values) and grid lines on the coordinate plane
- **FR-006**: System MUST support the following functions: sin, cos, tan, log, exp, sqrt, abs, and standard arithmetic operations
- **FR-007**: System MUST compute the first derivative of the entered function symbolically or numerically
- **FR-008**: System MUST overlay the derivative graph on the same coordinate plane with visual distinction (color/style)
- **FR-009**: System MUST display a tooltip following the cursor showing x, f(x), and f'(x) values
- **FR-010**: System MUST draw a tangent line at the cursor position on the original function
- **FR-011**: System MUST adapt layout responsively for desktop (≥1024px), tablet (768-1023px), and mobile (<768px)
- **FR-012**: System MUST validate input and display user-friendly error messages for invalid expressions
- **FR-013**: System MUST provide clickable preset buttons for common functions (sin, cos, tan, log, exp, sqrt, abs)

### Key Entities (if data involved)
- **Function Expression**: User-provided mathematical formula (string representation, validated syntax)
- **Graph State**: Current viewport bounds (x-min, x-max, y-min, y-max), zoom level, function points
- **Derivative**: Computed derivative expression and its sampled points (linked to original function)
- **Tooltip Data**: x-coordinate, f(x) value, f'(x) value at cursor position (real-time computed)

## Success Criteria

### Measurable Outcomes
- **SC-001**: Graph renders within 500ms of valid input submission (perceived as real-time)
- **SC-002**: Tooltip updates within 50ms of cursor movement (smooth tracking)
- **SC-003**: Auto-scale algorithm produces a view where the function's main features occupy 60-80% of visible area
- **SC-004**: 90% of user-entered valid expressions are parsed correctly on first attempt
- **SC-005**: Error messages are clear enough that users can correct input within 2 attempts
- **SC-006**: Application functions correctly on viewport widths from 320px to 2560px

---

[NEEDS CLARIFICATION: Should multiple functions be displayable simultaneously (e.g., compare sin(x) and cos(x) on same graph), or is it single-function focus only?]
[NEEDS CLARIFICATION: Should users be able to manually pan/zoom the graph via mouse drag or scroll, or is auto-scale sufficient?]
[NEEDS CLARIFICATION: Is the derivative computed symbolically (exact formula) or numerically (approximation), and is the formula itself displayed to the user?]

## Clarifications

### 2026-02-17

**Questions:**

  1. Should multiple functions be displayable simultaneously (e.g., compare sin(x) and cos(x) on same graph), or is it single-function focus only?
  2. Should users be able to manually pan/zoom the graph via mouse drag or scroll, or is auto-scale sufficient?
  3. Is the derivative computed symbolically (exact formula) or numerically (approximation), and is the formula itself displayed to the user?

**Answers:**

1. 複数同時表示: はい、複数の関数を同時に表示し、比較できるようにする
2. 手動パン/ズーム: はい、マウスドラッグ・スクロールでパン/ズーム可能、自動スケールも併用
3. 微分計算: 記号的微分で正確な公式を計算・表示する


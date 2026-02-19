# Contracts: 共有型定義

lib/ bash スクリプト群の TS 移行における共通型定義。
各トレースドキュメントは `[CONTRACT]` マーカーで本ファイルの型を参照する。

---

## 1. PipelineState

`pipeline-state.sh` が管理する `pipeline-state.json` の構造。

```typescript
interface PipelineState {
  flow: string;                          // "feature" | "bugfix" | "roadmap" | "discovery-init" | "discovery-rebuild" | "investigation"
  variant: string | null;                // "bugfix-small" | "bugfix-large" | "discovery-rebuild" | "discovery-continue" | null
  pipeline: string[];                    // 全ステップ名の配列 (例: ["specify","suggest","plan",...])
  completed: string[];                   // 完了済みステップ名 (unique)
  current: string | null;               // 次に実行すべきステップ (pipeline 中の未完了先頭。全完了時 null)
  status: PipelineStatus;
  pauseReason: string | null;           // status が "paused"|"awaiting-approval"|"rate-limited" 時の理由
  condition: Record<string, unknown> | null;  // set-variant で設定される条件 JSON
  pendingApproval: PendingApproval | null;
  updated: string;                       // ISO 8601 UTC (例: "2026-02-19T12:00:00Z")
  // Optional fields (pipeline-runner が追加)
  implement_phases_completed?: string[]; // ["phase_1", "phase_2", ...]
  retries?: RetryRecord[];
}

type PipelineStatus = "active" | "completed" | "paused" | "awaiting-approval" | "rate-limited";

interface PendingApproval {
  type: "clarification" | "gate";
  step: string;
}

interface RetryRecord {
  step: string;
  attempt: number;
  exit_code: number;
  backoff: number;
  ts: string;  // ISO 8601
}
```

### サブコマンド入出力

| サブコマンド | 引数 | 出力 (stdout JSON) | 副作用 |
|---|---|---|---|
| `read` | — | 現在の state (無ければ `{}`) | なし |
| `init` | `<flow> <pipeline_steps_json>` | 新規 state | ファイル作成 |
| `complete-step` | `<step>` | 更新後 state | completed に追加、current を次に進める |
| `set-status` | `<status> [reason]` | 更新後 state | status + pauseReason 更新 |
| `set-variant` | `<variant> <condition_json>` | 更新後 state | variant + condition 更新 |
| `set-approval` | `<type> <step>` | 更新後 state | status→awaiting-approval, pendingApproval 設定 |
| `clear-approval` | — | 更新後 state | status→active, pendingApproval→null |
| `set-pipeline` | `<pipeline_steps_json>` | 更新後 state | pipeline 置換、current を再計算 |

---

## 2. ReviewSetupResult

`review-setup.sh` の stdout JSON。`review-runner.sh` が消費する。

```typescript
interface ReviewSetupResult {
  depth: "light" | "standard" | "deep";
  max_iterations: number;               // 2 | 3 | 5
  next_id: number;                       // 次に割り当てる Issue ID の数値部分
  log_path: string;                      // review-log-{type}.yaml の絶対パス
  id_prefix: string;                     // "PR" | "TR" | "AR" | "QR" | "PH" | "RV"
  review_type: string;                   // "planreview" | "tasksreview" | ...
  personas: PersonaConfig[];
  fixer: FixerConfig;
}

interface PersonaConfig {
  name: string;                          // "planreview-pm", "qualityreview-code", etc.
  cli: string;                           // "claude" | "opencode"
  model: string;                         // "sonnet" | "opus" | etc.
  agent_name: string;                    // = name (現在は同一)
}

interface FixerConfig {
  cli: string;
  model: string;
  agent_name: string;                    // 常に "review-fixer"
}
```

### Review Type → Personas マッピング

| review_type | personas | id_prefix |
|---|---|---|
| planreview | planreview-pm, planreview-critical, planreview-risk, planreview-value | PR |
| tasksreview | tasksreview-junior, tasksreview-senior, tasksreview-techlead, tasksreview-devops | TR |
| architecturereview | architecturereview-architect, architecturereview-performance, architecturereview-security, architecturereview-sre | AR |
| qualityreview | qualityreview-code, qualityreview-qa, qualityreview-security, qualityreview-testdesign | QR |
| phasereview | phasereview-qa, phasereview-ux, phasereview-regression, phasereview-docs | PH |

### Review Depth 決定ロジック

| 条件 | depth | max_iterations |
|---|---|---|
| total_changes > 500 OR files > 20 | deep | 5 |
| total_changes < 50 AND files < 5 | light | 2 |
| それ以外 | standard | 3 |
| config.review_depth != "auto" | config 値 | 上記対応 |

---

## 3. AggregateResult

`review-aggregate.sh` の stdout JSON。`review-runner.sh` が消費する。

```typescript
interface AggregateResult {
  total: number;
  C: number;                             // Critical
  H: number;                             // High
  M: number;                             // Medium
  L: number;                             // Low
  next_id: number;                       // 次に使用する Issue ID 番号
  issues_file: string;                   // issues ファイルの絶対パス
  converged: boolean;                    // C == 0 && H == 0
  verdicts: string;                      // "persona1:GO persona2:CONDITIONAL ..."
}
```

### Issue ファイルフォーマット (pipe-delimited)

```
{ID}|{SEVERITY}|{DESCRIPTION}|{LOCATION}|{PERSONA_NAME}
```

例:
```
QR001|C|SQL injection vulnerability|src/api/users.ts:42|qualityreview-security
QR002|H|Missing input validation|src/forms/login.tsx:15|qualityreview-code
```

### Persona 出力フォーマット (入力)

```
VERDICT: GO|CONDITIONAL|NO-GO
ISSUE: C|H|M|L | description | location
```

### 重複排除ルール

1. **Fixed-issue dedup**: review-log.yaml の `fixed:` ブロックに記録された ID をスキップ
   - [BUG] 現在は ID ベースのみ。location ベース比較は未実装（同一箇所の新規 issue が別 ID で再登録される）
2. **Cross-persona dedup**: 同一 iteration 内で location が完全一致する issue をスキップ

---

## 4. ReviewLogEntry

`review-log-update.sh` が `review-log-{type}.yaml` に追記する YAML 構造。

```typescript
interface ReviewLog {
  created: string;                       // ISO 8601
  iterations: ReviewLogIteration[];
}

interface ReviewLogIteration {
  iteration: number;
  timestamp: string;                     // ISO 8601
  verdicts: string;                      // "persona1:GO persona2:NO-GO ..."
  issues: ReviewLogIssue[];
  fixed?: string[];                      // 前回 iteration で fix された Issue ID リスト
}

interface ReviewLogIssue {
  id: string;                            // "QR001"
  severity: string;                      // "C" | "H" | "M" | "L"
  description: string;
  location: string;
  persona: string;
}
```

### YAML 出力例

```yaml
# Review Log
# Auto-generated by review-runner.sh
created: 2026-02-19T12:00:00Z
iterations:

  - iteration: 1
    timestamp: 2026-02-19T12:05:00Z
    verdicts: "qualityreview-code:CONDITIONAL qualityreview-qa:GO"
    issues:
      - id: QR001
        severity: C
        description: "SQL injection vulnerability"
        location: "src/api/users.ts:42"
        persona: qualityreview-security
    fixed:
      - QR000
```

---

## 5. ファイル間呼び出しマップ

```
pipeline-runner.sh
  ├── source retry-helpers.sh
  │     └── dispatch-step.sh (bash 呼び出し)
  │           └── poll-dispatch.sh (bash 呼び出し)
  ├── pipeline-state.sh (bash 呼び出し × 15+ 箇所)
  ├── compose-prompt.sh (bash 呼び出し)
  ├── review-runner.sh (bash 呼び出し, review_mode=bash 時)
  │     ├── source utils.sh
  │     ├── source retry-helpers.sh
  │     ├── review-setup.sh (bash 呼び出し)
  │     │     ├── source utils.sh
  │     │     └── config-resolver.sh (bash 呼び出し)
  │     ├── compose-prompt.sh (bash 呼び出し)
  │     ├── review-aggregate.sh (bash 呼び出し)
  │     │     └── source utils.sh
  │     └── review-log-update.sh (bash 呼び出し)
  │           └── source utils.sh
  ├── extract-output.sh (bash 呼び出し)
  └── tasks-validate.sh (bash 呼び出し)

intake-and-specify.sh
  └── pipeline-state.sh (bash 呼び出し × 4)

resume-pipeline.sh
  └── pipeline-state.sh (bash 呼び出し × 1)

apply-clarifications.sh
  └── pipeline-state.sh (bash 呼び出し × 1)
```

### [KEEP-BASH] 境界

TS 移行対象外（bash のまま残す）:
- `dispatch-step.sh` — CLI ラッパー (opencode run / claude -p)
- `poll-dispatch.sh` — プロセス監視
- `compose-prompt.sh` — プロンプト構築
- `utils.sh` — 未移行スクリプトが source
- `config-resolver.sh` — CLI/model 解決
- `branch-setup.sh` — ブランチ操作
- `intake.sh`, `intake-and-specify.sh`, `resume-pipeline.sh`, `apply-clarifications.sh` — グルーコード
- `extract-output.sh` — 出力抽出
- `tasks-validate.sh` — タスク検証

### TS 移行後の呼び出しパターン

TS 移行後、bash ラッパー経由で互換性を維持:
```
intake-and-specify.sh → bash lib/pipeline-state.sh → exec node dist/pipeline-state.js
```
pipeline-runner.ts 内部では直接 import:
```typescript
import { completeStep } from './pipeline-state.js';
```

---

## 6. 設定ファイル構造

`review-runner.sh` と `pipeline-runner.sh` が参照する `.poor-dev/config.json`:

```typescript
interface PoorDevConfig {
  // CLI/model 設定
  command_variant?: string;              // コマンドファイルのバリアント名

  // ポーリング設定
  polling?: {
    idle_timeout?: number;               // デフォルト: 120
    max_timeout?: number;                // デフォルト: 600 (pipeline), 300 (review)
    step_timeouts?: Record<string, {
      idle_timeout?: number;
      max_timeout?: number;
    }>;
  };

  // レビュー設定
  review_mode?: "llm" | "bash";          // デフォルト: "llm"
  review_depth?: "auto" | "light" | "standard" | "deep";

  // リトライ設定
  retry?: {
    enabled?: boolean;                   // デフォルト: true
    max_retries?: number;                // 0-10, デフォルト: 2
    backoff_seconds?: number;            // 5-300, デフォルト: 30
  };

  // パイプライン制御
  auto_approve?: boolean;               // デフォルト: false
  gates?: Record<string, boolean>;       // "after-specify": true, etc.
}
```

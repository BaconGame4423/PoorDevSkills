/**
 * PoorDev TypeScript 型定義
 *
 * pipeline-state.json スキーマ + 関連型
 * code-trace.md §5-1 のスキーマに基づく
 */

// --- pipeline-state.json ---

export type PipelineStatus =
  | "active"
  | "awaiting-approval"
  | "paused"
  | "completed"
  | "rate-limited";

export type PipelineFlow =
  | "feature"
  | "bugfix"
  | "roadmap"
  | "discovery-init"
  | "discovery-rebuild"
  | "investigation";

export interface PendingApproval {
  type: string;
  step: string;
}

export interface RetryRecord {
  step: string;
  attempt: number;
  exit_code: number;
  backoff: number;
  ts: string;
}

/**
 * pipeline-state.json の完全なスキーマ。
 *
 * 注意: `implement_phases_completed` と `retries` は init サブコマンドでは生成されない。
 * それぞれ update_implement_phase_state() / log_retry_attempt() が直接書き込む動的フィールド。
 * code-trace.md §5-1 参照。
 */
export interface PipelineState {
  flow: string;
  variant: string | null;
  pipeline: string[];
  completed: string[];
  current: string | null;
  status: PipelineStatus;
  pauseReason: string | null;
  condition: unknown | null;
  pendingApproval: PendingApproval | null;
  updated: string;
  // 動的追加フィールド（init スキーマ外）
  implement_phases_completed?: string[];
  retries?: RetryRecord[];
}

// --- フェーズ分割 ---

/** parse_tasks_phases() の出力行に対応 */
export interface TaskPhase {
  phaseNum: number;
  phaseName: string;
  startLine: number;
  endLine: number;
}

/** dispatch_implement_phases() の実行結果 */
export type PhaseResult =
  | { status: "skipped"; phaseNum: number; reason: string }
  | { status: "success"; phaseNum: number; committedFiles: string[] }
  | { status: "failed"; phaseNum: number; exitCode: number }
  | { status: "rate-limited"; phaseNum: number };

// --- レビュー ---

export type ReviewVerdict = "GO" | "CONDITIONAL" | "NO-GO";

export type ReviewExitCode = 0 | 1 | 2 | 3;

/** review-runner.sh の終了結果 */
export interface ReviewResult {
  verdict: ReviewVerdict;
  iterations: number;
  converged: boolean;
  exitCode: ReviewExitCode;
}

// --- ディスパッチ設定 ---

export interface RetryConfig {
  enabled: boolean;
  max_retries: number;
  backoff_seconds: number;
}

export interface StepTimeouts {
  idle_timeout: number;
  max_timeout: number;
}

export interface PoorDevConfig {
  polling: {
    idle_timeout: number;
    max_timeout: number;
    step_timeouts?: Record<string, StepTimeouts>;
  };
  retry?: Partial<RetryConfig>;
  command_variant?: string;
  review_mode?: "llm" | "bash";
  review_depth?: "auto" | "deep" | "standard" | "light";
  parallel?:
    | "on"
    | "off"
    | "auto"
    | "same-branch"
    | "worktree"
    | "phase-split";
  gates?: Record<string, boolean>;
  auto_approve?: boolean;
}

/**
 * bench-team 共通型定義
 *
 * BenchConfig, Phase0Response, MonitorResult 等
 */

// --- Phase 0 応答マニュアル ---

export interface Phase0ResponseEntry {
  pattern: string;
  response: string;
}

export interface Phase0Config {
  flow_type: string;
  discussion_context: {
    task_ref: string;
    scope: string;
  };
  responses: Phase0ResponseEntry[];
  max_turns: number;
  fallback: string;
}

// --- ベンチマーク設定 ---

export interface BenchCombo {
  dir_name: string;
  orchestrator: string;
  sub_agent: string;
  mode?: string;
  dispatch_mode?: "bash";
  step_overrides?: Record<string, string>;
}

export interface BenchModel {
  display_name: string;
  cli: string;
  model_id: string;
  fallback_model?: string;
  config_extras?: Record<string, unknown>;
}

export interface BenchConfig {
  task: {
    name: string;
    description: string;
    requirements: Array<{ id: string; name: string }>;
    process_stages: string[];
  };
  models: Record<string, BenchModel>;
  combinations: BenchCombo[];
}

// --- 監視結果 ---

export type MonitorExitReason =
  | "pipeline_complete"
  | "tui_idle"
  | "pane_lost"
  | "pipeline_error"
  | "timeout"
  | "phase0_max_turns";

export interface TokenUsage {
  orchestrator_cost_usd: number;
  worker_turns: number;
  worker_total_duration_ms: number;
}

export interface MonitorResult {
  exitReason: MonitorExitReason;
  elapsedSeconds: number;
  combo: string;
  logs: string[];
  tokenUsage?: TokenUsage;
}

// --- 監視設定 ---

export interface MonitorOptions {
  combo: string;
  targetPane: string;
  comboDir: string;
  phase0ConfigPath: string;
  timeoutSeconds: number;
  projectRoot: string;
  postCommand?: string;
}

// --- tmux ラッパー型 ---

export interface TmuxCapture {
  content: string;
  timestamp: number;
}

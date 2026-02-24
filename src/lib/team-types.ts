/**
 * team-types.ts
 *
 * Bash Dispatch パスで使用するアクション型。
 * computeNextInstruction() の戻り値型。
 * poor-dev-next CLI の出力 JSON スキーマ。
 */

// --- TeamAction (computeNextInstruction 戻り値) ---

export type TeamAction =
  | BashDispatchAction
  | BashReviewDispatchAction
  | BashParallelDispatchAction
  | UserGateAction
  | DoneAction;

/** アクション共通メタデータ */
export interface ActionMeta {
  recovery_hint: string;
  step_complete_cmd?: string;
}

/** Worker ステップの Bash dispatch */
export interface BashDispatchAction {
  action: "bash_dispatch";
  step: string;
  /** dispatch-worker.js の完全実行コマンド。Opus はこれをそのまま Bash 実行する */
  command: string;
  worker: {
    role: string;
    agentFile: string;
    tools: string;
    maxTurns: number;
  };
  prompt: string;
  artifacts: string[];
  _meta?: ActionMeta;
}

/** レビューステップの Bash dispatch */
export interface BashReviewDispatchAction {
  action: "bash_review_dispatch";
  step: string;
  /** reviewer の dispatch-worker.js 完全実行コマンド */
  reviewerCommand: string;
  /** fixer の dispatch-worker.js コマンドプレフィックス（--prompt-file を除く）。Opus は --prompt-file <path> を追加するだけ */
  fixerCommandPrefix: string;
  reviewer: {
    role: string;
    agentFile: string;
    tools: string;
    maxTurns: number;
  };
  fixer: {
    role: string;
    agentFile: string;
    tools: string;
    maxTurns: number;
  };
  reviewPrompt: string;
  fixerBasePrompt: string;
  targetFiles: string[];
  maxIterations: number;
  _meta?: ActionMeta;
}

/** 並列ステップの Bash dispatch */
export interface BashParallelDispatchAction {
  action: "bash_parallel_dispatch";
  steps: (BashDispatchAction | BashReviewDispatchAction)[];
  _meta?: ActionMeta;
}

/** ユーザー確認ゲート */
export interface UserGateAction {
  action: "user_gate";
  step: string;
  message: string;
  options?: string[];
  /** userGates: conditionalKey へのマッピング付き選択肢 */
  gateOptions?: { label: string; conditionalKey: string }[];
}

/** パイプライン完了 */
export interface DoneAction {
  action: "done";
  summary: string;
  artifacts: string[];
}

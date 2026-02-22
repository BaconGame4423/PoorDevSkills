/**
 * team-types.ts
 *
 * Agent Teams パスで使用するアクション型。
 * computeNextInstruction() の戻り値型。
 * poor-dev-next CLI の出力 JSON スキーマ。
 */

// --- Teammate / Task スペック ---

export interface TeammateSpec {
  role: string;
  agentFile: string;
  agentType?: string;
  writeAccess: boolean;
}

export interface TaskSpec {
  subject: string;
  description: string;
  assignTo: string;
}

// --- TeamAction (computeNextInstruction 戻り値) ---

export type TeamAction =
  | CreateTeamAction
  | CreateReviewTeamAction
  | BashDispatchAction
  | BashReviewDispatchAction
  | UserGateAction
  | DoneAction;

/** アクション共通メタデータ */
export interface ActionMeta {
  recovery_hint: string;
  step_complete_cmd?: string;
}

/** Worker チーム作成 */
export interface CreateTeamAction {
  action: "create_team";
  step: string;
  team_name: string;
  teammates: TeammateSpec[];
  tasks: TaskSpec[];
  artifacts: string[];
  _meta?: ActionMeta;
}

/** レビューチーム作成 (review-loop / parallel-review) */
export interface CreateReviewTeamAction {
  action: "create_review_team";
  step: string;
  team_name: string;
  reviewers: TeammateSpec[];
  fixers: TeammateSpec[];
  target_files: string[];
  max_iterations: number;
  communication: "direct" | "opus-mediated";
  tasks: TaskSpec[];
  _meta?: ActionMeta;
}

/** Worker ステップの Bash dispatch */
export interface BashDispatchAction {
  action: "bash_dispatch";
  step: string;
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

/** ユーザー確認ゲート */
export interface UserGateAction {
  action: "user_gate";
  step: string;
  message: string;
  options?: string[];
}

/** パイプライン完了 */
export interface DoneAction {
  action: "done";
  summary: string;
  artifacts: string[];
}

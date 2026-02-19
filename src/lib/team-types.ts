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
  | DispatchStepAction
  | UserGateAction
  | DoneAction;

/** Worker チーム作成 */
export interface CreateTeamAction {
  action: "create_team";
  step: string;
  team_name: string;
  teammates: TeammateSpec[];
  tasks: TaskSpec[];
  artifacts: string[];
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
}

/** レガシーパス用ディスパッチ (poor-dev.pipeline からのみ使用) */
export interface DispatchStepAction {
  action: "dispatch_step";
  step: string;
  commandFile: string;
  contextFiles: Record<string, string>;
  isReview: boolean;
  isConditional: boolean;
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

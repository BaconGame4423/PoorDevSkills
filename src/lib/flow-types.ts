/**
 * flow-types.ts
 *
 * FlowDefinition 統一型定義。
 * ビルトインフロー・カスタムフローの両方を同一型で表現。
 * JSON シリアライズ可能。Issue #3/#4 解決の中核。
 */

// --- フロー定義 ---

/** 統一フロー定義。JSON シリアライズ可能。 */
export interface FlowDefinition {
  /** フローの説明（UI 表示用、任意） */
  description?: string;
  // --- Issue #3/#4 コア ---
  /** ステップ名の順序リスト */
  steps: string[];
  /** レビューステップ（REVIEW_STEPS 置換） */
  reviews?: string[];
  /** 条件分岐ステップ（CONDITIONAL_STEPS 置換） */
  conditionals?: string[];
  /** step → {key: relativeFilename}（contextArgsForStep 置換） */
  context?: Record<string, Record<string, string>>;
  /** step → {key: true} — true のコンテキストは Opus が pre-inject、それ以外は worker が self-read */
  contextInject?: Record<string, Record<string, boolean>>;
  /** step → required files（checkPrerequisites 置換） */
  prerequisites?: Record<string, string[]>;
  /** step → output filename */
  artifacts?: Record<string, string | string[]>;
  /** step → prompt headers */
  headers?: Record<string, string[]>;
  /** review step → target path pattern */
  reviewTargets?: Record<string, string>;
  /** review step → PERSONA_MAP key */
  reviewPersonaGroups?: Record<string, string>;

  // --- Agent Teams 拡張 ---
  /** Phase 0 でユーザー議論するステップ */
  discussionSteps?: string[];
  /** step → チーム構成 */
  teamConfig?: Record<string, StepTeamConfig>;
  /** "step:OUTCOME" → 分岐定義 */
  conditionalBranches?: Record<string, ConditionalBranch>;
  /** step → ユーザー選択ゲート（conditionals とは排他） */
  userGates?: Record<string, UserGateDefinition>;
}

// --- User Gate 型 ---

/** ステップ完了後にユーザーに提示する選択肢ゲート */
export interface UserGateDefinition {
  message: string;
  options: UserGateOption[];
}

export interface UserGateOption {
  label: string;
  conditionalKey: string;
}

// --- Agent Teams 型 ---

export interface StepTeamConfig {
  /** team=worker spawn, review-loop=単一reviewer+fixer, parallel-review=複数reviewer+fixer */
  type: "team" | "review-loop" | "parallel-review";
  teammates?: TeammateRole[];
  maxReviewIterations?: number;
  /** デフォルト: "opus-mediated"（GLM5 リスク対策） */
  reviewCommunication?: "direct" | "opus-mediated";
}

export interface TeammateRole {
  /** agent file name (e.g. "worker-specify") */
  role: string;
  /** Task tool の subagent_type */
  agentType?: string;
  /** default: true（reviewer は false） */
  writeAccess?: boolean;
  /** per-step maxTurns override */
  maxTurns?: number;
}

export interface ConditionalBranch {
  /** 出力マッチ正規表現 */
  pattern: string;
  action: "replace-pipeline" | "pause" | "continue";
  /** replace-pipeline 時の置換ステップ */
  pipeline?: string[];
  variant?: string;
  pauseReason?: string;
}

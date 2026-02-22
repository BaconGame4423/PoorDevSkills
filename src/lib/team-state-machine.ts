/**
 * team-state-machine.ts
 *
 * computeNextInstruction: FlowDefinition + PipelineState から次のアクションを決定。
 * 冪等: 同じ state + flowDef → 同じ結果。
 * 汎用: フロー名ハードコードなし。
 */

import path from "node:path";

import type { FlowDefinition, StepTeamConfig } from "./flow-types.js";
import type { PipelineState } from "./types.js";
import type { FileSystem } from "./interfaces.js";
import type {
  TeamAction,
  TeammateSpec,
  TaskSpec,
  ActionMeta,
  BashDispatchAction,
  BashReviewDispatchAction,
} from "./team-types.js";
import {
  buildTeamName,
  buildTeammateSpec,
  buildWorkerTask,
  buildReviewTask,
  buildBashDispatchPrompt,
  buildBashReviewPrompt,
  buildBashFixerBasePrompt,
} from "./team-instruction.js";

// --- コア関数 ---

export interface ComputeContext {
  state: PipelineState;
  featureDir: string;
  projectDir: string;
  flowDef: FlowDefinition;
  /** true: glm -p による Bash dispatch モード */
  bashDispatch?: boolean;
}

/**
 * 次に実行すべきアクションを計算する。
 *
 * - 冪等: 同じ ctx → 同じ結果
 * - 汎用: FlowDefinition のフィールドのみ参照
 */
export function computeNextInstruction(
  ctx: ComputeContext,
  fs: Pick<FileSystem, "exists" | "readFile">
): TeamAction {
  const { state, featureDir, projectDir, flowDef } = ctx;

  // status ガード: paused / awaiting-approval / completed では次ステップに進まない
  if (state.status === "paused") {
    return {
      action: "user_gate",
      step: state.current ?? "unknown",
      message: state.pauseReason ?? "Pipeline paused",
      options: ["resume", "abort"],
    };
  }
  if (state.status === "awaiting-approval") {
    return {
      action: "user_gate",
      step: state.pendingApproval?.step ?? "unknown",
      message: `Awaiting ${state.pendingApproval?.type ?? "unknown"} approval`,
      options: ["approve", "reject"],
    };
  }
  if (state.status === "completed") {
    return {
      action: "done",
      summary: `Flow "${state.flow}" already completed.`,
      artifacts: [],
    };
  }

  const fd = path.join(projectDir, featureDir);
  const completedSet = new Set(state.completed ?? []);
  const pipeline = state.pipeline?.length > 0 ? state.pipeline : flowDef.steps;

  // 次の未完了ステップを探す
  const nextStep = pipeline.find((s) => !completedSet.has(s));

  // 全ステップ完了
  if (!nextStep) {
    const artifactFiles = collectArtifacts(fd, flowDef, fs);
    return {
      action: "done",
      summary: `Flow "${state.flow}" completed. ${completedSet.size} steps done.`,
      artifacts: artifactFiles,
    };
  }

  // 前提チェック
  const prereqError = checkPrerequisites(nextStep, fd, flowDef, fs);
  if (prereqError) {
    return {
      action: "user_gate",
      step: nextStep,
      message: prereqError,
      options: ["retry", "skip", "abort"],
    };
  }

  // teamConfig チェック
  const teamConfig = flowDef.teamConfig?.[nextStep];
  if (!teamConfig) {
    return {
      action: "user_gate",
      step: nextStep,
      message: `Step "${nextStep}" has no teamConfig. Cannot proceed.`,
      options: ["skip", "abort"],
    };
  }

  const meta: ActionMeta = {
    recovery_hint: `Resume: node .poor-dev/dist/bin/poor-dev-next.js --state-dir ${featureDir} --project-dir ${projectDir}`,
    step_complete_cmd: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete ${nextStep} --state-dir ${featureDir} --project-dir ${projectDir}`,
  };

  // Bash dispatch モード
  if (ctx.bashDispatch) {
    const action = buildBashDispatchTeamAction(nextStep, teamConfig, fd, featureDir, flowDef, fs);
    action._meta = meta;
    return action;
  }

  // Agent Teams モード (デフォルト)
  const action = buildTeamAction(nextStep, teamConfig, fd, featureDir, flowDef, fs);
  if (action.action === "create_team" || action.action === "create_review_team") {
    action._meta = meta;
  }

  return action;
}

// --- 内部ヘルパー ---

function checkPrerequisites(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): string | null {
  const required = flowDef.prerequisites?.[step];
  if (!required || required.length === 0) return null;

  const missing = required.filter((f) => !fs.exists(path.join(fd, f)));
  if (missing.length === 0) return null;

  return `Missing prerequisites for "${step}": ${missing.join(", ")}`;
}

function collectArtifacts(
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): string[] {
  if (!flowDef.artifacts) return [];
  const files: string[] = [];
  for (const value of Object.values(flowDef.artifacts)) {
    if (value === "*") {
      // Sentinel: feature dir itself (implement step)
      files.push(fd);
      continue;
    }
    const filenames = Array.isArray(value) ? value : [value];
    for (const filename of filenames) {
      const fullPath = path.join(fd, filename);
      if (fs.exists(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function buildTeamAction(
  step: string,
  teamConfig: StepTeamConfig,
  fd: string,
  featureDir: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): TeamAction {
  const teamName = buildTeamName(step, featureDir);

  switch (teamConfig.type) {
    case "team": {
      const teammates: TeammateSpec[] = (teamConfig.teammates ?? []).map((t) =>
        buildTeammateSpec(t)
      );
      const tasks: TaskSpec[] = teammates.map((t) =>
        buildWorkerTask(step, t, fd, flowDef, fs)
      );
      const artifactDef = flowDef.artifacts?.[step];
      const artifacts: string[] = !artifactDef
        ? []
        : artifactDef === "*"
          ? ["*"]
          : Array.isArray(artifactDef)
            ? artifactDef.map((f) => path.join(fd, f))
            : [path.join(fd, artifactDef)];
      return {
        action: "create_team",
        step,
        team_name: teamName,
        teammates,
        tasks,
        artifacts,
      };
    }

    case "review-loop":
    case "parallel-review": {
      const reviewers: TeammateSpec[] = [];
      const fixers: TeammateSpec[] = [];
      for (const t of teamConfig.teammates ?? []) {
        const spec = buildTeammateSpec(t);
        if (t.writeAccess === false) {
          reviewers.push(spec);
        } else {
          fixers.push(spec);
        }
      }

      const targetFiles = collectReviewTargets(step, fd, flowDef, fs);
      const allSpecs = [...reviewers, ...fixers];
      const tasks: TaskSpec[] = allSpecs.map((t) =>
        buildReviewTask(step, t, fd, targetFiles, flowDef, fs)
      );

      return {
        action: "create_review_team",
        step,
        team_name: teamName,
        reviewers,
        fixers,
        target_files: targetFiles,
        max_iterations: teamConfig.maxReviewIterations ?? 12,
        communication: teamConfig.reviewCommunication ?? "opus-mediated",
        tasks,
      };
    }
  }
}

function buildBashDispatchTeamAction(
  step: string,
  teamConfig: StepTeamConfig,
  fd: string,
  featureDir: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): BashDispatchAction | BashReviewDispatchAction {
  const WORKER_TOOLS = "Read,Write,Edit,Bash,Grep,Glob";
  const REVIEWER_TOOLS = "Read,Glob,Grep";

  switch (teamConfig.type) {
    case "team": {
      const teammate = (teamConfig.teammates ?? [])[0];
      const role = teammate?.role ?? `worker-${step}`;
      const agentFile = `agents/claude/${role}.md`;
      const prompt = buildBashDispatchPrompt(step, fd, flowDef, fs);

      const artifactDef = flowDef.artifacts?.[step];
      const artifacts: string[] = !artifactDef
        ? []
        : artifactDef === "*"
          ? ["*"]
          : Array.isArray(artifactDef)
            ? artifactDef.map((f) => path.join(fd, f))
            : [path.join(fd, artifactDef)];

      return {
        action: "bash_dispatch",
        step,
        worker: { role, agentFile, tools: WORKER_TOOLS, maxTurns: 30 },
        prompt,
        artifacts,
      };
    }

    case "review-loop":
    case "parallel-review": {
      const reviewerRole = (teamConfig.teammates ?? []).find((t) => t.writeAccess === false);
      const fixerRole = (teamConfig.teammates ?? []).find((t) => t.writeAccess !== false);

      const targetFiles = collectReviewTargets(step, fd, flowDef, fs);
      const reviewPrompt = buildBashReviewPrompt(step, fd, targetFiles, flowDef, fs);
      const fixerBasePrompt = buildBashFixerBasePrompt(step, fd, targetFiles, flowDef, fs);

      return {
        action: "bash_review_dispatch",
        step,
        reviewer: {
          role: reviewerRole?.role ?? `reviewer-${step}`,
          agentFile: `agents/claude/${reviewerRole?.role ?? `reviewer-${step}`}.md`,
          tools: REVIEWER_TOOLS,
          maxTurns: 15,
        },
        fixer: {
          role: fixerRole?.role ?? "review-fixer",
          agentFile: `agents/claude/${fixerRole?.role ?? "review-fixer"}.md`,
          tools: WORKER_TOOLS,
          maxTurns: 20,
        },
        reviewPrompt,
        fixerBasePrompt,
        targetFiles,
        maxIterations: teamConfig.maxReviewIterations ?? 12,
      };
    }
  }
}

function collectReviewTargets(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): string[] {
  // reviewTargets が明示的に定義されている場合
  const pattern = flowDef.reviewTargets?.[step];
  if (pattern) {
    if (pattern === "*") return [fd];
    const fullPath = path.join(fd, pattern);
    if (fs.exists(fullPath)) return [fullPath];
  }

  // デフォルト: コンテキストファイルを対象にする
  const ctx = flowDef.context?.[step];
  if (!ctx) return [fd];

  const targets: string[] = [];
  for (const filename of Object.values(ctx)) {
    const fullPath = path.join(fd, filename);
    if (fs.exists(fullPath)) targets.push(fullPath);
  }
  return targets.length > 0 ? targets : [fd];
}


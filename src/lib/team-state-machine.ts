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
  ActionMeta,
  BashDispatchAction,
  BashReviewDispatchAction,
  BashParallelDispatchAction,
} from "./team-types.js";
import {
  buildBashDispatchPrompt,
  buildBashReviewPrompt,
  buildBashFixerBasePrompt,
} from "./team-instruction.js";

// --- Result ファイル検証 ---

/**
 * dispatch-worker.js が生成した正規の result ファイルか検証。
 *
 * 正規パターン:
 * - 成功: { type: "result", ... }  (worker CLI stdout — duration_ms, modelUsage 等を含む)
 * - 失敗: { status: "failed", exitCode: N, ... }  (dispatch-worker.js の全リトライ失敗出力)
 *
 * 拒否パターン:
 * - Opus 捏造: { status: "completed", artifacts: [...] } 等
 * - 不正 JSON / ファイル不在
 */
export function validateResultFile(
  resultPath: string,
  fs: Pick<FileSystem, "exists" | "readFile">
): { valid: boolean; reason?: string } {
  if (!fs.exists(resultPath)) {
    return { valid: false, reason: `result file not found: ${resultPath}` };
  }
  try {
    const data = JSON.parse(fs.readFile(resultPath));
    // dispatch-worker.js 成功パス: worker CLI の stdout をそのまま書き込み
    if (data.type === "result") {
      return { valid: true };
    }
    // dispatch-worker.js 失敗パス: 全リトライ失敗時の構造化エラー
    if (data.status === "failed" && typeof data.exitCode === "number") {
      return { valid: true }; // 失敗でも「dispatch は実行された」
    }
    // 上記以外 = Opus 捏造の可能性
    return { valid: false, reason: `invalid result format: expected type:"result" or status:"failed" with exitCode, got keys [${Object.keys(data).join(",")}] in ${resultPath}` };
  } catch {
    return { valid: false, reason: `result file is not valid JSON: ${resultPath}` };
  }
}

/**
 * ステップの teamConfig から期待される result ファイルパスを解決する。
 * teamConfig がない場合は null を返す（検証スキップ）。
 */
export function resolveExpectedResultFile(
  step: string,
  stateDir: string,
  flowDef: FlowDefinition
): string | null {
  const stepConfig = flowDef.teamConfig?.[step];
  if (!stepConfig) return null;

  const dispatchDir = path.join(stateDir, ".pd-dispatch");
  return stepConfig.type === "team"
    ? path.join(dispatchDir, `${step}-worker-result.json`)
    : path.join(dispatchDir, `${step}-reviewer-result.json`);
}

// --- コア関数 ---

export interface ComputeContext {
  state: PipelineState;
  featureDir: string;
  projectDir: string;
  flowDef: FlowDefinition;
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
    // user-gate: userGates 定義から選択肢付き gate を返す
    if (state.pendingApproval?.type === "user-gate") {
      const gateStep = state.pendingApproval.step;
      const gate = flowDef.userGates?.[gateStep];
      if (gate) {
        return {
          action: "user_gate",
          step: gateStep,
          message: gate.message,
          options: gate.options.map((o) => o.label),
          gateOptions: gate.options,
        };
      }
    }
    // 通常の approval 処理
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

  if (featureDir.includes("..")) {
    return {
      action: "user_gate",
      step: "validation",
      message: `Invalid featureDir: path traversal detected ("${featureDir}")`,
      options: ["abort"],
    };
  }
  const fd = path.join(projectDir, featureDir);
  const completedSet = new Set(state.completed ?? []);
  const pipeline = state.pipeline?.length > 0 ? state.pipeline : flowDef.steps;

  // config.json から worker CLI + dispatch 設定を解決
  const configPath = path.join(projectDir, ".poor-dev", "config.json");
  let workerCli = "glm";
  let dispatchConfig: DispatchConfig | undefined;
  if (fs.exists(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFile(configPath));
      workerCli = resolveWorkerCli(cfg?.default?.cli);
      if (cfg?.dispatch) {
        dispatchConfig = cfg.dispatch as DispatchConfig;
      }
    } catch { /* fallback to glm */ }
  }

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

  // 並列グループチェック: nextStep が parallelGroups に属し、
  // グループ内の全ステップが未完了 + pipeline に含まれる + prerequisites 充足 + teamConfig あり
  // → bash_parallel_dispatch を返す
  const parallelGroup = findParallelGroup(nextStep, completedSet, pipeline, fd, flowDef, fs);
  if (parallelGroup) {
    const parallelActions: (BashDispatchAction | BashReviewDispatchAction)[] = [];
    for (const step of parallelGroup) {
      const tc = flowDef.teamConfig?.[step];
      if (!tc) continue;
      parallelActions.push(buildBashDispatchTeamAction(step, tc, fd, featureDir, flowDef, fs, pipeline, completedSet, workerCli, dispatchConfig));
    }
    const meta: ActionMeta = {
      recovery_hint: `Resume: node .poor-dev/dist/bin/poor-dev-next.js --state-dir ${featureDir} --project-dir ${projectDir}`,
      step_complete_cmd: `node .poor-dev/dist/bin/poor-dev-next.js --steps-complete ${parallelGroup.join(",")} --state-dir ${featureDir} --project-dir ${projectDir}`,
    };
    const parallelAction: BashParallelDispatchAction = {
      action: "bash_parallel_dispatch",
      steps: parallelActions,
      _meta: meta,
    };
    return parallelAction;
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

  // Bash dispatch
  const action = buildBashDispatchTeamAction(nextStep, teamConfig, fd, featureDir, flowDef, fs, pipeline, completedSet, workerCli, dispatchConfig);
  action._meta = meta;
  return action;
}

// --- 内部ヘルパー ---

/**
 * config.json の dispatch セクション型。
 * timeout/max_retries のデフォルト + ステップ固有オーバーライドを提供。
 */
interface DispatchConfig {
  timeout?: number;
  max_retries?: number;
  detach?: boolean;
  step_overrides?: Record<string, { timeout?: number; max_retries?: number }>;
}

/**
 * DispatchConfig からステップ固有の timeout/maxRetries を解決する。
 */
function resolveDispatchParams(
  step: string,
  dispatchConfig?: DispatchConfig
): { timeout: number; maxRetries: number } {
  const stepOverride = dispatchConfig?.step_overrides?.[step];
  return {
    timeout: stepOverride?.timeout ?? dispatchConfig?.timeout ?? 600,
    maxRetries: stepOverride?.max_retries ?? dispatchConfig?.max_retries ?? 1,
  };
}

/**
 * config.json の cli 値から dispatch-worker に渡す CLI 名を解決する。
 */
function resolveWorkerCli(configCli: string | undefined): string {
  switch (configCli) {
    case "qwen": return "qwen";
    case "opencode": return "glm";
    default: return "glm";
  }
}

/**
 * nextStep が parallelGroups のグループに属し、
 * グループ内の全ステップが条件を満たす場合にグループを返す。
 * 一部完了済み等の場合は null → 従来の単一ステップ dispatch にフォールバック。
 */
function findParallelGroup(
  nextStep: string,
  completedSet: Set<string>,
  pipeline: string[],
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): string[] | null {
  if (!flowDef.parallelGroups) return null;

  const pipelineSet = new Set(pipeline);

  for (const group of flowDef.parallelGroups) {
    if (!group.includes(nextStep)) continue;

    // グループ内の全ステップが: (a) 未完了, (b) pipeline に含まれる, (c) prerequisites 充足, (d) teamConfig あり
    const allReady = group.every(
      (s) =>
        !completedSet.has(s) &&
        pipelineSet.has(s) &&
        !checkPrerequisites(s, fd, flowDef, fs) &&
        flowDef.teamConfig?.[s]
    );
    if (allReady) return group;
  }
  return null;
}

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

/**
 * dispatch-worker.js の実行コマンドを組み立てる。
 * LLM はこのコマンドをそのまま Bash 実行するだけ。
 */
function buildDispatchCommand(opts: {
  promptFile: string;
  agentFile: string;
  tools: string;
  maxTurns: number;
  resultFile: string;
  timeout?: number;
  maxRetries?: number;
  cli?: string;
  detach?: boolean;
}): string {
  const parts = [
    "node .poor-dev/dist/bin/dispatch-worker.js",
    `--cli ${opts.cli ?? "glm"}`,
    `--prompt-file ${opts.promptFile}`,
    `--append-system-prompt-file ${opts.agentFile}`,
    `--allowedTools '${opts.tools}'`,
    `--max-turns ${opts.maxTurns}`,
    `--result-file ${opts.resultFile}`,
    `--timeout ${opts.timeout ?? 600}`,
    `--max-retries ${opts.maxRetries ?? 1}`,
  ];
  if (opts.detach) {
    parts.push("--detach");
  }
  return parts.join(" ");
}

/**
 * detach モード用の polling コマンドを生成。
 * 36×16s = 576s（Bash tool timeout 600s 以内）で result file を監視。
 * DISPATCH_COMPLETE or DISPATCH_PENDING を stdout に出力。
 * DISPATCH_PENDING 時はワーカーの生存状態と経過時間を付与し、
 * LLM が pgrep 等のプロセス調査を行う動機を消す。
 */
function buildPollCommand(resultFile: string): string {
  const pidFile = `${resultFile}.pid`;
  return [
    `RESULT='${resultFile}'`,
    `PID_FILE='${pidFile}'`,
    `for i in $(seq 1 36); do [ -f "$RESULT" ] && echo DISPATCH_COMPLETE && exit 0; sleep 16; done`,
    `PID=$(cat "$PID_FILE" 2>/dev/null | tr -d "[:space:]")`,
    'if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then ELAPSED=$(ps -o etimes= -p "$PID" 2>/dev/null | tr -d " "); echo "DISPATCH_PENDING worker_alive=true pid=$PID elapsed=${ELAPSED}s"; else echo "DISPATCH_PENDING worker_alive=false"; fi',
  ].join("; ");
}

function buildBashDispatchTeamAction(
  step: string,
  teamConfig: StepTeamConfig,
  fd: string,
  featureDir: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">,
  pipeline: string[] = [],
  completedSet: Set<string> = new Set(),
  workerCli: string = "glm",
  dispatchConfig?: DispatchConfig
): BashDispatchAction | BashReviewDispatchAction {
  const WORKER_TOOLS = teamConfig.tools ?? "Read,Write,Edit,Bash,Grep,Glob";
  const REVIEWER_TOOLS = "Read,Glob,Grep";
  const effectiveCli = teamConfig.cli ?? workerCli;
  const dispatchDir = path.join(featureDir, ".pd-dispatch");

  switch (teamConfig.type) {
    case "team": {
      const teammate = (teamConfig.teammates ?? [])[0];
      const role = teammate?.role ?? `worker-${step}`;
      const agentFile = `agents/claude/${role}.md`;
      const maxTurns = teammate?.maxTurns ?? 30;
      const prompt = buildBashDispatchPrompt(step, fd, flowDef, fs, {
        teamEnabled: !!teamConfig.cli,
      });

      const promptFile = path.join(dispatchDir, `${step}-prompt.txt`);
      const resultFile = path.join(dispatchDir, `${step}-worker-result.json`);
      const dp = resolveDispatchParams(step, dispatchConfig);
      const detach = !!(dispatchConfig?.detach);
      const command = buildDispatchCommand({
        promptFile,
        agentFile,
        tools: WORKER_TOOLS,
        maxTurns,
        resultFile,
        timeout: dp.timeout,
        maxRetries: dp.maxRetries,
        cli: effectiveCli,
        detach,
      });

      const artifactDef = flowDef.artifacts?.[step];
      const artifacts: string[] = !artifactDef
        ? []
        : artifactDef === "*"
          ? ["*"]
          : Array.isArray(artifactDef)
            ? artifactDef.map((f) => path.join(fd, f))
            : [path.join(fd, artifactDef)];

      const action: BashDispatchAction = {
        action: "bash_dispatch",
        step,
        command,
        worker: { role, agentFile, tools: WORKER_TOOLS, maxTurns },
        prompt,
        artifacts,
      };
      if (detach) {
        action.detached = true;
        action.resultFile = resultFile;
        action.pollCommand = buildPollCommand(resultFile);
      }
      return action;
    }

    case "review-loop":
    case "parallel-review": {
      const reviewerRole = (teamConfig.teammates ?? []).find((t) => t.writeAccess === false);
      const fixerRole = (teamConfig.teammates ?? []).find((t) => t.writeAccess !== false);

      const reviewerRoleName = reviewerRole?.role ?? `reviewer-${step}`;
      const fixerRoleName = fixerRole?.role ?? "review-fixer";
      const reviewerAgentFile = `agents/claude/${reviewerRoleName}.md`;
      const fixerAgentFile = `agents/claude/${fixerRoleName}.md`;
      const reviewerMaxTurns = reviewerRole?.maxTurns ?? 15;
      const fixerMaxTurns = fixerRole?.maxTurns ?? 20;

      const { targets: targetFiles, missingWarning } = collectReviewTargets(step, fd, flowDef, fs);
      const priorFixes = collectPriorFixes(step, dispatchDir, pipeline, completedSet, fs);
      let reviewPrompt = buildBashReviewPrompt(step, fd, targetFiles, flowDef, fs, priorFixes);
      if (missingWarning) {
        reviewPrompt = `${missingWarning}\n\n${reviewPrompt}`;
      }
      const fixerBasePrompt = buildBashFixerBasePrompt(step, fd, targetFiles, flowDef, fs);

      const reviewerPromptFile = path.join(dispatchDir, `${step}-review-prompt.txt`);
      const reviewerResultFile = path.join(dispatchDir, `${step}-reviewer-result.json`);
      const dp = resolveDispatchParams(step, dispatchConfig);
      const detach = !!(dispatchConfig?.detach);
      const reviewerCommand = buildDispatchCommand({
        promptFile: reviewerPromptFile,
        agentFile: reviewerAgentFile,
        tools: REVIEWER_TOOLS,
        maxTurns: reviewerMaxTurns,
        resultFile: reviewerResultFile,
        timeout: dp.timeout,
        maxRetries: dp.maxRetries,
        cli: effectiveCli,
        detach,
      });

      // fixer は --prompt-file が動的（iteration ごとに変わる）なので prefix のみ
      const fixerResultFile = path.join(dispatchDir, `${step}-fixer-result.json`);
      const fixerCommandPrefix = buildDispatchCommand({
        promptFile: "__PROMPT_FILE__",
        agentFile: fixerAgentFile,
        tools: WORKER_TOOLS,
        maxTurns: fixerMaxTurns,
        resultFile: fixerResultFile,
        timeout: dp.timeout,
        maxRetries: dp.maxRetries,
        cli: effectiveCli,
        detach,
      }).replace(" --prompt-file __PROMPT_FILE__", "");

      const reviewAction: BashReviewDispatchAction = {
        action: "bash_review_dispatch",
        step,
        reviewerCommand,
        fixerCommandPrefix,
        reviewer: {
          role: reviewerRoleName,
          agentFile: reviewerAgentFile,
          tools: REVIEWER_TOOLS,
          maxTurns: reviewerMaxTurns,
        },
        fixer: {
          role: fixerRoleName,
          agentFile: fixerAgentFile,
          tools: WORKER_TOOLS,
          maxTurns: fixerMaxTurns,
        },
        reviewPrompt,
        fixerBasePrompt,
        targetFiles,
        maxIterations: teamConfig.maxReviewIterations ?? 12,
      };
      if (detach) {
        reviewAction.detached = true;
        reviewAction.reviewerResultFile = reviewerResultFile;
        reviewAction.reviewerPollCommand = buildPollCommand(reviewerResultFile);
        reviewAction.fixerResultFile = fixerResultFile;
        reviewAction.fixerPollCommand = buildPollCommand(fixerResultFile);
      }
      return reviewAction;
    }
  }
}

export function collectReviewTargets(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): { targets: string[]; missingWarning?: string } {
  // reviewTargets が明示的に定義されている場合
  const pattern = flowDef.reviewTargets?.[step];
  if (pattern) {
    if (pattern === "*") return { targets: [fd] };
    const fullPath = path.join(fd, pattern);
    if (fs.exists(fullPath)) return { targets: [fullPath] };
  }

  // デフォルト: コンテキストファイルを対象にする
  const ctx = flowDef.context?.[step];
  if (!ctx) return { targets: [fd] };

  const targets: string[] = [];
  for (const filename of Object.values(ctx)) {
    const fullPath = path.join(fd, filename);
    if (fs.exists(fullPath)) targets.push(fullPath);
  }
  if (targets.length === 0) {
    return {
      targets: [fd],
      missingWarning: `WARNING: No implementation files found in ${fd}. Review may be based on incomplete data.`,
    };
  }
  return { targets };
}

const FIXED_DESC_RE = /^\s*-?\s*desc:\s*"?(.+?)"?\s*$/;
const MAX_PRIOR_FIXES = 5;

/**
 * fixer result テキストから desc 行を抽出する。
 */
export function extractFixedDescs(resultText: string): string[] {
  const descs: string[] = [];
  let inFixed = false;
  for (const line of resultText.split("\n")) {
    if (/^\s*fixed:\s*$/.test(line)) {
      inFixed = true;
      continue;
    }
    if (inFixed && /^\s*(rejected|cannot_fix|remaining|delta_lines):/.test(line)) {
      inFixed = false;
    }
    if (inFixed) {
      const m = FIXED_DESC_RE.exec(line);
      if (m?.[1]) {
        descs.push(m[1]);
        if (descs.length >= MAX_PRIOR_FIXES) break;
      }
    }
  }
  return descs;
}

/**
 * 現在のレビューステップより前に完了したレビューステップの fixer result から
 * 修正済み issue の desc を収集する（二重指摘防止用）。
 */
export function collectPriorFixes(
  currentStep: string,
  dispatchDir: string,
  pipeline: string[],
  completedSet: Set<string>,
  fs: Pick<FileSystem, "exists" | "readFile">
): string[] {
  const fixes: string[] = [];
  const currentIdx = pipeline.indexOf(currentStep);
  for (let i = currentIdx - 1; i >= 0; i--) {
    const prevStep = pipeline[i]!;
    if (!completedSet.has(prevStep)) continue;
    const resultPath = path.join(dispatchDir, `${prevStep}-fixer-result.json`);
    if (!fs.exists(resultPath)) continue;
    try {
      const data = JSON.parse(fs.readFile(resultPath));
      const result: string = data?.result ?? "";
      const fixedDescs = extractFixedDescs(result);
      fixes.push(...fixedDescs.map(d => `(${prevStep}) ${d}`));
    } catch { /* skip malformed JSON */ }
    if (fixes.length >= MAX_PRIOR_FIXES) break;
  }
  return fixes.slice(0, MAX_PRIOR_FIXES);
}

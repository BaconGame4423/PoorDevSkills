#!/usr/bin/env node
/**
 * poor-dev-next CLI
 *
 * Agent Teams オーケストレーター用 TS ヘルパー。
 * FlowDefinition + PipelineState から次のアクションを JSON で返す。
 *
 * Usage:
 *   npx poor-dev-next --flow feature --state-dir specs/001/ --project-dir .
 *   npx poor-dev-next --step-complete specify --state-dir specs/001/
 *   npx poor-dev-next --init --flow feature --state-dir specs/001/
 */

import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { NodeFileSystem } from "../lib/node-adapters.js";
import { FilePipelineStateManager } from "../lib/pipeline-state.js";
import { resolveFlow, mergeFlows } from "../lib/flow-loader.js";
import { getFlowDefinition, BUILTIN_FLOWS } from "../lib/flow-definitions.js";
import { computeNextInstruction, validateResultFile, resolveExpectedResultFile } from "../lib/team-state-machine.js";
import { parseReviewerOutputYaml, checkConvergence, processReviewCycle } from "../lib/team-review.js";
import { parsePlanFile, resolveNextFeatureNumber, generateDiscussionSummary } from "../lib/plan-parser.js";
import type { TeamAction, BashParallelDispatchAction } from "../lib/team-types.js";
import type { PipelineState } from "../lib/types.js";
import type { ReviewerOutput, ReviewCycleInput } from "../lib/team-review.js";

// --- 引数パース ---

interface CliArgs {
  flow?: string;
  stateDir?: string;
  projectDir: string;
  stepComplete?: string;
  stepsComplete?: string;
  setConditional?: string;
  gateResponse?: string;
  init: boolean;
  parseReview?: string;
  idPrefix?: string;
  checkConvergence?: string;
  reviewCycle?: string;
  tokenReport?: string;
  orchestratorJsonl?: string;
  promptDir?: string;
  listFlows?: boolean;
  initFromPlan?: string;
  skipValidation?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    projectDir: process.cwd(),
    init: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => { const v = argv[++i]; if (!v) throw new Error(`Missing value for ${arg}`); return v; };
    switch (arg) {
      case "--flow":
        args.flow = next();
        break;
      case "--state-dir":
        args.stateDir = next();
        break;
      case "--project-dir":
        args.projectDir = next();
        break;
      case "--step-complete":
        args.stepComplete = next();
        break;
      case "--set-conditional":
        args.setConditional = next();
        break;
      case "--gate-response":
        args.gateResponse = next();
        break;
      case "--init":
        args.init = true;
        break;
      case "--parse-review":
        args.parseReview = next();
        break;
      case "--id-prefix":
        args.idPrefix = next();
        break;
      case "--check-convergence":
        args.checkConvergence = next();
        break;
      case "--review-cycle":
        args.reviewCycle = next();
        break;
      case "--steps-complete":
        args.stepsComplete = next();
        break;
      case "--prompt-dir":
        args.promptDir = next();
        break;
      case "--list-flows":
        args.listFlows = true;
        break;
      case "--init-from-plan":
        args.initFromPlan = next();
        break;
      case "--skip-validation":
        args.skipValidation = true;
        break;
      case "--token-report":
        args.tokenReport = next();
        break;
      case "--orchestrator-jsonl":
        args.orchestratorJsonl = next();
        break;
    }
  }

  return args;
}

// --- 条件分岐解決 ---

function resolveConditionalBranch(
  conditionalKey: string,
  stateFile: string,
  projectDir: string,
  stateManager: FilePipelineStateManager,
  fs: NodeFileSystem,
): void {
  const state = stateManager.read(stateFile);
  const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
  if (!flowDef) {
    process.stderr.write(JSON.stringify({ error: `Unknown flow: ${state.flow}` }) + "\n");
    process.exit(1);
  }

  const branch = flowDef.conditionalBranches?.[conditionalKey];
  if (!branch) {
    process.stderr.write(JSON.stringify({ error: `Unknown conditional: ${conditionalKey}` }) + "\n");
    process.exit(1);
  }

  switch (branch.action) {
    case "replace-pipeline":
      if (branch.variant) stateManager.setVariant(stateFile, branch.variant, conditionalKey);
      if (branch.pipeline) stateManager.setPipeline(stateFile, branch.pipeline);
      break;
    case "pause":
      stateManager.setStatus(stateFile, "paused", branch.pauseReason ?? "Paused by conditional");
      break;
    case "continue":
      break;
  }
}

// --- Prompt Dir 解決 ---

function resolvePromptDir(args: CliArgs, stateDir: string): string {
  return args.promptDir ?? path.join(stateDir, ".pd-dispatch");
}

// --- Prompt-to-File ---

function writePromptsToFiles(action: TeamAction, promptDir: string): void {
  mkdirSync(promptDir, { recursive: true });

  if (action.action === "bash_dispatch") {
    const filePath = path.join(promptDir, `${action.step}-prompt.txt`);
    writeFileSync(filePath, action.prompt, "utf-8");
    action.prompt = `-> ${filePath}`;
  } else if (action.action === "bash_review_dispatch") {
    const reviewPath = path.join(promptDir, `${action.step}-review-prompt.txt`);
    const fixerPath = path.join(promptDir, `${action.step}-fixer-base-prompt.txt`);
    writeFileSync(reviewPath, action.reviewPrompt, "utf-8");
    writeFileSync(fixerPath, action.fixerBasePrompt, "utf-8");
    action.reviewPrompt = `-> ${reviewPath}`;
    action.fixerBasePrompt = `-> ${fixerPath}`;
  } else if (action.action === "bash_parallel_dispatch") {
    for (const sub of action.steps) {
      if (sub.action === "bash_dispatch") {
        const filePath = path.join(promptDir, `${sub.step}-prompt.txt`);
        writeFileSync(filePath, sub.prompt, "utf-8");
        sub.prompt = `-> ${filePath}`;
      } else if (sub.action === "bash_review_dispatch") {
        const reviewPath = path.join(promptDir, `${sub.step}-review-prompt.txt`);
        const fixerPath = path.join(promptDir, `${sub.step}-fixer-base-prompt.txt`);
        writeFileSync(reviewPath, sub.reviewPrompt, "utf-8");
        writeFileSync(fixerPath, sub.fixerBasePrompt, "utf-8");
        sub.reviewPrompt = `-> ${reviewPath}`;
        sub.fixerBasePrompt = `-> ${fixerPath}`;
      }
    }
  }
}

// --- メイン ---

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // --list-flows: 利用可能なフロー一覧を返す
  if (args.listFlows) {
    const fs = new NodeFileSystem();
    const projectDir = path.resolve(args.projectDir);
    const { flows, errors } = mergeFlows(projectDir, fs);
    const list = Object.entries(flows).map(([name, def]) => ({
      name,
      description: def.description ?? null,
      steps: def.steps,
      builtin: name in BUILTIN_FLOWS,
    }));
    process.stdout.write(JSON.stringify({ flows: list, errors }) + "\n");
    return;
  }

  // --init-from-plan: Plan ファイルから feature ディレクトリ作成 + pipeline 初期化 + 最初のアクション計算
  if (args.initFromPlan) {
    const fs = new NodeFileSystem();
    const projectDir = path.resolve(args.projectDir);

    let planContent: string;
    try {
      planContent = readFileSync(args.initFromPlan, "utf-8");
    } catch (e) {
      process.stderr.write(JSON.stringify({ error: `Failed to read plan file: ${e instanceof Error ? e.message : String(e)}` }) + "\n");
      process.exit(1);
    }

    const parseResult = parsePlanFile(planContent);
    if (!parseResult.plan) {
      process.stderr.write(JSON.stringify({ error: `Plan parse errors: ${parseResult.errors.join("; ")}` }) + "\n");
      process.exit(1);
    }

    const plan = parseResult.plan;

    // Pipeline: skip → done
    if (plan.pipeline === "skip") {
      process.stdout.write(JSON.stringify({ action: "done", summary: "Pipeline skipped per plan.", artifacts: [] }) + "\n");
      return;
    }

    // Flow 解決: --flow CLI > plan の ## Selected flow
    const flowName = args.flow ?? plan.flow;
    const flowDef = resolveFlow(flowName, projectDir, fs) ?? getFlowDefinition(flowName);
    if (!flowDef) {
      process.stderr.write(JSON.stringify({ error: `Unknown flow: ${flowName}` }) + "\n");
      process.exit(1);
    }

    // Feature ディレクトリ作成
    const featuresDir = path.join(projectDir, "features");
    const nextNum = resolveNextFeatureNumber(featuresDir, fs);
    const paddedNum = String(nextNum).padStart(3, "0");
    const featureDirName = `${paddedNum}-${plan.featureName}`;
    const featureDir = path.join(featuresDir, featureDirName);
    const featureDirRelative = path.relative(projectDir, featureDir);
    mkdirSync(featureDir, { recursive: true });

    // discussion-summary.md 書き込み
    const summaryContent = generateDiscussionSummary(plan);
    const summaryPath = path.join(featureDir, "discussion-summary.md");
    fs.writeFile(summaryPath, summaryContent);

    // pipeline-state.json 初期化
    const stateManager = new FilePipelineStateManager(fs);
    const stateFile = path.join(featureDir, "pipeline-state.json");
    stateManager.init(stateFile, flowName, flowDef.steps);

    // 最初のアクション計算
    const state = stateManager.read(stateFile);
    const action = computeNextInstruction(
      { state, featureDir: featureDirRelative, projectDir, flowDef },
      fs
    );

    // prompt をファイルに書き出し
    const promptDir = args.promptDir ?? path.join(featureDir, ".pd-dispatch");
    writePromptsToFiles(action, promptDir);

    // _initFromPlan メタデータ付きで出力
    const output = {
      ...action,
      _initFromPlan: {
        featureDir: featureDirRelative,
        flow: flowName,
        featureName: plan.featureName,
        warnings: parseResult.warnings,
      },
    };
    process.stdout.write(JSON.stringify(output) + "\n");
    return;
  }

  // --token-report: worker 結果集約 + JSONL 分析
  if (args.tokenReport) {
    try {
      const { generateTokenReport } = await import("../lib/benchmark/token-report.js");
      const report = generateTokenReport(args.tokenReport, args.orchestratorJsonl);
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } catch (e) {
      process.stderr.write(JSON.stringify({ error: `Failed to generate token report: ${e instanceof Error ? e.message : String(e)}` }) + "\n");
      process.exit(1);
    }
    return;
  }

  // --review-cycle: 統合レビューサイクル (parse + dedup + convergence + fixer instructions)
  if (args.reviewCycle) {
    try {
      const data = JSON.parse(readFileSync(args.reviewCycle, "utf-8")) as ReviewCycleInput;
      const result = processReviewCycle(data);
      process.stdout.write(JSON.stringify(result) + "\n");
    } catch (e) {
      process.stderr.write(JSON.stringify({ error: `Failed to process review cycle: ${e instanceof Error ? e.message : String(e)}` }) + "\n");
      process.exit(1);
    }
    return;
  }

  // --parse-review: reviewer 出力の YAML パース
  if (args.parseReview) {
    try {
      const raw = readFileSync(args.parseReview, "utf-8");
      const prefix = args.idPrefix ?? "RV";
      const result = parseReviewerOutputYaml(raw, prefix, 1);
      process.stdout.write(JSON.stringify({
        issues: result.issues,
        verdict: result.verdict,
        hasVerdictLine: result.hasVerdictLine,
        parseMethod: result.parseMethod,
      }) + "\n");
    } catch (e) {
      process.stderr.write(JSON.stringify({ error: `Failed to parse review: ${e instanceof Error ? e.message : String(e)}` }) + "\n");
      process.exit(1);
    }
    return;
  }

  // --check-convergence: レビュー収束判定
  if (args.checkConvergence) {
    try {
      const data = JSON.parse(readFileSync(args.checkConvergence, "utf-8")) as {
        reviewerOutputs: ReviewerOutput[];
        fixedIds: string[];
      };
      const fixedSet = new Set(data.fixedIds ?? []);
      const result = checkConvergence(data.reviewerOutputs, fixedSet);
      process.stdout.write(JSON.stringify(result) + "\n");
    } catch (e) {
      process.stderr.write(JSON.stringify({ error: `Failed to check convergence: ${e instanceof Error ? e.message : String(e)}` }) + "\n");
      process.exit(1);
    }
    return;
  }

  const fs = new NodeFileSystem();
  const stateManager = new FilePipelineStateManager(fs);
  const projectDir = path.resolve(args.projectDir);

  if (!args.stateDir) {
    process.stderr.write(JSON.stringify({ error: "--state-dir is required" }) + "\n");
    process.exit(1);
  }

  const stateDir = path.resolve(args.stateDir);
  const stateFile = path.join(stateDir, "pipeline-state.json");

  // --init: pipeline-state.json 初期化
  if (args.init) {
    if (!args.flow) {
      process.stderr.write(JSON.stringify({ error: "--flow is required with --init" }) + "\n");
      process.exit(1);
    }

    const flowDef = resolveFlow(args.flow, projectDir, fs) ?? getFlowDefinition(args.flow);
    if (!flowDef) {
      process.stderr.write(JSON.stringify({ error: `Unknown flow: ${args.flow}` }) + "\n");
      process.exit(1);
    }

    stateManager.init(stateFile, args.flow, flowDef.steps);
    process.stdout.write(JSON.stringify({ status: "initialized", flow: args.flow, steps: flowDef.steps }) + "\n");
    return;
  }

  // --step-complete: ステップ完了マーク
  if (args.stepComplete) {
    if (!fs.exists(stateFile)) {
      process.stderr.write(JSON.stringify({ error: "pipeline-state.json not found" }) + "\n");
      process.exit(1);
    }

    // Result ファイル検証ゲート: dispatch-worker.js の正規出力があるか確認
    if (!args.skipValidation) {
      const preState = stateManager.read(stateFile);
      const preFlowDef = resolveFlow(preState.flow, projectDir, fs) ?? getFlowDefinition(preState.flow);
      if (preFlowDef) {
        const resultFile = resolveExpectedResultFile(args.stepComplete, stateDir, preFlowDef);
        if (resultFile) {
          const validation = validateResultFile(resultFile, fs);
          if (!validation.valid) {
            process.stderr.write(JSON.stringify({
              error: "step_complete_blocked",
              step: args.stepComplete,
              reason: validation.reason,
              hint: "dispatch command を実行して result file を生成してください",
            }) + "\n");
            process.exit(1);
          }
        }
      }
    }

    stateManager.completeStep(stateFile, args.stepComplete);
    process.stdout.write(JSON.stringify({ status: "step_completed", step: args.stepComplete }) + "\n");

    // --set-conditional が同時指定されている場合、conditional も適用
    if (args.setConditional) {
      resolveConditionalBranch(args.setConditional, stateFile, projectDir, stateManager, fs);
    }

    // userGates チェック: ステップに userGate が定義されていれば awaiting-approval に設定
    if (!args.setConditional) {
      const tmpState = stateManager.read(stateFile);
      const tmpFlowDef = resolveFlow(tmpState.flow, projectDir, fs) ?? getFlowDefinition(tmpState.flow);
      if (tmpFlowDef?.userGates?.[args.stepComplete]) {
        stateManager.setApproval(stateFile, "user-gate", args.stepComplete);
      }
    }

    // 完了後に次のアクションも返す
    const state = stateManager.read(stateFile);
    const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
    if (flowDef) {
      const featureDir = path.relative(projectDir, stateDir);
      const action = computeNextInstruction(
        { state, featureDir, projectDir, flowDef },
        fs
      );
      const promptDir = resolvePromptDir(args, stateDir);
      writePromptsToFiles(action, promptDir);
      process.stdout.write(JSON.stringify(action) + "\n");
    }
    return;
  }

  // --steps-complete: 複数ステップ一括完了マーク (並列ディスパッチ用)
  if (args.stepsComplete) {
    if (!fs.exists(stateFile)) {
      process.stderr.write(JSON.stringify({ error: "pipeline-state.json not found" }) + "\n");
      process.exit(1);
    }
    const steps = args.stepsComplete.split(",").map((s) => s.trim()).filter(Boolean);

    // Result ファイル検証ゲート: 各ステップの dispatch-worker.js 正規出力を個別検証
    if (!args.skipValidation) {
      const preState = stateManager.read(stateFile);
      const preFlowDef = resolveFlow(preState.flow, projectDir, fs) ?? getFlowDefinition(preState.flow);
      if (preFlowDef) {
        for (const step of steps) {
          const resultFile = resolveExpectedResultFile(step, stateDir, preFlowDef);
          if (resultFile) {
            const validation = validateResultFile(resultFile, fs);
            if (!validation.valid) {
              process.stderr.write(JSON.stringify({
                error: "step_complete_blocked",
                step,
                reason: validation.reason,
                hint: "dispatch command を実行して result file を生成してください",
              }) + "\n");
              process.exit(1);
            }
          }
        }
      }
    }

    for (const step of steps) {
      stateManager.completeStep(stateFile, step);
    }
    process.stdout.write(JSON.stringify({ status: "steps_completed", steps }) + "\n");

    // userGates チェック: 最終ステップのみ (中間ステップの gate は並列完了時に誤発火防止のためスキップ)
    const lastStep = steps[steps.length - 1];
    if (lastStep) {
      const tmpState = stateManager.read(stateFile);
      const tmpFlowDef = resolveFlow(tmpState.flow, projectDir, fs) ?? getFlowDefinition(tmpState.flow);
      if (tmpFlowDef?.userGates?.[lastStep]) {
        stateManager.setApproval(stateFile, "user-gate", lastStep);
      }
    }

    // 完了後に次のアクションも返す
    const state = stateManager.read(stateFile);
    const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
    if (flowDef) {
      const featureDir = path.relative(projectDir, stateDir);
      const action = computeNextInstruction(
        { state, featureDir, projectDir, flowDef },
        fs
      );
      const promptDir = resolvePromptDir(args, stateDir);
      writePromptsToFiles(action, promptDir);
      process.stdout.write(JSON.stringify(action) + "\n");
    }
    return;
  }

  // --gate-response: ユーザーゲート応答処理
  if (args.gateResponse) {
    if (!fs.exists(stateFile)) {
      process.stderr.write(JSON.stringify({ error: "pipeline-state.json not found" }) + "\n");
      process.exit(1);
    }
    const response = args.gateResponse;

    // user-gate の場合: response を conditionalKey として分岐解決
    const preState = stateManager.read(stateFile);
    if (preState.pendingApproval?.type === "user-gate") {
      stateManager.clearApproval(stateFile);
      resolveConditionalBranch(response, stateFile, projectDir, stateManager, fs);

      const state = stateManager.read(stateFile);
      const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
      if (!flowDef) {
        process.stderr.write(JSON.stringify({ error: `Unknown flow: ${state.flow}` }) + "\n");
        process.exit(1);
      }
      const featureDir = path.relative(projectDir, stateDir);
      const action = computeNextInstruction(
        { state, featureDir, projectDir, flowDef },
        fs
      );
      const promptDir = resolvePromptDir(args, stateDir);
      writePromptsToFiles(action, promptDir);
      process.stdout.write(JSON.stringify(action) + "\n");
      return;
    }

    if (response === "abort") {
      stateManager.setStatus(stateFile, "completed", "Aborted by user");
      process.stdout.write(JSON.stringify({ action: "done", summary: "Pipeline aborted by user.", artifacts: [] }) + "\n");
      return;
    }

    if (response === "skip") {
      const st = stateManager.read(stateFile);
      if (st.current) {
        stateManager.completeStep(stateFile, st.current);
      }
    } else if (response !== "retry") {
      // approve or custom response → clear approval and continue
      stateManager.clearApproval(stateFile);
    }
    // retry: no state change, just re-compute

    const state = stateManager.read(stateFile);
    const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
    if (!flowDef) {
      process.stderr.write(JSON.stringify({ error: `Unknown flow: ${state.flow}` }) + "\n");
      process.exit(1);
    }
    const featureDir = path.relative(projectDir, stateDir);
    const action = computeNextInstruction(
      { state, featureDir, projectDir, flowDef },
      fs
    );
    const promptDir = resolvePromptDir(args, stateDir);
    writePromptsToFiles(action, promptDir);
    process.stdout.write(JSON.stringify(action) + "\n");
    return;
  }

  // --set-conditional: 条件分岐処理
  if (args.setConditional) {
    if (!fs.exists(stateFile)) {
      process.stderr.write(JSON.stringify({ error: "pipeline-state.json not found" }) + "\n");
      process.exit(1);
    }
    resolveConditionalBranch(args.setConditional, stateFile, projectDir, stateManager, fs);

    // Return next action after state update
    const updatedState = stateManager.read(stateFile);
    const flowDef = resolveFlow(updatedState.flow, projectDir, fs) ?? getFlowDefinition(updatedState.flow);
    if (!flowDef) {
      process.stderr.write(JSON.stringify({ error: `Unknown flow: ${updatedState.flow}` }) + "\n");
      process.exit(1);
    }
    const featureDir = path.relative(projectDir, stateDir);
    const nextAction = computeNextInstruction(
      { state: updatedState, featureDir, projectDir, flowDef },
      fs
    );
    const promptDir = resolvePromptDir(args, stateDir);
    writePromptsToFiles(nextAction, promptDir);
    process.stdout.write(JSON.stringify(nextAction) + "\n");
    return;
  }

  // デフォルト: 次のアクションを計算
  let state: PipelineState;
  if (fs.exists(stateFile)) {
    state = stateManager.read(stateFile);
  } else if (args.flow) {
    // state がない場合はフロー名から初期状態を作成
    const flowDef = resolveFlow(args.flow, projectDir, fs) ?? getFlowDefinition(args.flow);
    if (!flowDef) {
      process.stderr.write(JSON.stringify({ error: `Unknown flow: ${args.flow}` }) + "\n");
      process.exit(1);
    }
    state = stateManager.init(stateFile, args.flow, flowDef.steps);
  } else {
    process.stderr.write(JSON.stringify({ error: "--flow or existing pipeline-state.json required" }) + "\n");
    process.exit(1);
  }

  const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
  if (!flowDef) {
    process.stderr.write(JSON.stringify({ error: `Unknown flow: ${state.flow}` }) + "\n");
    process.exit(1);
  }

  const featureDir = path.relative(projectDir, stateDir);
  const action = computeNextInstruction(
    { state, featureDir, projectDir, flowDef },
    fs
  );

  // prompt をファイルに書き出し、JSON の prompt フィールドを参照パスに置換
  const promptDir = resolvePromptDir(args, stateDir);
  writePromptsToFiles(action, promptDir);

  process.stdout.write(JSON.stringify(action) + "\n");
}

main().catch((e) => {
  process.stderr.write(JSON.stringify({ error: String(e) }) + "\n");
  process.exit(1);
});

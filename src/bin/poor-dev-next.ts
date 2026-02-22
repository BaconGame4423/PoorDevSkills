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
import { readFileSync } from "node:fs";
import { NodeFileSystem } from "../lib/node-adapters.js";
import { FilePipelineStateManager } from "../lib/pipeline-state.js";
import { resolveFlow } from "../lib/flow-loader.js";
import { getFlowDefinition } from "../lib/flow-definitions.js";
import { computeNextInstruction } from "../lib/team-state-machine.js";
import { parseReviewerOutputYaml, checkConvergence, processReviewCycle } from "../lib/team-review.js";
import type { PipelineState } from "../lib/types.js";
import type { ReviewerOutput, ReviewCycleInput } from "../lib/team-review.js";

// --- 引数パース ---

interface CliArgs {
  flow?: string;
  stateDir?: string;
  projectDir: string;
  stepComplete?: string;
  setConditional?: string;
  gateResponse?: string;
  init: boolean;
  parseReview?: string;
  idPrefix?: string;
  checkConvergence?: string;
  reviewCycle?: string;
  bashDispatch: boolean;
  tokenReport?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    projectDir: process.cwd(),
    init: false,
    bashDispatch: false,
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
      case "--bash-dispatch":
        args.bashDispatch = true;
        break;
      case "--token-report":
        args.tokenReport = next();
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

// --- メイン ---

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // --token-report: worker 結果集約 + JSONL 分析
  if (args.tokenReport) {
    try {
      const { generateTokenReport } = await import("../lib/benchmark/token-report.js");
      const report = generateTokenReport(args.tokenReport);
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
    stateManager.completeStep(stateFile, args.stepComplete);
    process.stdout.write(JSON.stringify({ status: "step_completed", step: args.stepComplete }) + "\n");

    // --set-conditional が同時指定されている場合、conditional も適用
    if (args.setConditional) {
      resolveConditionalBranch(args.setConditional, stateFile, projectDir, stateManager, fs);
    }

    // 完了後に次のアクションも返す
    const state = stateManager.read(stateFile);
    const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
    if (flowDef) {
      const featureDir = path.relative(projectDir, stateDir);
      const action = computeNextInstruction(
        { state, featureDir, projectDir, flowDef, bashDispatch: args.bashDispatch },
        fs
      );
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
      { state: updatedState, featureDir, projectDir, flowDef, bashDispatch: args.bashDispatch },
      fs
    );
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
    { state, featureDir, projectDir, flowDef, bashDispatch: args.bashDispatch },
    fs
  );

  process.stdout.write(JSON.stringify(action) + "\n");
}

main().catch((e) => {
  process.stderr.write(JSON.stringify({ error: String(e) }) + "\n");
  process.exit(1);
});

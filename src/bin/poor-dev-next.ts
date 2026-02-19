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
import { NodeFileSystem } from "../lib/node-adapters.js";
import { FilePipelineStateManager } from "../lib/pipeline-state.js";
import { resolveFlow } from "../lib/flow-loader.js";
import { getFlowDefinition } from "../lib/flow-definitions.js";
import { computeNextInstruction } from "../lib/team-state-machine.js";
import type { PipelineState } from "../lib/types.js";

// --- 引数パース ---

interface CliArgs {
  flow?: string;
  stateDir?: string;
  projectDir: string;
  stepComplete?: string;
  reviewUpdate: boolean;
  setConditional?: string;
  gateResponse?: string;
  init: boolean;
  useAgentTeams: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    projectDir: process.cwd(),
    reviewUpdate: false,
    init: false,
    useAgentTeams: true,
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
      case "--review-update":
        args.reviewUpdate = true;
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
      case "--legacy":
        args.useAgentTeams = false;
        break;
    }
  }

  return args;
}

// --- メイン ---

function main(): void {
  const args = parseArgs(process.argv);
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

    // 完了後に次のアクションも返す
    const state = stateManager.read(stateFile);
    const flowDef = resolveFlow(state.flow, projectDir, fs) ?? getFlowDefinition(state.flow);
    if (flowDef) {
      const featureDir = path.relative(projectDir, stateDir);
      const action = computeNextInstruction(
        { state, featureDir, projectDir, flowDef, useAgentTeams: args.useAgentTeams },
        fs
      );
      process.stdout.write(JSON.stringify(action) + "\n");
    }
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
    { state, featureDir, projectDir, flowDef, useAgentTeams: args.useAgentTeams },
    fs
  );

  process.stdout.write(JSON.stringify(action) + "\n");
}

main();

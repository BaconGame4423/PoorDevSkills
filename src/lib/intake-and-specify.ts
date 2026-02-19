/**
 * intake-and-specify.ts
 *
 * intake-and-specify.sh の TypeScript 移植。
 * intake + specify を同期実行する複合エントリポイント。
 *
 * 処理:
 *   1. 冪等性: 既存の feature branch/dir があればスキップ
 *   2. intake --setup-only → branch, feature_dir
 *   3. pipeline-state init → 状態初期化
 *   4. spec.md が存在する場合 → スキップ (resume support)
 *   5. compose-prompt + dispatch-step → specify 実行
 *   6. extract-output → spec.md 保存
 *   7. pipeline-state complete-step specify
 *
 * intake-and-specify.sh 全体参照。
 */

import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

import { intake, generateShortName } from "./intake.js";
import { setupBranch } from "./branch-setup.js";
import { composePrompt } from "./compose-prompt.js";
import { extractOutput } from "./extract-output.js";
import type { FileSystem, Dispatcher, PipelineStateManager } from "./interfaces.js";
import type { PoorDevConfig } from "./types.js";
import { dispatchWithRetry } from "./retry-helpers.js";

// --- 型定義 ---

export interface IntakeAndSpecifyOptions {
  flow: string;
  projectDir: string;
  inputText: string;
  fileSystem: FileSystem;
  dispatcher: Dispatcher;
  stateManager: PipelineStateManager;
  config: PoorDevConfig | null;
}

export interface IntakeAndSpecifyResult {
  branch: string;
  featureDir: string;
  specContent: string;
  resumed: boolean;
}

// --- フロースコープ ---

const FLOW_STEPS: Record<string, string[]> = {
  feature: [
    "specify", "suggest", "plan", "planreview", "tasks", "tasksreview",
    "implement", "architecturereview", "qualityreview", "phasereview",
  ],
  bugfix: ["bugfix"],
  roadmap: ["concept", "goals", "milestones", "roadmap"],
  "discovery-init": ["discovery"],
  "discovery-rebuild": ["rebuildcheck"],
  investigation: ["investigate"],
};

// --- 既存フィーチャーディレクトリの検出 ---

/**
 * 現在のブランチが連番フィーチャーブランチかどうかを確認し、
 * 対応する specs/ ディレクトリを返す。
 * intake-and-specify.sh L66-78 に対応。
 */
function findExistingFeatureDir(projectDir: string): { branch: string; featureDir: string } | null {
  let currentBranch = "";
  try {
    currentBranch = execFileSync(
      "git", ["-C", projectDir, "rev-parse", "--abbrev-ref", "HEAD"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
  } catch {
    return null;
  }

  const prefixMatch = /^(\d+)-/.exec(currentBranch);
  if (!prefixMatch?.[1]) return null;

  const prefix = prefixMatch[1];
  const specsDir = path.join(projectDir, "specs");

  try {
    const entries = fs.readdirSync(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
        return {
          branch: currentBranch,
          featureDir: `specs/${entry.name}`,
        };
      }
    }
  } catch { /* no-op */ }

  return null;
}

// --- コマンドファイル解決 ---

function resolveSpecifyCommand(projectDir: string, config: PoorDevConfig | null): string | null {
  const variant = config?.command_variant;
  const candidates = [];

  if (variant === "simple") {
    candidates.push(
      path.join(projectDir, "commands", "poor-dev.specify-simple.md"),
      path.join(projectDir, ".opencode/command", "poor-dev.specify-simple.md")
    );
  }

  candidates.push(
    path.join(projectDir, "commands", "poor-dev.specify.md"),
    path.join(projectDir, ".opencode/command", "poor-dev.specify.md")
  );

  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

// --- メイン関数 ---

/**
 * intake + specify を同期実行する。
 * intake-and-specify.sh のメインロジック全体に対応。
 */
export async function intakeAndSpecify(
  opts: IntakeAndSpecifyOptions
): Promise<IntakeAndSpecifyResult> {
  const { flow, projectDir, inputText, fileSystem, dispatcher, stateManager, config } = opts;

  // --- ステップ 1: セットアップ（冪等） ---

  let branch = "";
  let featureDir = "";

  // 既存のフィーチャーブランチを検出
  const existing = findExistingFeatureDir(projectDir);
  if (existing) {
    branch = existing.branch;
    featureDir = existing.featureDir;
    // input.txt を保存（上書き）
    const fd = path.join(projectDir, featureDir);
    fileSystem.writeFile(path.join(fd, "input.txt"), inputText);
  } else {
    // 新規セットアップ
    const shortName = generateShortName(inputText, flow);
    const result = setupBranch(shortName, projectDir);
    branch = result.branch;
    featureDir = result.featureDir;

    const fd = path.join(projectDir, featureDir);
    fileSystem.writeFile(path.join(fd, "input.txt"), inputText);
  }

  void intake; // 参照維持（tree-shaking 防止）

  const fd = path.join(projectDir, featureDir);
  const stateFile = path.join(fd, "pipeline-state.json");

  // --- ステップ 2: pipeline-state 初期化 ---

  if (!fileSystem.exists(stateFile)) {
    const steps = FLOW_STEPS[flow];
    if (!steps) {
      throw new Error(`Unknown flow: ${flow}`);
    }
    stateManager.init(stateFile, flow, steps);
  }

  // --- ステップ 3: spec.md が既存の場合は resume ---

  const specFile = path.join(fd, "spec.md");
  if (fileSystem.exists(specFile)) {
    const existingSpec = fileSystem.readFile(specFile);
    if (existingSpec.trim()) {
      // specify が完了していない場合は complete-step
      const state = stateManager.read(stateFile);
      if (!state.completed?.includes("specify")) {
        stateManager.completeStep(stateFile, "specify");
      }
      return { branch, featureDir, specContent: existingSpec, resumed: true };
    }
  }

  // --- ステップ 4: specify ディスパッチ ---

  const commandFile = resolveSpecifyCommand(projectDir, config);
  if (!commandFile) {
    throw new Error("Command file not found: poor-dev.specify.md");
  }

  const idleTimeout = config?.polling?.idle_timeout ?? 300;
  const maxTimeout = config?.polling?.max_timeout ?? 600;

  // プロンプト生成
  const promptFile = `/tmp/poor-dev-prompt-specify-${process.pid}.txt`;
  const pipelineCtxFile = `/tmp/poor-dev-pipeline-ctx-specify-${process.pid}.txt`;

  const pipelineCtxContent = [
    `- FEATURE_DIR: ${featureDir}`,
    `- BRANCH: ${branch}`,
    `- Feature: ${inputText.split("\n")[0] ?? ""}`,
    `- Step: specify (1/${FLOW_STEPS[flow]?.length ?? 10})`,
  ].join("\n");

  fileSystem.writeFile(pipelineCtxFile, pipelineCtxContent);

  const ctxFiles: Record<string, string> = { pipeline: pipelineCtxFile };
  const inputTxtPath = path.join(fd, "input.txt");
  if (fileSystem.exists(inputTxtPath)) {
    ctxFiles["input"] = inputTxtPath;
  }

  const composed = composePrompt({
    commandFile,
    outputFile: promptFile,
    headers: ["non_interactive", "readonly"],
    contexts: ctxFiles,
  });

  if (!composed.success) {
    throw new Error(`compose-prompt failed: ${composed.error ?? "unknown"}`);
  }

  // ディスパッチ
  const resultFile = `/tmp/poor-dev-result-specify-${process.pid}.json`;
  const { exitCode } = await dispatchWithRetry(
    "specify", projectDir, promptFile,
    idleTimeout, maxTimeout, resultFile,
    dispatcher, fileSystem,
    { config: config?.retry ?? {} }
  );

  // クリーンアップ
  fileSystem.removeFile(promptFile);
  fileSystem.removeFile(pipelineCtxFile);

  if (exitCode !== 0) {
    fileSystem.removeFile(resultFile);
    throw new Error(`dispatch failed with exit code ${exitCode}`);
  }

  // --- ステップ 5: 出力抽出 ---

  // dispatch が生成した output ファイルを探す
  let specOutput = "";
  try {
    const tmpFiles = fs.readdirSync("/tmp")
      .filter((f) => f.startsWith("poor-dev-output-specify-") && f.endsWith(".txt"))
      .map((f) => ({ f: path.join("/tmp", f), mt: fs.statSync(path.join("/tmp", f)).mtimeMs }))
      .sort((a, b) => b.mt - a.mt);
    if (tmpFiles[0]) specOutput = tmpFiles[0].f;
  } catch { /* no-op */ }

  if (!specOutput) {
    fileSystem.removeFile(resultFile);
    throw new Error("No specify output file found");
  }

  const extractResult = extractOutput(specOutput, specFile);
  fileSystem.removeFile(resultFile);

  if (extractResult.status !== "ok") {
    throw new Error(`Failed to extract spec: ${extractResult.error ?? "unknown"}`);
  }

  // --- ステップ 6: complete-step ---

  stateManager.completeStep(stateFile, "specify");

  const specContent = fileSystem.readFile(specFile);
  return { branch, featureDir, specContent, resumed: false };
}

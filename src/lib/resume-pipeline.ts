/**
 * resume-pipeline.ts
 *
 * resume-pipeline.sh の TypeScript 移植。
 * 承認後のパイプライン再開。
 *
 * 処理:
 *   1. pipeline-state.json を読み込む
 *   2. flow / branch / summary を取得
 *   3. awaiting-approval の場合は承認をクリア
 *   4. pipeline-runner.sh をバックグラウンドで起動
 *
 * resume-pipeline.sh 全体参照。
 */

import path from "node:path";
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";

import type { FileSystem, PipelineStateManager } from "./interfaces.js";

// --- 型定義 ---

export interface ResumePipelineOptions {
  featureDir: string;
  projectDir: string;
  fileSystem: FileSystem;
  stateManager: PipelineStateManager;
}

export interface ResumePipelineResult {
  status: "resumed" | "error";
  pid?: number;
  logPath?: string;
  flow?: string;
  featureDir?: string;
  error?: string;
}

// --- メイン関数 ---

/**
 * パイプラインを再開する。
 * resume-pipeline.sh のメインロジック全体に対応。
 */
export function resumePipeline(opts: ResumePipelineOptions): ResumePipelineResult {
  const { featureDir, projectDir, fileSystem, stateManager } = opts;

  const fd = path.join(projectDir, featureDir);
  const stateFile = path.join(fd, "pipeline-state.json");

  // --- pipeline-state.json 確認 ---

  if (!fileSystem.exists(stateFile)) {
    return { status: "error", error: `pipeline-state.json not found in ${fd}` };
  }

  const state = stateManager.read(stateFile);
  const flow = state.flow;

  if (!flow) {
    return { status: "error", error: "Invalid pipeline-state.json: missing flow" };
  }

  // --- ブランチ取得 ---

  let branch = "";
  try {
    branch = execFileSync(
      "git", ["-C", projectDir, "rev-parse", "--abbrev-ref", "HEAD"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
  } catch {
    return { status: "error", error: "Cannot determine current branch" };
  }

  if (!branch) {
    return { status: "error", error: "Cannot determine current branch" };
  }

  // --- 承認クリア ---

  if (state.status === "awaiting-approval") {
    try {
      stateManager.clearApproval(stateFile);
    } catch { /* no-op */ }
  }

  // --- summary 取得 ---

  let summary = "";
  const inputFile = path.join(fd, "input.txt");
  if (fileSystem.exists(inputFile)) {
    try {
      const lines = fileSystem.readFile(inputFile).split("\n");
      summary = lines[0] ?? "";
    } catch { /* no-op */ }
  }

  // --- パイプライン起動（バックグラウンド）---

  const pipelineLog = path.join(fd, "pipeline.log");
  const pipelinePidFile = path.join(fd, "pipeline.pid");

  const libDir = path.join(projectDir, "lib");
  const pipelineScript = path.join(libDir, "pipeline-runner.sh");

  let pid = 0;

  if (fs.existsSync(pipelineScript)) {
    const child = spawn(
      "bash",
      [
        pipelineScript,
        "--flow", flow,
        "--feature-dir", featureDir,
        "--branch", branch,
        "--project-dir", projectDir,
        "--summary", summary,
      ],
      {
        detached: true,
        stdio: ["ignore", fs.openSync(pipelineLog, "a"), fs.openSync(pipelineLog, "a")],
        cwd: projectDir,
      }
    );
    child.unref();
    pid = child.pid ?? 0;
    fs.writeFileSync(pipelinePidFile, String(pid), "utf8");
  }

  return {
    status: "resumed",
    pid,
    logPath: pipelineLog,
    flow,
    featureDir,
  };
}

/**
 * intake.ts
 *
 * intake.sh の TypeScript 移植。
 * ユーザー入力受付・ブランチ作成・パイプライン起動。
 *
 * 処理:
 *   1. ユーザー入力を読み込む
 *   2. 短縮名を生成
 *   3. branch-setup でブランチ・ディレクトリを作成
 *   4. input.txt を保存
 *   5. pipeline-runner.ts を子プロセスとして起動（PipelineRunner.run()）
 *
 * intake.sh 全体参照。
 */

import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

import { setupBranch } from "./branch-setup.js";
import type { PoorDevConfig } from "./types.js";

// --- 型定義 ---

export interface IntakeOptions {
  flow: string;
  projectDir: string;
  inputFile?: string;
  inputText?: string;
  setupOnly?: boolean;
  config?: PoorDevConfig | null;
}

export interface IntakeEvent {
  event: string;
  [key: string]: unknown;
}

export type IntakeEmitter = (event: IntakeEvent) => void;

export interface IntakeResult {
  featureDir: string;
  branch: string;
  flow: string;
  pid?: number;
  logPath?: string;
}

// --- 短縮名生成 ---

/**
 * ユーザー入力テキストから短縮名を生成する。
 * intake.sh L60-67 に対応。
 *
 * - 英数字以外を除去
 * - 最初の4単語を取り、ハイフン結合
 * - 小文字化、30文字に切り詰め
 * - 空の場合は flow + 時刻のフォールバック
 */
export function generateShortName(input: string, flow: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9 ]/g, "");
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 4);
  let shortName = words.join("-").toLowerCase().slice(0, 30);

  if (!shortName) {
    const now = new Date();
    const hhmmss = [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");
    shortName = `${flow}-${hhmmss}`;
  }

  return shortName;
}

// --- メイン関数 ---

/**
 * intake フローを実行する。
 * intake.sh のメインロジック全体に対応。
 *
 * 注意: pipeline-runner はバックグラウンドで起動する（nohup 相当）。
 * TS 版では spawn() + detached: true を使用。
 */
export async function intake(
  opts: IntakeOptions,
  emit: IntakeEmitter = (e) => console.log(JSON.stringify(e))
): Promise<IntakeResult> {
  const { flow, projectDir, inputFile, inputText, setupOnly } = opts;

  // --- 入力読み込み ---

  let input = "";
  if (inputText) {
    input = inputText;
  } else if (inputFile && fs.existsSync(inputFile)) {
    input = fs.readFileSync(inputFile, "utf8");
  } else {
    throw new Error("No input provided (use inputText or inputFile)");
  }

  if (!input.trim()) {
    throw new Error("Empty input");
  }

  emit({ event: "intake_started", flow });

  // --- 短縮名生成 ---

  const shortName = generateShortName(input, flow);

  // --- ブランチ作成 ---

  let branchResult: { number: string; branch: string; featureDir: string };
  try {
    branchResult = setupBranch(shortName, projectDir);
  } catch (err) {
    throw new Error(`Branch setup failed: ${String(err)}`);
  }

  const { branch, featureDir } = branchResult;
  const fd = path.join(projectDir, featureDir);

  emit({ event: "branch_created", branch, feature_dir: featureDir });

  // --- input.txt を保存 ---

  fs.writeFileSync(path.join(fd, "input.txt"), input, "utf8");

  // --- setup-only モード ---

  if (setupOnly) {
    emit({ event: "setup_complete", feature_dir: featureDir, branch, flow });
    return { featureDir, branch, flow };
  }

  // --- パイプライン起動（バックグラウンド）---

  emit({ event: "pipeline", status: "starting" });

  const pipelineLog = path.join(fd, "pipeline.log");
  const pipelinePidFile = path.join(fd, "pipeline.pid");

  // bin/poor-dev.mjs を経由して pipeline-runner を起動
  // TS 移植完了前は Bash スクリプトにフォールバック
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
        "--input-file", path.join(fd, "input.txt"),
        "--summary", input,
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

  emit({
    event: "pipeline",
    status: "background",
    pid,
    feature_dir: featureDir,
    log: pipelineLog,
  });

  emit({ event: "intake_complete", feature_dir: featureDir, branch });

  return { featureDir, branch, flow, pid, logPath: pipelineLog };
}

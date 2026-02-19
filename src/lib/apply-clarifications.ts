/**
 * apply-clarifications.ts
 *
 * apply-clarifications.sh の TypeScript 移植。
 * pending-clarifications.json → spec.md 追記 + 承認クリア。
 *
 * 処理:
 *   1. pending-clarifications.json を読み込む
 *   2. spec.md に ## Clarifications セクションを追記
 *   3. pending-clarifications.json を削除
 *   4. pipeline-state.json の承認をクリア（PipelineStateManager 経由）
 *
 * apply-clarifications.sh 全体参照。
 */

import fs from "node:fs";
import path from "node:path";

import type { FileSystem, PipelineStateManager } from "./interfaces.js";

// --- 型定義 ---

export interface ApplyResult {
  status: "applied" | "error";
  questions?: number;
  spec?: string;
  error?: string;
}

// --- メイン関数 ---

export interface ApplyOptions {
  featureDir: string;
  userAnswers: string;
  fileSystem: FileSystem;
  stateManager?: PipelineStateManager;
}

/**
 * pending-clarifications.json の内容を spec.md に追記する。
 * apply-clarifications.sh のメインロジック全体に対応。
 */
export function applyClarifications(opts: ApplyOptions): ApplyResult {
  const { featureDir, userAnswers, fileSystem, stateManager } = opts;

  const pendingFile = path.join(featureDir, "pending-clarifications.json");
  const specFile = path.join(featureDir, "spec.md");

  // バリデーション
  if (!fileSystem.exists(pendingFile)) {
    return {
      status: "error",
      error: `no pending-clarifications.json found in ${featureDir}`,
    };
  }

  if (!fileSystem.exists(specFile)) {
    return {
      status: "error",
      error: `no spec.md found in ${featureDir}`,
    };
  }

  if (!userAnswers.trim()) {
    return { status: "error", error: "no answers provided" };
  }

  // pending-clarifications.json を読み込む
  let questions: string[] = [];
  let questionCount = 0;
  try {
    const pendingContent = fileSystem.readFile(pendingFile);
    const parsed = JSON.parse(pendingContent) as unknown;
    if (Array.isArray(parsed)) {
      questions = parsed.map((q) => String(q));
      questionCount = questions.length;
    }
  } catch {
    return { status: "error", error: "Failed to parse pending-clarifications.json" };
  }

  // spec.md に ## Clarifications セクションを追記
  const today = new Date().toISOString().slice(0, 10);
  const clarificationBlock = [
    "",
    "## Clarifications",
    "",
    `### ${today}`,
    "",
    "**Questions:**",
    "",
    ...questions.map((q, i) => {
      const cleaned = q.replace(/^\[NEEDS CLARIFICATION: /, "").replace(/\]$/, "");
      return `  ${i + 1}. ${cleaned}`;
    }),
    "",
    "**Answers:**",
    "",
    userAnswers,
    "",
  ].join("\n");

  const existingSpec = fileSystem.readFile(specFile);
  fileSystem.writeFile(specFile, existingSpec + clarificationBlock);

  // pending-clarifications.json を削除
  fileSystem.removeFile(pendingFile);

  // pipeline-state.json の承認をクリア
  if (stateManager) {
    const stateFile = path.join(featureDir, "pipeline-state.json");
    if (fileSystem.exists(stateFile)) {
      try {
        stateManager.clearApproval(stateFile);
      } catch { /* no-op */ }
    }
  }

  return {
    status: "applied",
    questions: questionCount,
    spec: specFile,
  };
}

/**
 * ファイルシステムの fs モジュールを直接使って stdin から実行する版。
 * apply-clarifications.sh の CLI インターフェースに対応。
 */
export function applyClarificationsFromStdin(featureDir: string): ApplyResult {
  const stdinBuffer = fs.readFileSync("/dev/stdin", "utf8");
  const fsImpl: FileSystem = {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, c) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, c, "utf8");
    },
    exists: (p) => fs.existsSync(p),
    removeFile: (p) => { try { fs.unlinkSync(p); } catch { /* no-op */ } },
    removeDir: (p) => fs.rmSync(p, { recursive: true, force: true }),
    readdir: (p) => {
      try {
        return fs.readdirSync(p, { withFileTypes: true }).map((e) => ({
          name: e.name,
          isFile: e.isFile(),
          isDirectory: e.isDirectory(),
        }));
      } catch { return []; }
    },
  };

  return applyClarifications({
    featureDir,
    userAnswers: stdinBuffer,
    fileSystem: fsImpl,
  });
}

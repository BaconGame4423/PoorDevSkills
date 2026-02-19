/**
 * Node.js 環境向けインターフェース実装
 *
 * テスト時はモックに置き換え、本番では本クラスを使用する。
 */

import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import path from "node:path";

import type { GitOps, FileSystem, Dispatcher } from "./interfaces.js";
import type { PoorDevConfig } from "./types.js";
import { resolveCliModel } from "./review-setup.js";

// --- NodeGitOps ---

export class NodeGitOps implements GitOps {
  hasGitDir(dir: string): boolean {
    return fs.existsSync(path.join(dir, ".git"));
  }

  git(dir: string, args: string[]): string {
    if (!this.hasGitDir(dir)) {
      throw new Error(
        `git skipped: no .git in ${dir}`
      );
    }
    const result = execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
    });
    return result.trim();
  }

  diff(dir: string): string {
    return this.git(dir, ["diff", "--name-only", "HEAD"]);
  }
}

// --- NodeFileSystem ---

export class NodeFileSystem implements FileSystem {
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, "utf8");
  }

  writeFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  }

  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  removeFile(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ファイルが存在しない場合はノーオペレーション
    }
  }

  removeDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }

  readdir(dirPath: string): Array<{ name: string; isFile: boolean; isDirectory: boolean }> {
    try {
      return fs.readdirSync(dirPath, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isFile: e.isFile(),
        isDirectory: e.isDirectory(),
      }));
    } catch {
      return [];
    }
  }
}

// --- NodeDispatcher ---

/**
 * dispatch-step.sh + poll-dispatch.sh の TypeScript 移植。
 * Dispatcher インターフェースの Node.js 実装。
 *
 * dispatch-step.sh:
 *   1. CLI/model を config-resolver で解決
 *   2. 子プロセスを spawn して output ファイルにパイプ
 *
 * poll-dispatch.sh:
 *   ポーリングループ:
 *   - アイドルタイムアウト (OUTPUT_STARTED 後)
 *   - 最大タイムアウト
 *   - step_finish + reason:stop シグナル検出（opencode）
 *
 * dispatch-step.sh, poll-dispatch.sh 全体参照。
 */
export class NodeDispatcher implements Dispatcher {
  constructor(private readonly config: PoorDevConfig | null) {}

  async dispatch(
    step: string,
    projectDir: string,
    promptFile: string,
    idleTimeout: number,
    maxTimeout: number,
    resultFile: string
  ): Promise<number> {
    // --- 1. CLI/model 解決 ---
    const { cli, model } = resolveCliModel(step, this.config);

    // --- 2. プロンプト読み込み ---
    let promptContent: string;
    try {
      promptContent = fs.readFileSync(promptFile, "utf8");
    } catch {
      const result = makeErrorResult("Prompt file not found: " + promptFile);
      if (resultFile) fs.writeFileSync(resultFile, JSON.stringify(result));
      return 1;
    }

    const outputFile = `/tmp/poor-dev-output-${step}-${process.pid}.txt`;

    // --- 3. 子プロセスを起動 ---
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnDispatch(cli, model, promptContent, projectDir, outputFile);
    } catch {
      const result = makeErrorResult(`Failed to spawn ${cli} for step: ${step}`);
      if (resultFile) fs.writeFileSync(resultFile, JSON.stringify(result));
      return 1;
    }

    // --- 4. ポーリングループ ---
    const pollResult = await pollOutput(child, outputFile, idleTimeout, maxTimeout, step);

    // --- 5. 結果抽出 ---
    const summary = extractSummary(outputFile, pollResult);

    if (resultFile) {
      try {
        fs.writeFileSync(resultFile, JSON.stringify(summary));
      } catch { /* no-op */ }
    }

    return summary.exit_code;
  }
}

// --- 内部ヘルパー ---

interface PollResult {
  exitCode: number;
  elapsed: number;
  timeoutType: "none" | "idle" | "max";
}

interface DispatchSummary {
  exit_code: number;
  elapsed: number;
  timeout_type: string;
  verdict: string | null;
  errors: string[];
  clarifications: string[];
}

function makeErrorResult(msg: string): DispatchSummary {
  return {
    exit_code: 1,
    elapsed: 0,
    timeout_type: "none",
    verdict: null,
    errors: [msg],
    clarifications: [],
  };
}

/**
 * CLI に応じて子プロセスを spawn する。
 * dispatch-step.sh L61-78 に対応。
 */
function spawnDispatch(
  cli: string,
  model: string,
  promptContent: string,
  projectDir: string,
  outputFile: string
): ReturnType<typeof spawn> {
  // output ファイルを初期化
  fs.writeFileSync(outputFile, "");
  const outFd = fs.openSync(outputFile, "a");

  let child: ReturnType<typeof spawn>;

  // CLAUDECODE 環境変数を除去（claude CLI の再帰防止）
  const env = { ...process.env };
  delete env["CLAUDECODE"];

  switch (cli) {
    case "opencode": {
      child = spawn(
        "opencode",
        ["run", "--model", model, "--format", "json", promptContent],
        { cwd: projectDir, env, stdio: ["ignore", outFd, outFd] }
      );
      break;
    }
    case "claude": {
      child = spawn(
        "claude",
        [
          "-p",
          "--model", model,
          "--no-session-persistence",
          "--output-format", "text",
          "--dangerously-skip-permissions",
        ],
        {
          cwd: projectDir,
          env,
          stdio: ["pipe", outFd, outFd],
        }
      );
      // stdin にプロンプトを書き込んで閉じる
      if (child.stdin) {
        child.stdin.write(promptContent);
        child.stdin.end();
      }
      break;
    }
    default:
      fs.closeSync(outFd);
      throw new Error(`Unknown CLI: ${cli}`);
  }

  // fd は子プロセス開始後に閉じる（子は引き継ぐ）
  child.once("spawn", () => {
    try { fs.closeSync(outFd); } catch { /* no-op */ }
  });
  // spawn イベントが来ない環境のフォールバック
  setTimeout(() => {
    try { fs.closeSync(outFd); } catch { /* no-op */ }
  }, 100);

  return child;
}

/**
 * 出力ファイルをポーリングして、アイドル・最大タイムアウトを管理する。
 * poll-dispatch.sh のポーリングループ全体に対応。
 */
async function pollOutput(
  child: ReturnType<typeof spawn>,
  outputFile: string,
  idleTimeout: number,
  maxTimeout: number,
  _step: string
): Promise<PollResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let lastSize = 0;
    let lastIdleTime = startTime;
    let outputStarted = false;
    let completionDetected = false;
    let completionGrace = 0;
    let settled = false;

    const finish = (exitCode: number, timeoutType: PollResult["timeoutType"]) => {
      if (settled) return;
      settled = true;
      clearInterval(ticker);
      child.kill();
      resolve({
        exitCode,
        elapsed: Math.floor((Date.now() - startTime) / 1000),
        timeoutType,
      });
    };

    child.once("close", (code) => {
      if (!settled && !completionDetected) {
        finish(code ?? 0, "none");
      }
    });

    const ticker = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);

      // 現在のファイルサイズを確認
      let currentSize = 0;
      try {
        currentSize = fs.statSync(outputFile).size;
      } catch { /* no-op */ }

      if (currentSize > lastSize) {
        outputStarted = true;
        lastIdleTime = now;

        // 新しいコンテンツを確認して完了シグナルを検出（opencode）
        try {
          const newContent = readNewContent(outputFile, lastSize);
          if (newContent.includes('"type":"step_finish"') && newContent.includes('"reason":"stop"')) {
            completionDetected = true;
          }
        } catch { /* no-op */ }

        lastSize = currentSize;
      }

      // opencode 完了シグナル検出後: 10s grace
      if (completionDetected) {
        completionGrace++;
        if (completionGrace >= 10) {
          child.kill();
          child.once("close", (code) => {
            if (!settled) finish(code ?? 0, "none");
          });
          // already killing
          return;
        }
      }

      // アイドルタイムアウト（output 開始後のみ）
      if (outputStarted && !completionDetected) {
        const idle = Math.floor((now - lastIdleTime) / 1000);
        if (idle >= idleTimeout) {
          finish(124, "idle");
          return;
        }
      }

      // 最大タイムアウト
      if (elapsed >= maxTimeout) {
        finish(124, "max");
        return;
      }
    }, 1000);
  });
}

/**
 * outputFile から lastOffset 以降の新しいコンテンツを読み取る。
 */
function readNewContent(outputFile: string, lastOffset: number): string {
  const fd = fs.openSync(outputFile, "r");
  const stat = fs.fstatSync(fd);
  const newSize = stat.size - lastOffset;
  if (newSize <= 0) {
    fs.closeSync(fd);
    return "";
  }
  const buf = Buffer.alloc(newSize);
  fs.readSync(fd, buf, 0, newSize, lastOffset);
  fs.closeSync(fd);
  return buf.toString("utf8");
}

/**
 * output ファイルから VERDICT / ERROR / CLARIFICATION を抽出してサマリーを生成する。
 * poll-dispatch.sh L147-188 に対応。
 */
function extractSummary(outputFile: string, pollResult: PollResult): DispatchSummary {
  let content = "";
  try {
    content = fs.readFileSync(outputFile, "utf8");
  } catch { /* no-op */ }

  // VERDICT 抽出（末尾80行から）
  const tail80 = content.split("\n").slice(-80).join("\n");
  const verdictMatch = /^v: (GO|CONDITIONAL|NO-GO)/m.exec(tail80);
  const verdict = verdictMatch?.[1] ?? null;

  // ERROR 抽出（テンプレートの false positive を除外）
  const errorMatches = [...content.matchAll(/\[ERROR: ([^\]]*)\]/g)];
  const errors = errorMatches
    .map((m) => m[0] ?? "")
    .filter((e) => !/<[^>]+>/.test(e) && e !== "[ERROR: description]");

  // CLARIFICATION 抽出
  const clarMatches = [...content.matchAll(/\[NEEDS CLARIFICATION: ([^\]]*)\]/g)];
  const clarifications = clarMatches
    .map((m) => m[0] ?? "")
    .filter((c) => !/<[^>]+>/.test(c) && c !== "[NEEDS CLARIFICATION: question]");

  return {
    exit_code: pollResult.exitCode,
    elapsed: pollResult.elapsed,
    timeout_type: pollResult.timeoutType,
    verdict,
    errors,
    clarifications,
  };
}

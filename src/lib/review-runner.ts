/**
 * review-runner.ts
 *
 * review-runner.sh の TypeScript 移植。
 * レビューループ（ペルソナ並列実行 → 集約 → 収束チェック → fixer）ドライバー。
 *
 * 主な変更点:
 * - bash サブプロセス → ReviewRunnerDeps 注入
 * - バックグラウンド並列実行 → Promise.allSettled
 * - JSONL stdout → emit コールバック
 * - review-setup.sh / review-aggregate.sh / review-log-update.sh は外部呼び出し維持
 *   （P2 移植範囲: review-runner 本体のみ。setup/aggregate は P2 後半で移植予定）
 *
 * code-trace.md §4 参照。
 */

import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";

import { dispatchWithRetry, type RetryOptions } from "./retry-helpers.js";
import type { Dispatcher, FileSystem } from "./interfaces.js";
import type { ReviewResult, ReviewVerdict, ReviewExitCode, PoorDevConfig } from "./types.js";

// --- 型定義 ---

export interface Persona {
  name: string;
  cli: string;
  model: string;
}

export interface ReviewSetup {
  maxIterations: number;
  nextId: number;
  logPath: string;
  idPrefix: string;
  depth: string;
  personas: Persona[];
  fixer: { agentName: string };
}

export interface AggregateResult {
  total: number;
  C: number;
  H: number;
  nextId: number;
  issuesFile: string;
  converged: boolean;
  verdicts: string;
}

export type ReviewEmitter = (event: unknown) => void;

export interface ReviewRunnerDeps {
  fileSystem: FileSystem;
  dispatcher: Dispatcher;
  config: PoorDevConfig | null;
}

// --- 定数 ---

const MAX_RETRIES_PER_PERSONA = 1;
const PROTECTED_DIRS_RE = /^(agents\/|commands\/|lib\/|\.poor-dev\/|\.opencode\/|\.claude\/)/;

// --- ヘルパー ---

/**
 * review-setup.sh を呼び出して ReviewSetup を取得する。
 * P2 移植範囲外 → 外部プロセス呼び出しを維持。
 */
function runReviewSetup(
  scriptDir: string,
  reviewType: string,
  targetFile: string,
  featureDir: string,
  projectDir: string
): ReviewSetup {
  const output = execFileSync(
    "bash",
    [
      path.join(scriptDir, "review-setup.sh"),
      "--type", reviewType,
      "--target", targetFile,
      "--feature-dir", featureDir,
      "--project-dir", projectDir,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );

  const json = JSON.parse(output) as {
    max_iterations: number;
    next_id: number;
    log_path: string;
    id_prefix: string;
    depth: string;
    personas: Array<{ name: string; cli: string; model: string }>;
    fixer: { agent_name: string };
  };

  return {
    maxIterations: json.max_iterations,
    nextId: json.next_id,
    logPath: json.log_path,
    idPrefix: json.id_prefix,
    depth: json.depth,
    personas: json.personas,
    fixer: { agentName: json.fixer.agent_name },
  };
}

/**
 * review-aggregate.sh を呼び出して集約結果を取得する。
 */
function runReviewAggregate(
  scriptDir: string,
  outputDir: string,
  logPath: string,
  idPrefix: string,
  nextId: number,
  reviewType: string
): AggregateResult {
  const output = execFileSync(
    "bash",
    [
      path.join(scriptDir, "review-aggregate.sh"),
      "--output-dir", outputDir,
      "--log", logPath,
      "--id-prefix", idPrefix,
      "--next-id", String(nextId),
      "--review-type", reviewType,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );

  const json = JSON.parse(output) as {
    total: number;
    C: number;
    H: number;
    next_id: number;
    issues_file: string;
    converged: boolean;
    verdicts: string;
  };

  return {
    total: json.total,
    C: json.C,
    H: json.H,
    nextId: json.next_id,
    issuesFile: json.issues_file,
    converged: json.converged,
    verdicts: json.verdicts,
  };
}

/**
 * review-log-update.sh を呼び出してログを更新する。
 */
function runReviewLogUpdate(
  scriptDir: string,
  logPath: string,
  issuesFile: string,
  verdicts: string,
  iteration: number,
  fixedIds: string
): void {
  const args = [
    path.join(scriptDir, "review-log-update.sh"),
    "--log", logPath,
    "--issues-file", issuesFile,
    "--verdicts", verdicts,
    "--iteration", String(iteration),
  ];
  if (fixedIds) {
    args.push("--fixed", fixedIds);
  }
  try {
    execFileSync("bash", args, { stdio: "pipe" });
  } catch { /* no-op */ }
}

/**
 * コマンドファイルを解決する（variant 優先チェーン）。
 * review-runner.sh L105-125 に対応。
 */
function resolvePersonaCommandFile(
  projectDir: string,
  personaName: string,
  cmdVariant: string | undefined,
  fileSystem: Pick<FileSystem, "exists">
): string | null {
  const candidates: string[] = [];
  if (cmdVariant) {
    candidates.push(
      path.join(projectDir, "commands", `poor-dev.${personaName}-${cmdVariant}.md`),
      path.join(projectDir, ".opencode/command", `poor-dev.${personaName}-${cmdVariant}.md`)
    );
  }
  candidates.push(
    path.join(projectDir, "commands", `poor-dev.${personaName}.md`),
    path.join(projectDir, ".opencode/command", `poor-dev.${personaName}.md`)
  );
  return candidates.find((c) => fileSystem.exists(c)) ?? null;
}

/**
 * エージェントファイルを解決する。
 * review-runner.sh L126-135 に対応。
 */
function resolveAgentFile(
  projectDir: string,
  agentName: string,
  fileSystem: Pick<FileSystem, "exists">
): string | null {
  const candidates = [
    path.join(projectDir, "agents/opencode", `${agentName}.md`),
    path.join(projectDir, "agents/claude", `${agentName}.md`),
    path.join(projectDir, ".opencode/agents", `${agentName}.md`),
    path.join(projectDir, ".claude/agents", `${agentName}.md`),
  ];
  return candidates.find((c) => fileSystem.exists(c)) ?? null;
}

/**
 * compose-prompt.sh を呼び出してプロンプトを生成する。
 */
function composePrompt(
  scriptDir: string,
  sourceFile: string,
  promptFile: string,
  contextFiles: Record<string, string>
): boolean {
  const args = [
    path.join(scriptDir, "compose-prompt.sh"),
    sourceFile,
    promptFile,
    "--header", "non_interactive",
  ];
  for (const [key, val] of Object.entries(contextFiles)) {
    args.push("--context", `${key}=${val}`);
  }
  try {
    execFileSync("bash", args, { stdio: "pipe" });
    return fs.existsSync(promptFile);
  } catch {
    return false;
  }
}

/**
 * ターゲットファイルの実装ファイル一覧を取得する（ディレクトリの場合）。
 * review-runner.sh L147-157 に対応。
 */
function collectImplFiles(targetFile: string): string[] {
  if (!fs.existsSync(targetFile)) return [];
  if (!fs.statSync(targetFile).isDirectory()) return [targetFile];

  const results: string[] = [];
  const implExts = /\.(html|js|ts|css|py)$/;

  function walk(d: string, depth: number) {
    if (depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "_runs") continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && implExts.test(entry.name)) {
        results.push(full);
        if (results.length >= 20) return;
      }
    }
  }

  walk(targetFile, 1);
  return results.slice(0, 20);
}

// --- ペルソナ並列ディスパッチ ---

type PersonaDispatchResult =
  | { personaName: string; success: true; outputFile?: string }
  | { personaName: string; success: false };

async function dispatchPersona(
  persona: Persona,
  projectDir: string,
  fd: string,
  targetFile: string,
  logPath: string,
  cmdVariant: string | undefined,
  idleTimeout: number,
  maxTimeout: number,
  outputDir: string,
  dispatcher: Dispatcher,
  fileSystem: FileSystem,
  config: PoorDevConfig | null,
  scriptDir: string
): Promise<PersonaDispatchResult> {
  const { name: personaName } = persona;

  // コマンドファイル解決
  const commandFile = resolvePersonaCommandFile(projectDir, personaName, cmdVariant, fileSystem);
  if (!commandFile) {
    return { personaName, success: false };
  }

  // エージェントファイル解決（あれば優先）
  const agentFile = resolveAgentFile(projectDir, personaName, fileSystem);
  const sourceFile = agentFile ?? commandFile;

  // コンテキスト構築
  const ctxFiles: Record<string, string> = {};

  const implFiles = collectImplFiles(targetFile);
  if (!fs.statSync(targetFile).isDirectory()) {
    // 単一ファイル
    if (implFiles[0]) ctxFiles["target"] = implFiles[0];
  } else {
    // ディレクトリ: 実装ファイルを個別に追加
    implFiles.forEach((f, i) => {
      ctxFiles[`impl_${i + 1}`] = f;
    });
  }

  const specFile = path.join(fd, "spec.md");
  if (fileSystem.exists(specFile)) ctxFiles["spec"] = specFile;
  if (fileSystem.exists(logPath)) ctxFiles["review_log"] = logPath;

  // プロンプト生成
  const promptFile = `/tmp/poor-dev-prompt-${personaName}-${process.pid}.txt`;
  const composed = composePrompt(scriptDir, sourceFile, promptFile, ctxFiles);
  if (!composed) {
    return { personaName, success: false };
  }

  // ディスパッチ (max_retries=1)
  const resultFile = path.join(outputDir, `${personaName}-result.json`);
  const retryOpts: RetryOptions = {
    config: config?.retry ?? {},
    maxRetriesOverride: MAX_RETRIES_PER_PERSONA,
  };

  const { exitCode } = await dispatchWithRetry(
    personaName, projectDir, promptFile,
    idleTimeout, maxTimeout, resultFile,
    dispatcher, fileSystem,
    retryOpts
  );

  // プロンプトクリーンアップ
  fileSystem.removeFile(promptFile);

  // output ファイルを outputDir にコピー
  let outputFile: string | undefined;
  if (exitCode === 0) {
    const pattern = `/tmp/poor-dev-output-${personaName}-`;
    try {
      const tmpFiles = fs.readdirSync("/tmp")
        .filter((f) => f.startsWith(`poor-dev-output-${personaName}-`) && f.endsWith(".txt"))
        .map((f) => ({ f: path.join("/tmp", f), mt: fs.statSync(path.join("/tmp", f)).mtimeMs }))
        .sort((a, b) => b.mt - a.mt);
      if (tmpFiles[0]) {
        const destFile = path.join(outputDir, `${personaName}.txt`);
        fs.copyFileSync(tmpFiles[0].f, destFile);
        outputFile = destFile;
      }
    } catch { /* no-op */ }
    void pattern;
  }

  if (exitCode === 0) {
    return outputFile !== undefined
      ? { personaName, success: true, outputFile }
      : { personaName, success: true };
  }
  return { personaName, success: false };
}

// --- ReviewRunner ---

export class ReviewRunner {
  private readonly deps: ReviewRunnerDeps;

  constructor(deps: ReviewRunnerDeps) {
    this.deps = deps;
  }

  /**
   * レビューループを実行する。
   * review-runner.sh のメインフロー全体に対応。
   *
   * exit code 意味:
   *   0 = GO / CONDITIONAL (収束)
   *   1 = error
   *   2 = NO-GO (not converged)
   *   3 = rate-limit (all personas failed)
   */
  async run(
    reviewType: string,
    targetFile: string,
    featureDir: string,
    projectDir: string,
    emit: ReviewEmitter = console.log
  ): Promise<ReviewResult> {
    const { fileSystem, dispatcher, config } = this.deps;
    const scriptDir = path.join(projectDir, "lib");
    const fd = path.join(projectDir, featureDir);

    const idleTimeout = config?.polling?.idle_timeout ?? 120;
    const personaTimeout =
      config?.polling?.step_timeouts?.[reviewType]?.max_timeout ??
      config?.polling?.max_timeout ??
      300;
    const personaIdleTimeout =
      config?.polling?.step_timeouts?.[reviewType]?.idle_timeout ??
      idleTimeout;

    const cmdVariant = config?.command_variant;

    emit({ review: reviewType, status: "setup" });

    // --- Step 0: Setup ---

    let setup: ReviewSetup;
    try {
      setup = runReviewSetup(scriptDir, reviewType, targetFile, featureDir, projectDir);
    } catch (err) {
      emit({ review: reviewType, status: "error", reason: String(err) });
      return { verdict: "NO-GO", iterations: 0, converged: false, exitCode: 1 };
    }

    let nextId = setup.nextId;
    const logPath = setup.logPath;

    emit({
      review: reviewType,
      status: "initialized",
      depth: setup.depth,
      max_iterations: setup.maxIterations,
    });

    // --- Main loop ---

    let iter = 0;
    let converged = false;
    let finalVerdict: ReviewVerdict = "NO-GO";
    let fixedIds = "";

    while (iter < setup.maxIterations) {
      iter++;
      emit({ review: reviewType, iteration: iter, status: "starting" });

      // --- Step 1: ペルソナ並列ディスパッチ ---

      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `review-personas-${process.pid}-`));

      const personaPromises = setup.personas.map((persona) =>
        dispatchPersona(
          persona,
          projectDir,
          fd,
          targetFile,
          logPath,
          cmdVariant,
          personaIdleTimeout,
          personaTimeout,
          outputDir,
          dispatcher,
          fileSystem,
          config,
          scriptDir
        )
      );

      const personaResults = await Promise.allSettled(personaPromises);

      let failedCount = 0;
      for (const result of personaResults) {
        if (result.status === "rejected" || !result.value.success) {
          failedCount++;
          const name =
            result.status === "fulfilled"
              ? result.value.personaName
              : "unknown";
          emit({ review: reviewType, persona: name, status: "failed" });
        }
      }

      // 全ペルソナ失敗 → rate limit の可能性
      if (failedCount === setup.personas.length && setup.personas.length > 0) {
        emit({
          review: reviewType,
          status: "all-failed",
          possible_rate_limit: true,
        });
        fileSystem.removeDir(outputDir);
        return { verdict: "NO-GO", iterations: iter, converged: false, exitCode: 3 };
      }

      const succeededCount = setup.personas.length - failedCount;
      emit({
        review: reviewType,
        iteration: iter,
        status: "personas_complete",
        succeeded: succeededCount,
        failed: failedCount,
      });

      // --- Step 2: Aggregate ---

      let agg: AggregateResult;
      try {
        agg = runReviewAggregate(
          scriptDir, outputDir, logPath, setup.idPrefix, nextId, reviewType
        );
      } catch (err) {
        emit({ review: reviewType, status: "error", reason: `aggregate failed: ${String(err)}` });
        fileSystem.removeDir(outputDir);
        return { verdict: "NO-GO", iterations: iter, converged: false, exitCode: 1 };
      }

      nextId = agg.nextId;

      emit({
        review: reviewType,
        iteration: iter,
        status: "aggregated",
        total: agg.total,
        C: agg.C,
        H: agg.H,
        verdicts: agg.verdicts,
      });

      // --- Step 3: ログ更新 ---

      runReviewLogUpdate(
        scriptDir, logPath, agg.issuesFile, agg.verdicts, iter, fixedIds
      );
      fixedIds = "";

      // --- Step 4: 収束チェック ---

      if (agg.converged) {
        converged = true;
        finalVerdict = "GO";
        emit({ review: reviewType, iteration: iter, status: "converged", verdict: "GO" });
        fileSystem.removeDir(outputDir);
        break;
      }

      if (iter >= setup.maxIterations) {
        finalVerdict = agg.C > 0 ? "NO-GO" : "CONDITIONAL";
        emit({
          review: reviewType,
          iteration: iter,
          status: "max_iterations",
          verdict: finalVerdict,
        });
        fileSystem.removeDir(outputDir);
        break;
      }

      // --- Step 5: Fixer ディスパッチ ---

      emit({ review: reviewType, iteration: iter, status: "fixing", issues: agg.total });

      const fixerResult = await this.dispatchFixer(
        reviewType,
        projectDir,
        fd,
        targetFile,
        logPath,
        agg.issuesFile,
        setup.fixer.agentName,
        cmdVariant,
        personaIdleTimeout,
        personaTimeout,
        dispatcher,
        fileSystem,
        config,
        scriptDir,
        emit,
        iter
      );

      if (fixerResult.fixedIds) {
        fixedIds = fixerResult.fixedIds;
      }

      fileSystem.removeDir(outputDir);
    }

    // --- 終了 ---

    const exitCode: ReviewExitCode =
      finalVerdict === "NO-GO" ? 2 : 0;

    emit({
      review: reviewType,
      status: "complete",
      verdict: finalVerdict,
      iterations: iter,
      converged,
    });

    return { verdict: finalVerdict, iterations: iter, converged, exitCode };
  }

  // =========================================================
  // Fixer ディスパッチ (Step 5)
  // review-runner.sh L264-330 に対応
  // =========================================================

  private async dispatchFixer(
    reviewType: string,
    projectDir: string,
    fd: string,
    targetFile: string,
    logPath: string,
    issuesFile: string,
    fixerAgentName: string,
    cmdVariant: string | undefined,
    idleTimeout: number,
    maxTimeout: number,
    dispatcher: Dispatcher,
    fileSystem: FileSystem,
    config: PoorDevConfig | null,
    scriptDir: string,
    emit: ReviewEmitter,
    iter: number
  ): Promise<{ fixedIds: string }> {
    // fixer コマンドファイル解決
    const fixCmdCandidates: string[] = [
      path.join(projectDir, "commands", "poor-dev.review-fixer.md"),
      path.join(projectDir, ".opencode/command", "poor-dev.review-fixer.md"),
    ];
    const fixCmdFile = fixCmdCandidates.find((c) => fileSystem.exists(c));

    // fixer エージェントファイル解決
    const fixAgentFile = resolveAgentFile(projectDir, fixerAgentName, fileSystem);

    const sourceFile = fixAgentFile ?? fixCmdFile;
    if (!sourceFile) {
      emit({
        review: reviewType,
        iteration: iter,
        warning: "fixer command/agent file not found",
      });
      return { fixedIds: "" };
    }

    // コンテキスト構築
    const ctxFiles: Record<string, string> = {};
    if (fileSystem.exists(issuesFile)) ctxFiles["issues"] = issuesFile;

    const implFiles = collectImplFiles(targetFile);
    if (!fs.statSync(targetFile).isDirectory()) {
      if (implFiles[0]) ctxFiles["target"] = implFiles[0];
    } else {
      implFiles.forEach((f, i) => {
        ctxFiles[`impl_${i + 1}`] = f;
      });
    }

    const specFile = path.join(fd, "spec.md");
    if (fileSystem.exists(specFile)) ctxFiles["spec"] = specFile;
    if (fileSystem.exists(logPath)) ctxFiles["review_log"] = logPath;

    // プロンプト生成
    const fixPromptFile = `/tmp/poor-dev-prompt-fixer-${process.pid}.txt`;
    const composed = composePrompt(scriptDir, sourceFile, fixPromptFile, ctxFiles);

    if (!composed) {
      emit({ review: reviewType, iteration: iter, warning: "fixer prompt composition failed" });
      return { fixedIds: "" };
    }

    // ディスパッチ (max_retries=1)
    const fixResultFile = `/tmp/poor-dev-result-fixer-${process.pid}.json`;
    const retryOpts: RetryOptions = {
      config: config?.retry ?? {},
      maxRetriesOverride: MAX_RETRIES_PER_PERSONA,
    };

    const { exitCode } = await dispatchWithRetry(
      "fixer", projectDir, fixPromptFile,
      idleTimeout, maxTimeout, fixResultFile,
      dispatcher, fileSystem,
      retryOpts
    );

    fileSystem.removeFile(fixPromptFile);
    fileSystem.removeFile(fixResultFile);

    if (exitCode !== 0) {
      emit({ review: reviewType, iteration: iter, warning: "fixer dispatch failed" });
      return { fixedIds: "" };
    }

    // ISSUES_FILE から全 issue ID を収集（次回イテレーションのログ用）
    let fixedIds = "";
    try {
      if (fileSystem.exists(issuesFile)) {
        const content = fileSystem.readFile(issuesFile);
        fixedIds = content
          .split("\n")
          .filter(Boolean)
          .map((line) => line.split("|")[0] ?? "")
          .filter(Boolean)
          .join(",");
      }
    } catch { /* no-op */ }

    return { fixedIds };
  }
}

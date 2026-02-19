/**
 * pipeline-runner.ts
 *
 * pipeline-runner.sh の TypeScript 移植。
 * パイプライン全ステップを逐次実行するオーケストレーター。
 *
 * 主な変更点:
 * - グローバル変数 → PipelineRunnerOptions への明示的な引数
 * - JSONL stdout → emit コールバック経由
 * - bash サブプロセス → インターフェース注入
 * - EXIT code → RunResult オブジェクト
 *
 * code-trace.md §1 参照。
 */

import path from "node:path";
import fs from "node:fs";
import { dispatchWithRetry, type RetryOptions } from "./retry-helpers.js";
import type { GitOps, FileSystem, Dispatcher, PipelineStateManager } from "./interfaces.js";
import type { PipelineState, PoorDevConfig, TaskPhase } from "./types.js";
import { composePrompt as composePromptTs } from "./compose-prompt.js";
import { extractOutput } from "./extract-output.js";
import { validateTasks } from "./tasks-validate.js";
import { ReviewRunner } from "./review-runner.js";

// --- 型定義 ---

export interface PipelineRunnerOptions {
  flow: string;
  featureDir: string;
  branch: string;
  projectDir: string;
  completed?: string[];
  summary?: string;
  inputFile?: string;
  nextMode?: boolean;
}

export type PipelineRunnerExitCode = 0 | 1 | 2 | 3;

export interface RunResult {
  exitCode: PipelineRunnerExitCode;
  events: unknown[];
}

export type EventEmitter = (event: unknown) => void;

// --- 定数 ---

const FLOW_STEPS: Record<string, string[]> = {
  feature: [
    "specify",
    "suggest",
    "plan",
    "planreview",
    "tasks",
    "tasksreview",
    "implement",
    "architecturereview",
    "qualityreview",
    "phasereview",
  ],
  bugfix: ["bugfix"],
  roadmap: ["concept", "goals", "milestones", "roadmap"],
  "discovery-init": ["discovery"],
  "discovery-rebuild": ["rebuildcheck"],
  investigation: ["investigate"],
};

const CONDITIONAL_STEPS = new Set(["bugfix", "rebuildcheck"]);
const REVIEW_STEPS = new Set([
  "planreview",
  "tasksreview",
  "architecturereview",
  "qualityreview",
  "phasereview",
]);

const IMPL_EXTENSIONS = [
  "html", "htm", "js", "ts", "jsx", "tsx", "mjs", "cjs",
  "css", "scss", "sass", "less", "py", "rb", "go", "rs",
  "java", "kt", "swift", "c", "cpp", "h", "sql", "vue", "svelte",
];

const PROTECTED_DIRS_RE = /^(agents\/|commands\/|lib\/|\.poor-dev\/|\.opencode\/|\.claude\/)/;

// --- ヘルパー関数 ---

/**
 * get_pipeline_steps() に対応。
 */
function getFlowSteps(flow: string): string[] | null {
  return FLOW_STEPS[flow] ?? null;
}

/**
 * is_conditional() に対応。
 */
function isConditional(step: string): boolean {
  return CONDITIONAL_STEPS.has(step);
}

/**
 * is_review() に対応。
 */
function isReview(step: string): boolean {
  return REVIEW_STEPS.has(step);
}

/**
 * parse_tasks_phases() に対応。
 * "## Phase N: Title" パターンを解析してフェーズリストを返す。
 */
export function parseTasksPhases(content: string): TaskPhase[] {
  const lines = content.split("\n");
  const phases: TaskPhase[] = [];
  const phaseRe = /^##\s+Phase\s+(\d+):\s*(.*)/;
  let prev: { phaseNum: number; phaseName: string; startLine: number } | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const lineNum = idx + 1;
    const match = phaseRe.exec(line);
    if (match) {
      const phaseNum = parseInt(match[1]!, 10);
      const phaseName = (match[2] ?? "").trim();
      if (prev !== null) {
        phases.push({
          phaseNum: prev.phaseNum,
          phaseName: prev.phaseName,
          startLine: prev.startLine,
          endLine: lineNum - 1,
        });
      }
      prev = { phaseNum, phaseName, startLine: lineNum };
    }
  }

  if (prev !== null) {
    phases.push({
      phaseNum: prev.phaseNum,
      phaseName: prev.phaseName,
      startLine: prev.startLine,
      endLine: lines.length,
    });
  }

  return phases;
}

/**
 * check_rate_limit() に対応。
 * opencode ログファイルからレートリミット件数を取得。
 */
function checkRateLimit(): number {
  const logDir = path.join(process.env["HOME"] ?? "", ".local/share/opencode/log");
  if (!fs.existsSync(logDir)) return 0;
  try {
    const logs = fs
      .readdirSync(logDir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => ({ f, mt: fs.statSync(path.join(logDir, f)).mtimeMs }))
      .sort((a, b) => b.mt - a.mt);
    const latest = logs[0];
    if (!latest) return 0;
    const content = fs.readFileSync(path.join(logDir, latest.f), "utf8");
    const matches = content.match(/Rate limit|rate_limit|rate limit/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

/**
 * validate_no_impl_files() に対応。
 * implement 以外のステップが実装ファイルを生成した場合に削除する。
 *
 * ★既知バグ防止ロジック★
 * eccb536: implement 再入時に implement_phases_completed をチェックしてスキップ。
 * code-trace.md §8 Bug 2 参照。
 */
export function validateNoImplFiles(
  fd: string,
  step: string,
  fileSystem: Pick<FileSystem, "exists" | "removeFile" | "readdir">
): string | null {
  const found: string[] = [];
  for (const ext of IMPL_EXTENSIONS) {
    // glob相当: find fd -maxdepth 3 -name "*.ext" -type f
    const globResults = globImplFiles(fd, ext, 3, fileSystem);
    for (const f of globResults) {
      // インフラディレクトリはスキップ
      const rel = path.relative(fd, f);
      if (/\/(lib|node_modules|_runs|commands|agents)\//.test("/" + rel)) continue;
      found.push(f);
    }
  }

  if (found.length === 0) return null;

  for (const f of found) {
    fileSystem.removeFile(f);
  }
  const basenames = found.map((f) => path.basename(f)).join(" ");
  return JSON.stringify({
    warning: `Step '${step}' generated impl files — deleted`,
    files: basenames,
  });
}

/** find コマンド相当の実装（Gap-2: FileSystem インターフェース経由） */
function globImplFiles(
  dir: string,
  ext: string,
  maxDepth: number,
  fileSystem: Pick<FileSystem, "readdir">
): string[] {
  const results: string[] = [];
  function walk(d: string, depth: number) {
    if (depth > maxDepth) return;
    const entries = fileSystem.readdir(d);
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory) {
        walk(full, depth + 1);
      } else if (entry.isFile && entry.name.endsWith(`.${ext}`)) {
        results.push(full);
      }
    }
  }
  walk(dir, 1);
  return results;
}

/**
 * protect_sources() に対応。
 * implement 後に tooling ファイルが変更されていた場合に git checkout で復元。
 */
function protectSources(projectDir: string, gitOps: GitOps): string | null {
  if (!gitOps.hasGitDir(projectDir)) return null;
  let changed: string;
  try {
    changed = gitOps.git(projectDir, ["diff", "--name-only", "HEAD"]);
  } catch {
    return null;
  }
  const toRestore = changed
    .split("\n")
    .filter((f) => f && PROTECTED_DIRS_RE.test(f));
  if (toRestore.length === 0) return null;

  try {
    gitOps.git(projectDir, ["checkout", "HEAD", "--", ...toRestore]);
    return JSON.stringify({
      warning:
        "Protected files were modified by implement step and have been restored",
      files: toRestore.join(" "),
    });
  } catch {
    return null;
  }
}

/**
 * check_prerequisites() に対応。
 */
function checkPrerequisites(
  step: string,
  fd: string,
  fileSystem: Pick<FileSystem, "exists">
): string | null {
  switch (step) {
    case "suggest":
      if (!fileSystem.exists(path.join(fd, "spec.md")))
        return "missing prerequisite: spec.md";
      break;
    case "plan":
      if (!fileSystem.exists(path.join(fd, "spec.md")))
        return "missing prerequisite: spec.md";
      break;
    case "tasks":
      if (
        !fileSystem.exists(path.join(fd, "plan.md")) ||
        !fileSystem.exists(path.join(fd, "spec.md"))
      )
        return "missing prerequisite: plan.md and/or spec.md";
      break;
    case "implement":
      if (
        !fileSystem.exists(path.join(fd, "tasks.md")) ||
        !fileSystem.exists(path.join(fd, "spec.md"))
      )
        return "missing prerequisite: tasks.md and/or spec.md";
      break;
  }
  return null;
}

/**
 * resolve_step_timeout() に対応。
 */
function resolveStepTimeout(
  config: PoorDevConfig | null,
  step: string,
  field: "idle_timeout" | "max_timeout",
  defaultVal: number
): number {
  const st = config?.polling?.step_timeouts?.[step];
  if (st && typeof st[field] === "number") return st[field];
  return defaultVal;
}

/**
 * コマンドファイルを解決する（variant 優先チェーン）。
 */
function resolveCommandFile(
  projectDir: string,
  step: string,
  cmdVariant: string | undefined,
  fileSystem: Pick<FileSystem, "exists">
): string | null {
  const candidates: string[] = [];
  if (cmdVariant) {
    candidates.push(
      path.join(projectDir, "commands", `poor-dev.${step}-${cmdVariant}.md`),
      path.join(projectDir, ".opencode/command", `poor-dev.${step}-${cmdVariant}.md`)
    );
  }
  candidates.push(
    path.join(projectDir, "commands", `poor-dev.${step}.md`),
    path.join(projectDir, ".opencode/command", `poor-dev.${step}.md`)
  );
  return candidates.find((c) => fileSystem.exists(c)) ?? null;
}

/**
 * context_args_for_step() に対応。
 * ステップごとのコンテキストファイルパスを返す。
 */
function contextArgsForStep(
  step: string,
  fd: string,
  fileSystem: Pick<FileSystem, "exists" | "readdir">
): Record<string, string> {
  const ctx: Record<string, string> = {};
  const has = (f: string) => fileSystem.exists(path.join(fd, f));

  switch (step) {
    case "specify":
      if (has("input.txt")) ctx["input"] = path.join(fd, "input.txt");
      break;
    case "suggest":
      if (has("spec.md")) ctx["spec"] = path.join(fd, "spec.md");
      break;
    case "plan":
      if (has("spec.md")) ctx["spec"] = path.join(fd, "spec.md");
      if (has("suggestions.yaml")) ctx["suggestions"] = path.join(fd, "suggestions.yaml");
      break;
    case "tasks":
      if (has("plan.md")) ctx["plan"] = path.join(fd, "plan.md");
      if (has("spec.md")) ctx["spec"] = path.join(fd, "spec.md");
      break;
    case "implement":
      if (has("tasks.md")) ctx["tasks"] = path.join(fd, "tasks.md");
      if (has("plan.md")) ctx["plan"] = path.join(fd, "plan.md");
      break;
    default:
      if (step.startsWith("planreview")) {
        if (has("plan.md")) ctx["plan"] = path.join(fd, "plan.md");
        if (has("spec.md")) ctx["spec"] = path.join(fd, "spec.md");
      } else if (step.startsWith("tasksreview")) {
        if (has("tasks.md")) ctx["tasks"] = path.join(fd, "tasks.md");
        if (has("spec.md")) ctx["spec"] = path.join(fd, "spec.md");
        if (has("plan.md")) ctx["plan"] = path.join(fd, "plan.md");
      } else if (
        step.startsWith("architecturereview") ||
        step.startsWith("qualityreview") ||
        step.startsWith("phasereview")
      ) {
        if (has("spec.md")) ctx["spec"] = path.join(fd, "spec.md");
        const reviewLogType = path.join(fd, `review-log-${step}.yaml`);
        const reviewLogGeneric = path.join(fd, "review-log.yaml");
        if (fileSystem.exists(reviewLogType)) ctx["review_log"] = reviewLogType;
        else if (fileSystem.exists(reviewLogGeneric)) ctx["review_log"] = reviewLogGeneric;
        // Bug-2 fix: implement ステップが生成した実装ファイルをコンテキストに追加
        const MAX_IMPL_CTX = 20;
        let implIdx = 1;
        outer: for (const ext of IMPL_EXTENSIONS) {
          for (const f of globImplFiles(fd, ext, 3, fileSystem)) {
            if (implIdx > MAX_IMPL_CTX) break outer;
            ctx[`impl_${implIdx}`] = f;
            implIdx++;
          }
        }
      } else if (step === "bugfix") {
        if (has("bug-report.md")) ctx["bug_report"] = path.join(fd, "bug-report.md");
      } else if (["concept", "goals", "milestones", "roadmap"].includes(step)) {
        if (has("spec.md")) ctx["spec"] = path.join(fd, "spec.md");
      }
  }
  return ctx;
}

// --- PipelineRunner クラス ---

export interface PipelineRunnerDeps {
  gitOps: GitOps;
  fileSystem: FileSystem;
  stateManager: PipelineStateManager;
  dispatcher: Dispatcher;
  config: PoorDevConfig | null;
}

export class PipelineRunner {
  private readonly deps: PipelineRunnerDeps;

  constructor(deps: PipelineRunnerDeps) {
    this.deps = deps;
  }

  /**
   * パイプラインを実行する。
   * pipeline-runner.sh のメインフロー全体に対応。
   */
  async run(
    opts: PipelineRunnerOptions,
    emit: EventEmitter = console.log
  ): Promise<RunResult> {
    const { gitOps, fileSystem, stateManager, dispatcher, config } = this.deps;
    const events: unknown[] = [];

    const emitEvent = (e: unknown) => {
      events.push(e);
      emit(e);
    };

    // --- 初期化 ---

    const projectDir = path.resolve(opts.projectDir);

    // .git 存在確認（parent repo fallthrough 防止）
    if (!gitOps.hasGitDir(projectDir)) {
      emitEvent({
        error: "FATAL: .git not found in project_dir. Aborting to prevent parent repo fallthrough.",
        project_dir: projectDir,
      });
      return { exitCode: 1, events };
    }

    const fd = path.join(projectDir, opts.featureDir);
    const stateFile = path.join(fd, "pipeline-state.json");
    const configFile = path.join(projectDir, ".poor-dev/config.json");

    const idleTimeout = config?.polling?.idle_timeout ?? 120;
    const maxTimeout = config?.polling?.max_timeout ?? 600;
    const cmdVariant = config?.command_variant;

    // --- COMPLETED_SET 構築 ---

    const completedSet = new Set<string>(opts.completed ?? []);

    // pipeline-state.json から resume 検出
    let savedState: PipelineState | null = null;
    if (fileSystem.exists(stateFile)) {
      savedState = stateManager.read(stateFile);
      for (const s of savedState.completed ?? []) {
        completedSet.add(s);
      }
      // awaiting-approval → resume 時に clear
      if (savedState.status === "awaiting-approval") {
        stateManager.clearApproval(stateFile);
      }
    }

    // IMPLEMENT_COMPLETED フラグ
    let implementCompleted = completedSet.has("implement");

    // --- PIPELINE_STEPS 解決 ---

    let pipelineSteps: string[];
    if (
      savedState?.pipeline &&
      Array.isArray(savedState.pipeline) &&
      savedState.pipeline.length > 0
    ) {
      pipelineSteps = savedState.pipeline;
    } else {
      const flowSteps = getFlowSteps(opts.flow);
      if (!flowSteps) {
        emitEvent({ error: `Unknown flow: ${opts.flow}` });
        return { exitCode: 1, events };
      }
      pipelineSteps = flowSteps;
    }

    // pipeline-state.json 初期化（存在しない場合のみ）
    if (!fileSystem.exists(stateFile)) {
      stateManager.init(stateFile, opts.flow, pipelineSteps);
    }

    let stepCount = 0;
    let totalSteps = pipelineSteps.length;

    // --- --next モード ---

    if (opts.nextMode) {
      const nextStep = pipelineSteps.find((s) => !completedSet.has(s));
      if (!nextStep) {
        stateManager.setStatus(stateFile, "completed");
        emitEvent({
          status: "pipeline_complete",
          flow: opts.flow,
          steps_completed: totalSteps,
        });
        return { exitCode: 0, events };
      }
      const nextIdx = pipelineSteps.indexOf(nextStep);
      stepCount = nextIdx;
      pipelineSteps = [nextStep];
    }

    // --- メインディスパッチループ ---

    for (const step of pipelineSteps) {
      stepCount++;

      // スキップ
      if (completedSet.has(step)) {
        emitEvent({ step, status: "skipped", reason: "already completed" });
        continue;
      }

      // 前提チェック
      const prereqError = checkPrerequisites(step, fd, fileSystem);
      if (prereqError) {
        emitEvent({ step, error: prereqError });
        return { exitCode: 1, events };
      }

      // unresolved clarifications 警告
      if (
        step === "suggest" &&
        fileSystem.exists(path.join(fd, "pending-clarifications.json"))
      ) {
        emitEvent({
          step,
          warning: "unresolved clarifications exist in pending-clarifications.json",
        });
      }

      emitEvent({ step, status: "starting", progress: `${stepCount}/${totalSteps}` });

      // =========================================================
      // implement ブランチ: phase-split または通常 dispatch
      // =========================================================

      if (step === "implement") {
        // ★Bug 2 防止ガード (eccb536)★
        // implement 再入時に既存フェーズ成果物を消さないよう、
        // implement_phases_completed が空の場合のみ validate を実行。
        // code-trace.md §8 Bug 2 参照。
        const currentState = fileSystem.exists(stateFile)
          ? stateManager.read(stateFile)
          : null;
        const implPhasesCompleted = currentState?.implement_phases_completed ?? [];

        if (implPhasesCompleted.length === 0) {
          const cleanup = validateNoImplFiles(fd, "pre-implement", fileSystem);
          if (cleanup) emitEvent(JSON.parse(cleanup));
        }

        // フェーズ分割 dispatch 試行
        const phaseResult = await this.dispatchImplementPhases(
          fd, projectDir, opts.featureDir, opts.branch,
          opts.summary ?? "", stepCount, totalSteps,
          stateFile, configFile, cmdVariant,
          idleTimeout, maxTimeout, config,
          emitEvent
        );

        if (phaseResult !== null) {
          if (phaseResult.exitCode !== 0) return phaseResult;

          // フェーズ成功 → protect + complete
          const protection = protectSources(projectDir, gitOps);
          if (protection) emitEvent(JSON.parse(protection));

          stateManager.completeStep(stateFile, step);
          implementCompleted = true;
          emitEvent({
            step,
            status: "step_complete",
            progress: `${stepCount}/${totalSteps}`,
            mode: "phase-split",
          });
          completedSet.add(step);
          continue;
        }

        // フォールバック: tasks.md にフェーズがない → 通常 dispatch に続行
        emitEvent({ step, status: "fallback", reason: "no phases in tasks.md" });
      }

      // =========================================================
      // review ブランチ (bash mode)
      // =========================================================

      if (isReview(step)) {
        const reviewMode = config?.review_mode ?? "llm";

        if (reviewMode === "bash") {
          // review-runner.ts (bash-driven mode) を呼び出す
          const reviewTargets: Record<string, string> = {
            planreview: path.join(fd, "plan.md"),
            tasksreview: path.join(fd, "tasks.md"),
          };
          const reviewTarget = reviewTargets[step] ?? fd;

          emitEvent({ step, status: "review-bash", mode: "bash" });

          const reviewRunner = new ReviewRunner({
            fileSystem,
            dispatcher,
            config,
            gitOps,
          });

          let reviewResult;
          try {
            reviewResult = await reviewRunner.run(
              step, reviewTarget, opts.featureDir, projectDir, emitEvent
            );
          } catch {
            reviewResult = { exitCode: 1 as const, verdict: "NO-GO" as const, iterations: 0, converged: false };
          }

          if (reviewResult.exitCode === 3) {
            stateManager.setStatus(stateFile, "rate-limited", `Rate limit at review ${step}`);
            return { exitCode: 3, events };
          }
          if (reviewResult.exitCode === 2) {
            stateManager.setStatus(stateFile, "paused", `NO-GO verdict at ${step}`);
            emitEvent({ action: "pause", step, reason: "NO-GO verdict" });
            return { exitCode: 2, events };
          }
          if (reviewResult.exitCode !== 0) {
            emitEvent({ step, warning: `review-runner exited with code ${reviewResult.exitCode}` });
          }

          stateManager.completeStep(stateFile, step);
          completedSet.add(step);
          emitEvent({ step, status: "step_complete", progress: `${stepCount}/${totalSteps}`, mode: "bash" });
          continue;
        }
      }

      // =========================================================
      // コマンドファイル解決 + dispatch
      // =========================================================

      const commandFile = resolveCommandFile(projectDir, step, cmdVariant, fileSystem);
      if (!commandFile) {
        emitEvent({ step, error: `Command file not found: poor-dev.${step}.md` });
        return { exitCode: 1, events };
      }

      // プロンプトファイル生成（compose-prompt.sh は外部プロセスとして呼び出し）
      const promptFile = `/tmp/poor-dev-prompt-${step}-${process.pid}.txt`;
      const resultFile = `/tmp/poor-dev-result-${step}-${process.pid}.json`;

      const stepIdleTimeout = resolveStepTimeout(config, step, "idle_timeout", idleTimeout);
      const stepMaxTimeout = resolveStepTimeout(config, step, "max_timeout", maxTimeout);

      // compose-prompt.sh 呼び出し
      this.composePrompt(
        commandFile, promptFile, step,
        fd, opts.featureDir, opts.branch, opts.summary ?? "",
        stepCount, totalSteps, config, fileSystem, emitEvent
      );

      if (!fileSystem.exists(promptFile)) {
        emitEvent({ step, error: "compose-prompt.sh failed to generate prompt file" });
        return { exitCode: 1, events };
      }

      // implement step のリトライ前フック (git cleanup)
      const retryOpts: RetryOptions = {
        config: config?.retry ?? {},
        rateLimitChecker: checkRateLimit,
        stateManager,
        stateFile,
      };
      if (step === "implement") {
        retryOpts.preRetryHook = async () => {
          if (gitOps.hasGitDir(projectDir)) {
            try { gitOps.git(projectDir, ["checkout", "--", "."]); } catch { /* no-op */ }
            try { gitOps.git(projectDir, ["clean", "-fd", "--exclude=specs/"]); } catch { /* no-op */ }
          }
        };
      }

      const { exitCode: dispatchExit } = await dispatchWithRetry(
        step, projectDir, promptFile, stepIdleTimeout, stepMaxTimeout, resultFile,
        dispatcher, fileSystem,
        retryOpts
      );

      // クリーンアップ
      fileSystem.removeFile(promptFile);

      if (dispatchExit !== 0) {
        const rateCount = checkRateLimit();
        if (rateCount > 0) {
          stateManager.setStatus(stateFile, "rate-limited", `Rate limit at step ${step}`);
          emitEvent({ step, status: "rate-limited", rate_limit_count: rateCount });
          fileSystem.removeFile(resultFile);
          return { exitCode: 3, events };
        }
        emitEvent({ step, status: "error", exit_code: dispatchExit });
        fileSystem.removeFile(resultFile);
        return { exitCode: 1, events };
      }

      // --- 結果ファイル読み込み ---

      interface DispatchResult {
        exit_code?: number;
        errors?: string[];
        timeout_type?: string;
        verdict?: string | null;
        clarifications?: string[];
      }
      let dispatchResult: DispatchResult = {};
      try {
        if (fileSystem.exists(resultFile)) {
          dispatchResult = JSON.parse(fileSystem.readFile(resultFile)) as DispatchResult;
        }
      } catch { /* no-op */ }
      fileSystem.removeFile(resultFile);

      // エラー / タイムアウトチェック
      if ((dispatchResult.errors?.length ?? 0) > 0) {
        emitEvent({ step, status: "error", errors: dispatchResult.errors });
        return { exitCode: 1, events };
      }
      if (dispatchResult.timeout_type && dispatchResult.timeout_type !== "none") {
        emitEvent({ step, status: "timeout", timeout_type: dispatchResult.timeout_type });
        return { exitCode: 1, events };
      }

      // --- 出力抽出 (specify/suggest/plan/tasks → アーティファクトファイル) ---

      const outputFile = `/tmp/poor-dev-output-${step}-${process.pid}.txt`;
      const outputArtifacts: Record<string, string> = {
        specify: path.join(fd, "spec.md"),
        suggest: path.join(fd, "suggestions.yaml"),
        plan: path.join(fd, "plan.md"),
        tasks: path.join(fd, "tasks.md"),
      };
      const saveTo = outputArtifacts[step];

      // conditional step 処理のために出力ファイルを先読みしておく
      let rawOutputContent = "";
      if (isConditional(step) && fileSystem.exists(outputFile)) {
        try { rawOutputContent = fileSystem.readFile(outputFile); } catch { /* no-op */ }
      }

      if (saveTo && fileSystem.exists(outputFile)) {
        const extractResult = extractOutput(outputFile, saveTo);
        if (extractResult.status !== "ok") {
          fileSystem.removeFile(outputFile);
          emitEvent({ step, status: "error", reason: "output extraction failed", detail: extractResult.error ?? "unknown" });
          return { exitCode: 1, events };
        }
      }
      fileSystem.removeFile(outputFile);

      // --- 成果物バリデーション ---

      if (step === "specify" && !fileSystem.exists(path.join(fd, "spec.md"))) {
        emitEvent({ step: "specify", status: "error", reason: "spec.md not extracted" });
        return { exitCode: 1, events };
      }

      // tasks: フォーマットバリデーション
      if (step === "tasks" && fileSystem.exists(path.join(fd, "tasks.md"))) {
        const tasksContent = fileSystem.readFile(path.join(fd, "tasks.md"));
        const validation = validateTasks(tasksContent);
        if (!validation.valid) {
          emitEvent({ step: "tasks", warning: "tasks.md format validation failed", validation });
        }
      }

      // --- conditional step 処理 (bugfix/rebuildcheck) ---

      if (isConditional(step)) {
        switch (step) {
          case "bugfix": {
            const reclassifyMatch = /\[RECLASSIFY: ([A-Z]+)\]/.exec(rawOutputContent);
            const scaleMatch = /\[SCALE: ([A-Z]+)\]/.exec(rawOutputContent);
            const reclassify = reclassifyMatch?.[1] ?? "";
            const scale = scaleMatch?.[1] ?? "";

            if (reclassify === "FEATURE") {
              stateManager.setStatus(stateFile, "paused", "Reclassified as feature");
              emitEvent({ step, status: "reclassify", target: "feature" });
              return { exitCode: 2, events };
            } else if (scale === "SMALL") {
              const newPipeline = ["bugfix", "planreview", "implement", "qualityreview", "phasereview"];
              stateManager.setVariant(stateFile, "bugfix-small", { scale: "SMALL" });
              stateManager.setPipeline(stateFile, newPipeline);
              pipelineSteps = newPipeline;
              totalSteps = newPipeline.length;
            } else if (scale === "LARGE") {
              const newPipeline = ["bugfix", "plan", "planreview", "tasks", "tasksreview", "implement", "architecturereview", "qualityreview", "phasereview"];
              stateManager.setVariant(stateFile, "bugfix-large", { scale: "LARGE" });
              stateManager.setPipeline(stateFile, newPipeline);
              pipelineSteps = newPipeline;
              totalSteps = newPipeline.length;
            }
            break;
          }
          case "rebuildcheck": {
            const verdictMatch = /\[VERDICT: ([A-Z]+)\]/.exec(rawOutputContent);
            const rebuildVerdict = verdictMatch?.[1] ?? "";

            if (rebuildVerdict === "REBUILD") {
              const newPipeline = ["rebuildcheck", "harvest", "plan", "planreview", "tasks", "tasksreview", "implement", "architecturereview", "qualityreview", "phasereview"];
              stateManager.setVariant(stateFile, "discovery-rebuild", { verdict: "REBUILD" });
              stateManager.setPipeline(stateFile, newPipeline);
              pipelineSteps = newPipeline;
              totalSteps = newPipeline.length;
            } else if (rebuildVerdict === "CONTINUE") {
              stateManager.setVariant(stateFile, "discovery-continue", { verdict: "CONTINUE" });
              stateManager.setStatus(stateFile, "paused", "CONTINUE verdict");
              emitEvent({ step, status: "paused", verdict: "CONTINUE" });
              return { exitCode: 0, events };
            }
            break;
          }
        }
      }

      // --- review verdict 処理 (GO/CONDITIONAL/NO-GO) ---

      const verdict = dispatchResult.verdict;
      if (isReview(step) && verdict) {
        if (verdict === "NO-GO") {
          stateManager.setStatus(stateFile, "paused", `NO-GO verdict at ${step}`);
          emitEvent({ action: "pause", step, reason: "NO-GO verdict" });
          return { exitCode: 2, events };
        }
        if (verdict === "CONDITIONAL") {
          emitEvent({ step, status: "conditional", verdict: "CONDITIONAL" });
        }
      }

      // --- post-implement source protection ---

      if (step === "implement") {
        const protection = protectSources(projectDir, gitOps);
        if (protection) emitEvent(JSON.parse(protection));
        implementCompleted = true;
      }

      // --- L2: 非implement ステップの impl file validation ---

      if (step !== "implement" && !implementCompleted) {
        const cleanup = validateNoImplFiles(fd, step, fileSystem);
        if (cleanup) emitEvent(JSON.parse(cleanup));
      }

      // --- 状態更新 ---

      stateManager.completeStep(stateFile, step);
      completedSet.add(step);

      // --- clarification gate (after specify) ---

      const clarifications = dispatchResult.clarifications ?? [];
      if (step === "specify" && clarifications.length > 0) {
        fileSystem.writeFile(
          path.join(fd, "pending-clarifications.json"),
          JSON.stringify(clarifications, null, 2)
        );
        stateManager.setApproval(stateFile, "clarification", step);
        emitEvent({ step, status: "awaiting-approval", type: "clarification", count: clarifications.length });
        return { exitCode: 2, events };
      }

      // --- gate チェック (after-${step}) ---

      const autoApprove = config?.auto_approve ?? false;
      const gateKey = `after-${step}`;
      if (config?.gates?.[gateKey] && !autoApprove) {
        stateManager.setApproval(stateFile, "gate", step);
        emitEvent({ action: "gate", step, gate: gateKey });
        return { exitCode: 2, events };
      }

      emitEvent({
        step,
        status: "step_complete",
        progress: `${stepCount}/${totalSteps}`,
      });
    }

    // --- 終了 ---

    if (opts.nextMode) {
      return { exitCode: 0, events };
    }

    stateManager.setStatus(stateFile, "completed");
    emitEvent({
      status: "pipeline_complete",
      flow: opts.flow,
      steps_completed: totalSteps,
    });
    return { exitCode: 0, events };
  }

  // =========================================================
  // フェーズ分割 implement ディスパッチ
  // dispatch_implement_phases() に対応
  // =========================================================

  private async dispatchImplementPhases(
    fd: string,
    projectDir: string,
    featureDir: string,
    branch: string,
    summary: string,
    stepCount: number,
    totalSteps: number,
    stateFile: string,
    configFile: string,
    cmdVariant: string | undefined,
    idleTimeout: number,
    maxTimeout: number,
    config: PoorDevConfig | null,
    emit: EventEmitter
  ): Promise<RunResult | null> {
    const { gitOps, fileSystem, stateManager, dispatcher } = this.deps;

    const tasksFile = path.join(fd, "tasks.md");
    if (!fileSystem.exists(tasksFile)) return null;

    const tasksContent = fileSystem.readFile(tasksFile);
    const phases = parseTasksPhases(tasksContent);

    if (phases.length === 0) {
      emit({ implement: "fallback", reason: "no phases found in tasks.md" });
      return null;
    }

    emit({ implement: "phase-split", phase_count: phases.length });

    // 完了済みフェーズを pipeline-state.json から取得
    const currentState = fileSystem.exists(stateFile)
      ? stateManager.read(stateFile)
      : null;
    const completedPhases = new Set(currentState?.implement_phases_completed ?? []);

    const implIdleTimeout = resolveStepTimeout(config, "implement", "idle_timeout", idleTimeout);
    const implMaxTimeout = resolveStepTimeout(config, "implement", "max_timeout", maxTimeout);

    for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
      const phase = phases[phaseIdx]!;
      const { phaseNum, phaseName } = phase;
      const phaseKey = `phase_${phaseNum}`;
      const displayIdx = phaseIdx + 1;

      // resume: 完了済みフェーズをスキップ
      if (completedPhases.has(phaseKey)) {
        emit({
          phase: phaseNum,
          name: phaseName,
          status: "skipped",
          reason: "already completed",
        });
        continue;
      }

      emit({
        phase: phaseNum,
        name: phaseName,
        status: "starting",
        progress: `${displayIdx}/${phases.length}`,
      });

      // コマンドファイル解決
      const commandFile = resolveCommandFile(projectDir, "implement", cmdVariant, fileSystem);
      if (!commandFile) {
        emit({ implement: "error", reason: "implement command file not found" });
        return { exitCode: 1, events: [] };
      }

      // Phase Scope Directive コンテキストファイル生成
      const promptFile = `/tmp/poor-dev-prompt-implement-phase${phaseNum}-${process.pid}.txt`;
      const phaseCtxFile = `/tmp/poor-dev-phase-scope-${phaseNum}-${process.pid}.txt`;
      const pipelineCtxFile = `/tmp/poor-dev-pipeline-ctx-implement-phase${phaseNum}-${process.pid}.txt`;

      fileSystem.writeFile(
        phaseCtxFile,
        [
          `## Phase Scope Directive`,
          `You are executing ONLY Phase ${phaseNum}: ${phaseName}.`,
          `- Execute ONLY the uncompleted tasks (- [ ]) under "## Phase ${phaseNum}:"`,
          `- Do NOT execute tasks from other phases`,
          `- Mark completed tasks with [X] in tasks.md`,
        ].join("\n")
      );

      fileSystem.writeFile(
        pipelineCtxFile,
        [
          `- FEATURE_DIR: ${featureDir}`,
          `- BRANCH: ${branch}`,
          `- Feature: ${summary}`,
          `- Step: implement phase ${phaseNum}/${phases.length} (${stepCount}/${totalSteps})`,
        ].join("\n")
      );

      // compose-prompt.sh 呼び出し
      const ctxArgs: Record<string, string> = {
        phase_scope: phaseCtxFile,
        pipeline: pipelineCtxFile,
      };
      if (fileSystem.exists(path.join(fd, "tasks.md")))
        ctxArgs["tasks"] = path.join(fd, "tasks.md");
      if (fileSystem.exists(path.join(fd, "plan.md")))
        ctxArgs["plan"] = path.join(fd, "plan.md");

      this.runComposePrompt(commandFile, promptFile, "non_interactive", ctxArgs);

      // pre-phase HEAD 記録（★Bug 1 防止: コミット済み差分を正確に検出するため）
      let prePhaseHead = "";
      if (gitOps.hasGitDir(projectDir)) {
        try {
          prePhaseHead = gitOps.git(projectDir, ["rev-parse", "HEAD"]);
        } catch { /* no-op */ }
      }

      // ★Bug 1 防止: _impl_phase_pre_retry は git clean で未追跡ファイルを削除するため、
      // 前フェーズのコミット状態を確認してから実行する必要がある。
      // code-trace.md §8 Bug 1 参照。
      const preRetryHook = async () => {
        if (gitOps.hasGitDir(projectDir)) {
          try { gitOps.git(projectDir, ["checkout", "--", "."]); } catch { /* no-op */ }
          try { gitOps.git(projectDir, ["clean", "-fd", "--exclude=specs/"]); } catch { /* no-op */ }
        }
      };

      const resultFile = `/tmp/poor-dev-result-implement-phase${phaseNum}-${process.pid}.json`;
      const { exitCode: dispatchExit } = await dispatchWithRetry(
        "implement", projectDir, promptFile,
        implIdleTimeout, implMaxTimeout, resultFile,
        dispatcher, fileSystem,
        {
          config: config?.retry ?? {},
          preRetryHook,
          rateLimitChecker: checkRateLimit,
          stateManager,
          stateFile,
        }
      );

      // クリーンアップ
      fileSystem.removeFile(promptFile);
      fileSystem.removeFile(phaseCtxFile);
      fileSystem.removeFile(pipelineCtxFile);
      fileSystem.removeFile(resultFile);

      if (dispatchExit !== 0) {
        const rateCount = checkRateLimit();
        if (rateCount > 0) {
          stateManager.setStatus(
            stateFile,
            "rate-limited",
            `Rate limit at implement phase ${phaseNum}`
          );
          emit({ phase: phaseNum, status: "rate-limited", rate_limit_count: rateCount });
          return { exitCode: 3, events: [] };
        }
        emit({ phase: phaseNum, status: "error", exit_code: dispatchExit });
        return { exitCode: 1, events: [] };
      }

      // post-phase: protect_sources
      const protection = protectSources(projectDir, gitOps);
      if (protection) emit(JSON.parse(protection));

      // 生成ファイル検出 + コミット
      const phaseFiles = this.detectPhaseFiles(projectDir, prePhaseHead, gitOps);
      if (phaseFiles.length === 0) {
        emit({ phase: phaseNum, warning: "no new files detected after phase completion" });
      } else {
        this.commitPhaseArtifacts(projectDir, phaseNum, phaseName, phaseFiles, gitOps, emit);
      }

      // フェーズ状態更新
      stateManager.addImplementPhase(stateFile, phaseKey);

      emit({
        phase: phaseNum,
        name: phaseName,
        status: "complete",
        progress: `${displayIdx}/${phases.length}`,
      });
    }

    return { exitCode: 0, events: [] };
  }

  /**
   * フェーズ完了後の生成ファイルを検出する。
   * code-trace.md §2-2 参照。
   */
  private detectPhaseFiles(
    projectDir: string,
    prePhaseHead: string,
    gitOps: GitOps
  ): string[] {
    if (!gitOps.hasGitDir(projectDir)) return [];

    const fileSet = new Set<string>();

    // コミット済み差分
    if (prePhaseHead) {
      try {
        const diffCommitted = gitOps.git(projectDir, [
          "diff", "--name-only", prePhaseHead, "HEAD",
        ]);
        diffCommitted.split("\n").filter(Boolean).forEach((f) => fileSet.add(f));
      } catch { /* no-op */ }
    }

    // 未コミット差分（staged + unstaged）
    try {
      gitOps.git(projectDir, ["diff", "--name-only"])
        .split("\n").filter(Boolean).forEach((f) => fileSet.add(f));
    } catch { /* no-op */ }
    try {
      gitOps.git(projectDir, ["diff", "--name-only", "--cached"])
        .split("\n").filter(Boolean).forEach((f) => fileSet.add(f));
    } catch { /* no-op */ }

    // 保護ディレクトリを除外
    return [...fileSet].filter((f) => f && !PROTECTED_DIRS_RE.test(f));
  }

  /**
   * フェーズ成果物を git commit する。
   * code-trace.md §2-2 L548-553 に対応。
   */
  private commitPhaseArtifacts(
    projectDir: string,
    phaseNum: number,
    phaseName: string,
    _phaseFiles: string[],
    gitOps: GitOps,
    emit: EventEmitter
  ): void {
    if (!gitOps.hasGitDir(projectDir)) return;

    try {
      gitOps.git(projectDir, ["add", "-A"]);
      gitOps.git(projectDir, [
        "reset", "HEAD", "--",
        "agents/", "commands/", "lib/", ".poor-dev/", ".opencode/", ".claude/",
      ]);
      gitOps.git(projectDir, [
        "commit",
        "-m", `implement: phase ${phaseNum} - ${phaseName}`,
        "--no-verify",
      ]);
    } catch {
      emit({
        phase: phaseNum,
        warning: `git commit failed for phase ${phaseNum}, artifacts remain uncommitted`,
      });
    }
  }

  /**
   * compose-prompt.ts を呼び出してプロンプトファイルを生成する。
   * compose-prompt.sh から TS 版に移行済み。
   */
  private composePrompt(
    commandFile: string,
    promptFile: string,
    step: string,
    fd: string,
    featureDir: string,
    branch: string,
    summary: string,
    stepCount: number,
    totalSteps: number,
    _config: PoorDevConfig | null,
    fileSystem: Pick<FileSystem, "exists" | "writeFile" | "readdir" | "removeFile">,
    emit: EventEmitter
  ): void {
    const headers = ["non_interactive"];
    if (step === "specify") headers.push("readonly");

    // コンテキストファイル収集
    const ctxArgs = contextArgsForStep(step, fd, fileSystem);

    // pipeline メタデータコンテキスト
    const pipelineCtxFile = `/tmp/poor-dev-pipeline-ctx-${step}-${process.pid}.txt`;
    fileSystem.writeFile(
      pipelineCtxFile,
      [
        `- FEATURE_DIR: ${featureDir}`,
        `- BRANCH: ${branch}`,
        `- Feature: ${summary}`,
        `- Step: ${step} (${stepCount}/${totalSteps})`,
      ].join("\n")
    );
    ctxArgs["pipeline"] = pipelineCtxFile;

    const result = composePromptTs({
      commandFile,
      outputFile: promptFile,
      headers,
      contexts: ctxArgs,
    });

    // 一時ファイルをクリーンアップ
    try { fileSystem.removeFile(pipelineCtxFile); } catch { /* no-op */ }

    if (!result.success) {
      emit({ step, warning: `compose-prompt failed: ${result.error ?? "unknown"}` });
    }
  }

  /** compose-prompt.ts の最小ラッパー（フェーズ向け） */
  private runComposePrompt(
    commandFile: string,
    promptFile: string,
    header: string,
    contextFiles: Record<string, string>
  ): void {
    composePromptTs({
      commandFile,
      outputFile: promptFile,
      headers: [header],
      contexts: contextFiles,
    });
  }
}

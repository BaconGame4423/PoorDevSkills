import type {
  MonitorOptions,
  MonitorResult,
  Phase0Config,
  TeamStallCheckConfig,
  TeamStallState,
  StalledTask,
} from "./types.js";
import { capturePaneContent, pasteBuffer, sendKeys } from "./tmux.js";
import { respondToPhase0 } from "./phase0-responder.js";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

function loadPhase0Config(configPath: string): Phase0Config {
  const content = readFileSync(configPath, "utf-8");
  return JSON.parse(content) as Phase0Config;
}

/**
 * Find pipeline-state.json file.
 * Search order: features subdirs, _runs/ subdirs (team mode), .poor-dev/, then comboDir root.
 */
function findPipelineState(comboDir: string): string | null {
  // 1. features/*/
  const featuresDir = path.join(comboDir, "features");
  if (existsSync(featuresDir)) {
    for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = path.join(featuresDir, entry.name, "pipeline-state.json");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  // 2. _runs/*/ (team mode) — skip archived dirs (those with _git-log.txt)
  const runsDir = path.join(comboDir, "_runs");
  if (existsSync(runsDir)) {
    for (const entry of readdirSync(runsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const runSubDir = path.join(runsDir, entry.name);
      if (existsSync(path.join(runSubDir, "_git-log.txt")) || existsSync(path.join(runSubDir, "_archived"))) continue;
      const candidate = path.join(runSubDir, "pipeline-state.json");
      if (existsSync(candidate)) return candidate;
      // Also check nested feature dirs (e.g., _runs/<ts>/features/<name>/)
      const featDir = path.join(runSubDir, "features");
      if (existsSync(featDir)) {
        for (const sub of readdirSync(featDir, { withFileTypes: true })) {
          if (!sub.isDirectory()) continue;
          const nested = path.join(featDir, sub.name, "pipeline-state.json");
          if (existsSync(nested)) return nested;
        }
      }
    }
  }
  // 3. .poor-dev/
  const legacyPath = path.join(comboDir, ".poor-dev", "pipeline-state.json");
  if (existsSync(legacyPath)) return legacyPath;
  // 4. root
  const directPath = path.join(comboDir, "pipeline-state.json");
  if (existsSync(directPath)) return directPath;
  return null;
}

function checkPipelineState(comboDir: string): {
  complete: boolean;
  error: boolean;
} {
  const statePath = findPipelineState(comboDir);
  if (!statePath) {
    return { complete: false, error: false };
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    const state = JSON.parse(content) as {
      status?: string;
      current?: string | null;
      completed?: string[];
    };

    if (state.status === "completed") {
      return { complete: true, error: false };
    }
    if (state.status === "error") {
      return { complete: false, error: true };
    }
    if (state.current === null && state.completed && state.completed.length > 0) {
      return { complete: true, error: false };
    }

    return { complete: false, error: false };
  } catch {
    return { complete: false, error: false };
  }
}

export interface PipelineInfo {
  flow: string;
  current: string | null;
  completed: string[];
  pipeline: string[];
  stateDir: string;
}

export function readPipelineInfo(comboDir: string): PipelineInfo | null {
  const statePath = findPipelineState(comboDir);
  if (!statePath) return null;
  try {
    const content = readFileSync(statePath, "utf-8");
    const state = JSON.parse(content) as {
      flow?: string;
      current?: string | null;
      completed?: string[];
      pipeline?: string[];
    };
    const stateDir = path.relative(comboDir, path.dirname(statePath));
    return {
      flow: state.flow ?? "feature",
      current: state.current ?? null,
      completed: state.completed ?? [],
      pipeline: state.pipeline ?? [],
      stateDir: stateDir || ".",
    };
  } catch {
    return null;
  }
}

export function buildRecoveryMessage(info: PipelineInfo): string {
  return [
    `[MONITOR] TUI idle but pipeline incomplete (current: ${info.current}, ${info.completed.length}/${info.pipeline.length} steps done).`,
    `Resume: node .poor-dev/dist/bin/poor-dev-next.js --flow ${info.flow} --state-dir ${info.stateDir} --project-dir .`,
    `Parse JSON output and execute the action per poor-dev.team Core Loop.`,
  ].join("\n");
}

function hasArtifacts(comboDir: string): boolean {
  const findOpts = `-maxdepth 4 -type f \\( -name "*.html" -o -name "*.js" -o -name "*.css" \\) ` +
    `-not -path '*/lib/*' -not -path '*/.poor-dev/*' -not -path '*/commands/*' -not -path '*/.git/*'`;
  try {
    // Pass 1: combo root (excluding _runs/ — fast path)
    const rootFiles = execSync(
      `find "${comboDir}" ${findOpts} -not -path '*/_runs/*'`,
      { encoding: "utf-8" }
    ).trim();
    if (rootFiles) return true;

    // Pass 2: non-archived _runs/ subdirs only
    const runsDir = path.join(comboDir, "_runs");
    if (existsSync(runsDir)) {
      for (const entry of readdirSync(runsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const runSubDir = path.join(runsDir, entry.name);
        if (existsSync(path.join(runSubDir, "_git-log.txt")) || existsSync(path.join(runSubDir, "_archived"))) continue;
        const subFiles = execSync(
          `find "${runSubDir}" ${findOpts}`,
          { encoding: "utf-8" }
        ).trim();
        if (subFiles) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function discoverTeamTaskDirs(basePath?: string, createdAfter?: number): string[] {
  const dir = basePath ?? path.join(os.homedir(), ".claude", "tasks");
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => {
        if (!e.isDirectory()) return false;
        if (createdAfter !== undefined) {
          try {
            const stat = statSync(path.join(dir, e.name));
            const birthTime = stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs;
            if (birthTime < createdAfter) return false;
          } catch {
            return false;
          }
        }
        return true;
      })
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

export function findStalledTasks(
  taskDir: string,
  thresholdMs: number,
): StalledTask[] {
  const results: StalledTask[] = [];
  try {
    const files = readdirSync(taskDir) as unknown as string[];
    for (const file of files) {
      if (!String(file).endsWith(".json")) continue;
      const filePath = path.join(taskDir, String(file));
      try {
        const content = readFileSync(filePath, "utf-8");
        const task = JSON.parse(content) as {
          status?: string;
          subject?: string;
          owner?: string;
          id?: string;
        };
        if (task.status !== "in_progress") continue;
        const stat = statSync(filePath);
        const stalledSinceMs = Date.now() - stat.mtimeMs;
        if (stalledSinceMs > thresholdMs) {
          results.push({
            taskId: task.id ?? String(file),
            subject: task.subject ?? "",
            owner: task.owner ?? "",
            stalledSinceMs,
            fileMtime: stat.mtimeMs,
          });
        }
      } catch {
        // Skip files that fail to parse (race condition with writes)
      }
    }
  } catch {
    // Return empty on error
  }
  return results;
}

export function sendNudgeToOrchestrator(
  pane: string,
  tasks: StalledTask[],
  teamName: string,
): void {
  const lines = tasks.map(
    (t) =>
      `  - Task #${t.taskId} "${t.subject}" (owner: ${t.owner}, stalled ${Math.floor(t.stalledSinceMs / 60_000)}min)`,
  );
  const message = [
    `[MONITOR] Team "${teamName}" has stalled teammates:`,
    ...lines,
    "Please SendMessage ping to stalled teammates or consider respawning them.",
  ].join("\n");
  pasteBuffer(pane, "monitor-nudge", message);
  sendKeys(pane, "Enter");
}

/**
 * Check if the TUI pane is showing a selection UI (AskUserQuestion).
 * Selection UI has ❯ as a cursor indicator, NOT as an input prompt.
 */
function isSelectionUIActive(content: string): boolean {
  return content.includes("Enter to select")
    || content.includes("↑/↓ to navigate")
    || /❯\s*\d+\./.test(content);
}

/**
 * Check if the TUI is truly idle (showing ❯ input prompt, NOT a selection UI or streaming).
 * Claude Code always shows ❯ at the bottom — even during active processing.
 * Distinguish by checking for streaming indicators:
 * - "esc to int" (truncated "esc to interrupt") only appears during active streaming
 *   (shortened from "esc to inter" for truncate resilience in narrow panes)
 * - "⎿  Running" appears when Bash tool is executing (e.g., glm -p long-running command)
 * - Selection UI means AskUserQuestion is displayed
 */
function isTUIIdle(content: string): boolean {
  if (!content.includes("❯")) return false;
  if (isSelectionUIActive(content)) return false;
  // "esc to int" (truncated) only appears during active streaming/processing
  if (content.includes("esc to int")) return false;
  // Bash tool execution in progress (e.g., glm -p long-running command)
  if (content.includes("⎿  Running")) return false;
  return true;
}

export async function runMonitor(options: MonitorOptions): Promise<MonitorResult> {
  const logs: string[] = [];
  const startTime = Date.now();

  let phase0Config: Phase0Config;
  try {
    phase0Config = loadPhase0Config(options.phase0ConfigPath);
  } catch (e) {
    return {
      exitReason: "pipeline_error",
      elapsedSeconds: 0,
      combo: options.combo,
      logs: [`Failed to load phase0 config: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  let turnCount = 0;
  let phase0Done = false;
  let lastPipelineCheck = 0;
  let lastIdleCheck = 0;
  let consecutiveIdleCount = 0;
  let lastKnownStep = "";
  let recoveryAttempts = 0;

  const intervalMs = 10_000;
  const pipelineCheckIntervalMs = 10_000;
  const idleCheckStartMs = 120_000;
  const idleCheckIntervalMs = 60_000;
  const phase0TimeoutMs = 600_000;
  // Recovery thresholds: only send recovery after sustained idle on same step
  const idleCountBeforeRecovery = 3;   // 3 consecutive idle checks (3 min)
  const maxRecoveryAttempts = 2;
  const idleCountBeforeExit = 6;       // 6 consecutive idle checks (6 min)

  // Team stall detection state
  let lastTeamStallCheck = 0;
  const teamStallCheckIntervalMs = 60_000;
  const teamStallStates = new Map<string, TeamStallState>();
  const stallConfig: TeamStallCheckConfig = {
    stallThresholdMs: 300_000,
    graceAfterNudgeMs: 120_000,
    maxNudges: 3,
  };

  while (true) {
    const elapsed = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsed / 1000);

    if (elapsedSeconds >= options.timeoutSeconds) {
      return {
        exitReason: "timeout",
        elapsedSeconds,
        combo: options.combo,
        logs: [...logs, `Timeout after ${elapsedSeconds}s`],
      };
    }

    // capturePaneContent throws if pane no longer exists
    let paneContent: string;
    try {
      paneContent = capturePaneContent(options.targetPane);
    } catch {
      return {
        exitReason: "pane_lost",
        elapsedSeconds,
        combo: options.combo,
        logs: [...logs, "Pane no longer exists"],
      };
    }

    try {
      if (!phase0Done) {
        // Phase 0 timeout: force transition after 10 minutes
        if (elapsed >= phase0TimeoutMs) {
          phase0Done = true;
          logs.push(`Phase 0 timeout after ${Math.floor(elapsed / 1000)}s`);
        // pipeline-state.json existence = pipeline started = phase 0 is done
        } else if (findPipelineState(options.comboDir) !== null) {
          phase0Done = true;
          logs.push("Phase 0 done: pipeline-state.json detected");
        } else {
          const result = respondToPhase0(options.targetPane, phase0Config, turnCount, paneContent);
          turnCount = result.turnCount;
          if (result.done) {
            phase0Done = true;
            logs.push(`Phase 0 max turns reached (${turnCount})`);
          }
          if (result.responded) {
            logs.push(`Phase 0 response sent (turn ${turnCount})`);
          }
        }
      }

      // Permission prompts should not occur with --dangerously-skip-permissions
      if (paneContent.includes("Permission required")) {
        logs.push("Permission prompt detected (unexpected)");
      }

      if (elapsed - lastPipelineCheck >= pipelineCheckIntervalMs) {
        lastPipelineCheck = elapsed;
        const pipelineState = checkPipelineState(options.comboDir);

        if (pipelineState.error) {
          return {
            exitReason: "pipeline_error",
            elapsedSeconds,
            combo: options.combo,
            logs: [...logs, "Pipeline error detected"],
          };
        }

        if (pipelineState.complete) {
          logs.push("Pipeline completed");
          if (options.postCommand) {
            process.stderr.write(`[monitor] ${options.combo} post-processing started: ${options.postCommand}\n`);
            try {
              logs.push(`Running post-processing: ${options.postCommand}`);
              const postOutput = execSync(options.postCommand, {
                encoding: "utf-8",
                timeout: 600_000,
                cwd: options.projectRoot,
              });
              logs.push(`Post-processing complete: ${postOutput.slice(0, 500)}`);
              process.stderr.write(`[monitor] ${options.combo} post-processing complete\n`);
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              logs.push(`Post-processing failed: ${errMsg}`);
              process.stderr.write(`[monitor] ${options.combo} post-processing FAILED: ${errMsg}\n`);
            }
          }
          return { exitReason: "pipeline_complete", elapsedSeconds, combo: options.combo, logs };
        }
      }

      if (elapsed >= idleCheckStartMs && elapsed - lastIdleCheck >= idleCheckIntervalMs) {
        lastIdleCheck = elapsed;

        if (isTUIIdle(paneContent)) {
          const pipelineInfo = readPipelineInfo(options.comboDir);
          const pipelineComplete = pipelineInfo === null
            || pipelineInfo.current === null
            || checkPipelineState(options.comboDir).complete;

          if (pipelineComplete) {
            if (hasArtifacts(options.comboDir)) {
              return {
                exitReason: "tui_idle",
                elapsedSeconds,
                combo: options.combo,
                logs: [...logs, "TUI idle with artifacts present"],
              };
            }
            logs.push("TUI idle but no artifacts yet");
          } else {
            // Track if pipeline step has progressed — reset idle counter if so
            const currentStep = pipelineInfo?.current ?? "";
            if (currentStep !== lastKnownStep) {
              lastKnownStep = currentStep;
              consecutiveIdleCount = 0;
              recoveryAttempts = 0; // Fresh recovery budget for each new step
            } else {
              // In team mode, check if teammates are actively working.
              // If active team tasks exist, don't count idle (orchestrator is waiting for teammates).
              let hasActiveTeamTasks = false;
              if (options.enableTeamStallDetection) {
                const taskDirs = discoverTeamTaskDirs(undefined, startTime);
                for (const dir of taskDirs) {
                  const stalled = findStalledTasks(dir, stallConfig.stallThresholdMs);
                  try {
                    const allJsonFiles = readdirSync(dir).filter(f => String(f).endsWith(".json"));
                    const inProgressCount = allJsonFiles.length - stalled.length;
                    if (inProgressCount > 0) {
                      hasActiveTeamTasks = true;
                      break;
                    }
                  } catch { /* ignore */ }
                }
              }

              if (hasActiveTeamTasks) {
                // Teammates working — don't accumulate idle count
                if (consecutiveIdleCount > 0) {
                  logs.push(`Idle reset: active team tasks found for step "${currentStep}"`);
                  consecutiveIdleCount = 0;
                }
              } else {
                consecutiveIdleCount++;
                if (consecutiveIdleCount >= idleCountBeforeExit) {
                  logs.push(`Pipeline stuck at "${currentStep}" for ${consecutiveIdleCount} idle cycles, giving up`);
                  return {
                    exitReason: "tui_idle",
                    elapsedSeconds,
                    combo: options.combo,
                    logs,
                  };
                } else if (consecutiveIdleCount >= idleCountBeforeRecovery && recoveryAttempts < maxRecoveryAttempts) {
                  recoveryAttempts++;
                  const msg = buildRecoveryMessage(pipelineInfo);
                  pasteBuffer(options.targetPane, "monitor-recovery", msg);
                  sendKeys(options.targetPane, "Enter");
                  logs.push(`Recovery #${recoveryAttempts} sent (current: ${currentStep}, idle cycles: ${consecutiveIdleCount})`);
                }
              }
            }
          }
        } else {
          consecutiveIdleCount = 0;
        }
      }

      // Team stall detection
      if (options.enableTeamStallDetection && phase0Done && elapsed >= 180_000) {
        if (elapsed - lastTeamStallCheck >= teamStallCheckIntervalMs) {
          lastTeamStallCheck = elapsed;
          const taskDirs = discoverTeamTaskDirs(undefined, startTime);
          for (const dir of taskDirs) {
            const teamName = path.basename(dir);
            const stalledTasks = findStalledTasks(dir, stallConfig.stallThresholdMs);
            if (stalledTasks.length === 0) {
              teamStallStates.delete(teamName);
              continue;
            }
            const existing = teamStallStates.get(teamName);
            if (existing) {
              // Check grace period
              if (Date.now() - existing.lastNudgeAt < stallConfig.graceAfterNudgeMs) continue;
              if (existing.nudgeCount >= stallConfig.maxNudges) {
                logs.push(`[stall] ${teamName}: max nudges (${stallConfig.maxNudges}) reached, deferring to global timeout`);
                continue;
              }
              existing.nudgeCount++;
              existing.lastNudgeAt = Date.now();
              existing.stalledTasks = stalledTasks;
              sendNudgeToOrchestrator(options.targetPane, stalledTasks, teamName);
              logs.push(`[stall] Nudge #${existing.nudgeCount} sent for ${teamName}`);
            } else {
              teamStallStates.set(teamName, {
                teamName,
                nudgeCount: 1,
                lastNudgeAt: Date.now(),
                stalledTasks,
              });
              sendNudgeToOrchestrator(options.targetPane, stalledTasks, teamName);
              logs.push(`[stall] First nudge sent for ${teamName}`);
            }
          }
        }
      }
    } catch (e) {
      logs.push(`Monitor loop error: ${e instanceof Error ? e.message : String(e)}`);
      return {
        exitReason: "pipeline_error",
        elapsedSeconds,
        combo: options.combo,
        logs,
      };
    }

    // Intermediate status on stderr for visibility
    let stepLabel = "unknown";
    if (phase0Done) {
      const info = readPipelineInfo(options.comboDir);
      if (info) stepLabel = `${info.current ?? "done"}(${info.completed.length}/${info.pipeline.length})`;
    }
    const dbgParts = [`phase0=${phase0Done ? "done" : "active"}`, `step=${stepLabel}`];
    if (!phase0Done) {
      const lastLines = paneContent.split("\n").slice(-5).map(l => l.trim()).filter(l => l.length > 0);
      dbgParts.push(`selUI=${isSelectionUIActive(paneContent)}`, `tail=${JSON.stringify(lastLines).slice(0, 200)}`);
    }
    process.stderr.write(
      `[monitor] ${options.combo} elapsed=${elapsedSeconds}s ${dbgParts.join(" ")}\n`
    );

    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

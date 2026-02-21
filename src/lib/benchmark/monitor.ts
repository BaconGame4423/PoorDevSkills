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
  // 2. _runs/*/ (team mode) — exclude archive dirs (YYYYMMDD-*)
  const runsDir = path.join(comboDir, "_runs");
  if (existsSync(runsDir)) {
    for (const entry of readdirSync(runsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !/^\d{8}-/.test(entry.name)) {
        const candidate = path.join(runsDir, entry.name, "pipeline-state.json");
        if (existsSync(candidate)) return candidate;
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
  try {
    const files = execSync(
      `find "${comboDir}" -maxdepth 4 -type f \\( -name "*.html" -o -name "*.js" -o -name "*.css" \\) ` +
      `-not -path '*/lib/*' -not -path '*/.poor-dev/*' -not -path '*/commands/*'`,
      { encoding: "utf-8" }
    ).trim();
    return files.length > 0;
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
  let idleWithArtifactsCount = 0;

  const intervalMs = 10_000;
  const pipelineCheckIntervalMs = 60_000;
  const idleCheckStartMs = 120_000;
  const idleCheckIntervalMs = 60_000;
  const phase0TimeoutMs = 600_000;

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
            try {
              logs.push(`Running post-processing: ${options.postCommand}`);
              const postOutput = execSync(options.postCommand, {
                encoding: "utf-8",
                timeout: 300_000,
                cwd: options.projectRoot,
              });
              logs.push(`Post-processing complete: ${postOutput.slice(0, 500)}`);
            } catch (e) {
              logs.push(`Post-processing failed: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          return { exitReason: "pipeline_complete", elapsedSeconds, combo: options.combo, logs };
        }
      }

      if (elapsed >= idleCheckStartMs && elapsed - lastIdleCheck >= idleCheckIntervalMs) {
        lastIdleCheck = elapsed;

        if (paneContent.includes("❯")) {
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
            idleWithArtifactsCount++;
            if (idleWithArtifactsCount === 1) {
              const msg = buildRecoveryMessage(pipelineInfo);
              pasteBuffer(options.targetPane, "monitor-recovery", msg);
              sendKeys(options.targetPane, "Enter");
              logs.push(`Recovery message sent (current: ${pipelineInfo.current})`);
            } else if (idleWithArtifactsCount >= 3) {
              logs.push("Recovery failed after 3 attempts");
              return {
                exitReason: "tui_idle",
                elapsedSeconds,
                combo: options.combo,
                logs,
              };
            }
          }
        } else {
          idleWithArtifactsCount = 0;
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
    process.stderr.write(
      `[monitor] ${options.combo} elapsed=${elapsedSeconds}s phase0=${phase0Done ? "done" : "active"} step=${stepLabel}\n`
    );

    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

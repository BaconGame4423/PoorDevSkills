import type { MonitorOptions, MonitorResult, Phase0Config } from "./types.js";
import { capturePaneContent, paneExists } from "./tmux.js";
import { respondToPhase0 } from "./phase0-responder.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

function loadPhase0Config(path: string): Phase0Config {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as Phase0Config;
}

/**
 * Find pipeline-state.json file.
 * Search order: features subdirs, .poor-dev/, then comboDir root.
 */
function findPipelineState(comboDir: string): string | null {
  const featuresDir = path.join(comboDir, "features");
  if (existsSync(featuresDir)) {
    for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = path.join(featuresDir, entry.name, "pipeline-state.json");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  const legacyPath = path.join(comboDir, ".poor-dev", "pipeline-state.json");
  if (existsSync(legacyPath)) return legacyPath;
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

function hasArtifacts(comboDir: string): boolean {
  try {
    const files = execSync(
      `find "${comboDir}" -maxdepth 2 -type f \\( -name "*.html" -o -name "*.js" -o -name "*.css" \\) ` +
      `-not -path '*/lib/*' -not -path '*/.poor-dev/*' -not -path '*/commands/*'`,
      { encoding: "utf-8" }
    ).trim();
    return files.length > 0;
  } catch {
    return false;
  }
}

export async function runMonitor(options: MonitorOptions): Promise<MonitorResult> {
  const logs: string[] = [];
  const startTime = Date.now();
  const phase0Config = loadPhase0Config(options.phase0ConfigPath);

  let turnCount = 0;
  let phase0Done = false;
  let lastPipelineCheck = 0;
  let lastIdleCheck = 0;
  let idleDetected = false;

  const intervalMs = 10_000;
  const pipelineCheckIntervalMs = 60_000;
  const idleCheckStartMs = 120_000;
  const idleCheckIntervalMs = 60_000;

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

    if (!paneExists(options.targetPane)) {
      return {
        exitReason: "pane_lost",
        elapsedSeconds,
        combo: options.combo,
        logs: [...logs, "Pane no longer exists"],
      };
    }

    const paneContent = capturePaneContent(options.targetPane);

    if (!phase0Done) {
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
        idleDetected = true;
        if (hasArtifacts(options.comboDir)) {
          return {
            exitReason: "tui_idle",
            elapsedSeconds,
            combo: options.combo,
            logs: [...logs, "TUI idle with artifacts present"],
          };
        }
        logs.push("TUI idle but no artifacts yet");
      }
    }

    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

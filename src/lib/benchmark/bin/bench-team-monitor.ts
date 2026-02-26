#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { runMonitor } from "../monitor.js";
import { killPane, paneExists, listAllPanes, currentSessionId } from "../tmux.js";
import type { MonitorOptions } from "../types.js";

const { values } = parseArgs({
  options: {
    combo: {
      type: "string",
      short: "c",
    },
    target: {
      type: "string",
      short: "t",
    },
    "combo-dir": {
      type: "string",
    },
    "phase0-config": {
      type: "string",
    },
    timeout: {
      type: "string",
      short: "T",
      default: "7200",
    },
    "project-root": {
      type: "string",
      short: "r",
    },
    "post-command": {
      type: "string",
    },
    "caller-pane": {
      type: "string",
    },
    "verbose-heartbeat": {
      type: "boolean",
      default: false,
    },
  },
  strict: true,
});

if (!values.combo || !values.target || !values["combo-dir"] || !values["phase0-config"]) {
  console.error("Missing required arguments");
  console.error("Usage: bench-team-monitor --combo <combo> --target <pane_id> --combo-dir <path> --phase0-config <path>");
  process.exit(1);
}

// Snapshot panes at startup for differential cleanup (scoped to current session)
const sessionId = currentSessionId();
const startPanes = new Set(listAllPanes(sessionId ?? undefined));
const callerPane = values["caller-pane"];

// Write cleanup marker so external callers can clean up if monitor is killed
const cleanupMarker = `/tmp/bench-cleanup-${values.combo}.json`;
writeFileSync(cleanupMarker, JSON.stringify({
  targetPane: values.target,
  combo: values.combo,
  startPanes: [...startPanes],
  callerPane: callerPane ?? null,
  pid: process.pid,
}));

let cleanedUp = false;
function cleanup(targetPane: string, combo: string): void {
  if (cleanedUp) return;
  cleanedUp = true;
  // Kill panes spawned after monitor start (teammate panes)
  try {
    const currentPanes = listAllPanes(sessionId ?? undefined);
    for (const pane of currentPanes) {
      if (startPanes.has(pane)) continue;     // existed before bench → protect
      if (pane === callerPane) continue;       // caller pane → protect
      try { killPane(pane); } catch { /* best effort */ }
    }
  } catch {
    // best effort
  }

  // Also ensure orchestrator pane is killed
  try {
    if (paneExists(targetPane)) killPane(targetPane);
  } catch {
    // best effort
  }
  try {
    const stateFile = "/tmp/bench-active-panes.json";
    if (existsSync(stateFile)) {
      const data = JSON.parse(readFileSync(stateFile, "utf-8")) as Record<string, unknown>;
      delete data[combo];
      writeFileSync(stateFile, JSON.stringify(data, null, 2));
    }
  } catch {
    // best effort
  }
  // Remove cleanup marker
  try { unlinkSync(`/tmp/bench-cleanup-${combo}.json`); } catch { /* best effort */ }
}

const options: MonitorOptions = {
  combo: values.combo,
  targetPane: values.target,
  comboDir: values["combo-dir"],
  phase0ConfigPath: values["phase0-config"],
  timeoutSeconds: parseInt(values.timeout ?? "7200", 10),
  projectRoot: values["project-root"] ?? process.cwd(),
  ...(values["post-command"] ? { postCommand: values["post-command"] } : {}),
  verboseHeartbeat: values["verbose-heartbeat"] ?? false,
};

process.on("SIGTERM", () => cleanup(options.targetPane, options.combo));
process.on("SIGINT", () => cleanup(options.targetPane, options.combo));

runMonitor(options)
  .then((result) => {
    cleanup(options.targetPane, options.combo);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    cleanup(options.targetPane, options.combo);
    console.error("Monitor failed:", error);
    process.exit(1);
  });

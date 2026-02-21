#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runMonitor } from "../monitor.js";
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
  },
  strict: true,
});

if (!values.combo || !values.target || !values["combo-dir"] || !values["phase0-config"]) {
  console.error("Missing required arguments");
  console.error("Usage: bench-team-monitor --combo <combo> --target <pane_id> --combo-dir <path> --phase0-config <path>");
  process.exit(1);
}

const options: MonitorOptions = {
  combo: values.combo,
  targetPane: values.target,
  comboDir: values["combo-dir"],
  phase0ConfigPath: values["phase0-config"],
  timeoutSeconds: parseInt(values.timeout ?? "7200", 10),
  projectRoot: values["project-root"] ?? process.cwd(),
  ...(values["post-command"] ? { postCommand: values["post-command"] } : {}),
};

runMonitor(options)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Monitor failed:", error);
    process.exit(1);
  });

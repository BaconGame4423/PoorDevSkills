/**
 * team-instruction.ts
 *
 * Agent Teams アクション構築ヘルパー。
 * team-state-machine.ts から呼び出される。
 */

import path from "node:path";

import type { TeammateRole, FlowDefinition } from "./flow-types.js";
import type { FileSystem } from "./interfaces.js";
import type { TeammateSpec, TaskSpec } from "./team-types.js";

/**
 * チーム名を生成する。
 * フォーマット: pd-{step}-{NNN}
 * NNN は featureDir から抽出（例: "specs/001-auth" → "001"）。
 */
export function buildTeamName(step: string, featureDir: string): string {
  const dirName = path.basename(featureDir);
  const numMatch = dirName.match(/^(\d+)/);
  const num = numMatch?.[1] ?? "000";
  return `pd-${step}-${num}`;
}

/**
 * TeammateRole → TeammateSpec に変換。
 */
export function buildTeammateSpec(role: TeammateRole): TeammateSpec {
  const spec: TeammateSpec = {
    role: role.role,
    agentFile: `agents/claude/${role.role}.md`,
    writeAccess: role.writeAccess !== false,
  };
  if (role.agentType) {
    spec.agentType = role.agentType;
  }
  return spec;
}

/**
 * Worker 用のタスク定義を構築する。
 */
export function buildWorkerTask(
  step: string,
  teammate: TeammateSpec,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): TaskSpec {
  const contextDesc = buildContextDescription(step, fd, flowDef, fs);
  const artifactDef = flowDef.artifacts?.[step];
  const outputDesc = !artifactDef
    ? `Complete the "${step}" step`
    : artifactDef === "*"
      ? `Output: all files in ${fd}`
      : Array.isArray(artifactDef)
        ? `Output: ${artifactDef.map((f) => path.join(fd, f)).join(", ")}`
        : `Output: ${path.join(fd, artifactDef)}`;

  return {
    subject: `Execute ${step} step`,
    description: [
      `Step: ${step}`,
      `Feature directory: ${fd}`,
      contextDesc,
      outputDesc,
    ].join("\n"),
    assignTo: teammate.role,
  };
}

/**
 * レビューチーム用のタスク定義を構築する。
 */
export function buildReviewTask(
  step: string,
  teammate: TeammateSpec,
  fd: string,
  targetFiles: string[],
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): TaskSpec {
  const contextDesc = buildContextDescription(step, fd, flowDef, fs);
  const targetDesc = targetFiles.map((f) => `  - ${f}`).join("\n");

  return {
    subject: `Execute ${step} review`,
    description: [
      `Step: ${step}`,
      `Feature directory: ${fd}`,
      `Target files:\n${targetDesc}`,
      contextDesc,
      teammate.writeAccess
        ? `Role: Fixer — standby for fix instructions from orchestrator`
        : `Role: Reviewer — review target files and output ISSUE/VERDICT lines`,
    ].join("\n"),
    assignTo: teammate.role,
  };
}

/**
 * ステップのコンテキストファイル説明を構築する。
 */
function buildContextDescription(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): string {
  const ctx = flowDef.context?.[step];
  if (!ctx) return "Context: none";

  const parts: string[] = [];
  for (const [key, filename] of Object.entries(ctx)) {
    const fullPath = path.join(fd, filename);
    const exists = fs.exists(fullPath);
    parts.push(`  ${key}: ${fullPath}${exists ? "" : " (missing)"}`);
  }
  return `Context:\n${parts.join("\n")}`;
}

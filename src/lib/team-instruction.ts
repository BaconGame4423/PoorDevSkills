/**
 * team-instruction.ts
 *
 * Agent Teams アクション構築ヘルパー。
 * team-state-machine.ts から呼び出される。
 */

import path from "node:path";

import type { TeammateRole, FlowDefinition } from "./flow-types.js";
import type { FileSystem } from "./interfaces.js";
import type { TeammateSpec, TaskSpec, BashDispatchAction, BashReviewDispatchAction } from "./team-types.js";

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
        : `Role: Reviewer — review target files and send result as YAML via SendMessage (see agent file for format)`,
    ].join("\n"),
    assignTo: teammate.role,
  };
}

/**
 * ステップのコンテキストファイル説明を構築する。
 *
 * contextInject フラグが定義されている場合:
 * - inject: true のコンテキストは "inject" マーク付き（Opus が pre-inject）
 * - inject: false / 未定義は "self-read" マーク付き（worker が自分で Read）
 */
function buildContextDescription(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists">
): string {
  const ctx = flowDef.context?.[step];
  if (!ctx) return "Context: none";

  const injectMap = flowDef.contextInject?.[step];
  const parts: string[] = [];
  for (const [key, filename] of Object.entries(ctx)) {
    const fullPath = filename === "*" ? fd : path.join(fd, filename);
    const exists = fs.exists(fullPath);
    const mode = injectMap?.[key] ? "inject" : "self-read";
    parts.push(`  ${key}: ${fullPath}${exists ? "" : " (missing)"} [${mode}]`);
  }

  if (injectMap) {
    parts.push("  Note: [inject] files will be provided below. [self-read] files: use Read tool to load them.");
  }

  return `Context:\n${parts.join("\n")}`;
}

// --- Bash Dispatch ヘルパー ---

const BASH_DISPATCH_SUFFIX = `
## Execution Mode: Bash Dispatch
- SendMessage ツールは使用不可。結果はテキスト出力で返してください。
- Reviewer: YAML を直接テキスト出力してください。
- Fixer: 修正した issue ID リストを \`Fixed: [ID1, ID2, ...]\` 形式で出力してください。`;

const MAX_INJECT_CHARS = 50_000;

/**
 * Bash dispatch 用のプロンプトを構築する。
 * [inject] ファイルの内容を実際に読み込んでプロンプトに埋め込む。
 */
export function buildBashDispatchPrompt(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): string {
  const artifactDef = flowDef.artifacts?.[step];
  const outputDesc = !artifactDef
    ? `Complete the "${step}" step`
    : artifactDef === "*"
      ? `Output: all files in ${fd}`
      : Array.isArray(artifactDef)
        ? `Output: ${artifactDef.map((f) => path.join(fd, f)).join(", ")}`
        : `Output: ${path.join(fd, artifactDef)}`;

  const parts: string[] = [
    `Step: ${step}`,
    `Feature directory: ${fd}`,
    outputDesc,
  ];

  // コンテキスト注入
  const ctx = flowDef.context?.[step];
  const injectMap = flowDef.contextInject?.[step];
  if (ctx) {
    const contextParts: string[] = [];
    const injectContents: string[] = [];
    for (const [key, filename] of Object.entries(ctx)) {
      const fullPath = filename === "*" ? fd : path.join(fd, filename);
      const exists = fs.exists(fullPath);
      const shouldInject = injectMap?.[key] === true;

      if (shouldInject && exists) {
        contextParts.push(`  ${key}: ${fullPath} [inject — content below]`);
        let content = fs.readFile(fullPath);
        if (content.length > MAX_INJECT_CHARS) {
          content = content.slice(0, MAX_INJECT_CHARS) + "\n... (truncated)";
        }
        injectContents.push(`## Context: ${key}\n${content}`);
      } else if (exists) {
        contextParts.push(`  ${key}: ${fullPath} [self-read — use Read tool]`);
      } else {
        contextParts.push(`  ${key}: ${fullPath} (missing)`);
      }
    }
    parts.push(`Context:\n${contextParts.join("\n")}`);
    if (injectContents.length > 0) {
      parts.push(injectContents.join("\n\n"));
    }
  }

  parts.push(BASH_DISPATCH_SUFFIX);
  return parts.join("\n");
}

/**
 * Bash dispatch reviewer 用のプロンプトを構築する。
 */
export function buildBashReviewPrompt(
  step: string,
  fd: string,
  targetFiles: string[],
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): string {
  const targetDesc = targetFiles.map((f) => `  - ${f}`).join("\n");
  const parts: string[] = [
    `Step: ${step}`,
    `Feature directory: ${fd}`,
    `Target files:\n${targetDesc}`,
    `Role: Reviewer — review target files and output result as YAML`,
  ];

  // コンテキスト注入
  const ctx = flowDef.context?.[step];
  const injectMap = flowDef.contextInject?.[step];
  if (ctx) {
    const contextParts: string[] = [];
    const injectContents: string[] = [];
    for (const [key, filename] of Object.entries(ctx)) {
      const fullPath = filename === "*" ? fd : path.join(fd, filename);
      const exists = fs.exists(fullPath);
      const shouldInject = injectMap?.[key] === true;

      if (shouldInject && exists) {
        contextParts.push(`  ${key}: ${fullPath} [inject — content below]`);
        let content = fs.readFile(fullPath);
        if (content.length > MAX_INJECT_CHARS) {
          content = content.slice(0, MAX_INJECT_CHARS) + "\n... (truncated)";
        }
        injectContents.push(`## Context: ${key}\n${content}`);
      } else if (exists) {
        contextParts.push(`  ${key}: ${fullPath} [self-read — use Read tool]`);
      } else {
        contextParts.push(`  ${key}: ${fullPath} (missing)`);
      }
    }
    parts.push(`Context:\n${contextParts.join("\n")}`);
    if (injectContents.length > 0) {
      parts.push(injectContents.join("\n\n"));
    }
  }

  parts.push(BASH_DISPATCH_SUFFIX);
  return parts.join("\n");
}

/**
 * Bash dispatch fixer 用のベースプロンプトを構築する。
 * review 結果は後から追記される。
 */
export function buildBashFixerBasePrompt(
  step: string,
  fd: string,
  targetFiles: string[],
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): string {
  const targetDesc = targetFiles.map((f) => `  - ${f}`).join("\n");
  const parts: string[] = [
    `Step: ${step}`,
    `Feature directory: ${fd}`,
    `Target files:\n${targetDesc}`,
    `Role: Fixer — fix issues identified by the reviewer`,
  ];

  // コンテキスト注入 (reviewer と同じ)
  const ctx = flowDef.context?.[step];
  const injectMap = flowDef.contextInject?.[step];
  if (ctx) {
    const contextParts: string[] = [];
    const injectContents: string[] = [];
    for (const [key, filename] of Object.entries(ctx)) {
      const fullPath = filename === "*" ? fd : path.join(fd, filename);
      const exists = fs.exists(fullPath);
      const shouldInject = injectMap?.[key] === true;

      if (shouldInject && exists) {
        contextParts.push(`  ${key}: ${fullPath} [inject — content below]`);
        let content = fs.readFile(fullPath);
        if (content.length > MAX_INJECT_CHARS) {
          content = content.slice(0, MAX_INJECT_CHARS) + "\n... (truncated)";
        }
        injectContents.push(`## Context: ${key}\n${content}`);
      } else if (exists) {
        contextParts.push(`  ${key}: ${fullPath} [self-read — use Read tool]`);
      } else {
        contextParts.push(`  ${key}: ${fullPath} (missing)`);
      }
    }
    parts.push(`Context:\n${contextParts.join("\n")}`);
    if (injectContents.length > 0) {
      parts.push(injectContents.join("\n\n"));
    }
  }

  parts.push(BASH_DISPATCH_SUFFIX);
  return parts.join("\n");
}

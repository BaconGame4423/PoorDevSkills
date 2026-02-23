/**
 * team-instruction.ts
 *
 * Bash Dispatch アクション構築ヘルパー。
 * team-state-machine.ts から呼び出される。
 */

import path from "node:path";

import type { FlowDefinition } from "./flow-types.js";
import type { FileSystem } from "./interfaces.js";

// --- Bash Dispatch ヘルパー ---

const BASH_DISPATCH_SUFFIX = `
## Execution Mode: Bash Dispatch
- SendMessage ツールは使用不可。結果はテキスト出力で返してください。
- Reviewer: YAML を直接テキスト出力してください。
- Fixer: 修正した issue ID リストを \`Fixed: [ID1, ID2, ...]\` 形式で出力してください。`;

const MAX_INJECT_CHARS = 50_000;

/**
 * コンテキスト注入ブロックを構築する（共通ヘルパー）。
 */
function buildContextBlocks(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): { contextLines: string[]; injectBlocks: string[] } {
  const ctx = flowDef.context?.[step];
  const injectMap = flowDef.contextInject?.[step];
  if (!ctx) return { contextLines: [], injectBlocks: [] };

  const contextLines: string[] = [];
  const injectBlocks: string[] = [];
  for (const [key, filename] of Object.entries(ctx)) {
    const fullPath = filename === "*" ? fd : path.join(fd, filename);
    const exists = fs.exists(fullPath);
    const shouldInject = injectMap?.[key] === true;

    if (shouldInject && exists) {
      contextLines.push(`  ${key}: ${fullPath} [inject — content below]`);
      let content = fs.readFile(fullPath);
      if (content.length > MAX_INJECT_CHARS) {
        content = content.slice(0, MAX_INJECT_CHARS) + "\n... (truncated)";
      }
      injectBlocks.push(`## Context: ${key}\n${content}`);
    } else if (exists) {
      contextLines.push(`  ${key}: ${fullPath} [self-read — use Read tool]`);
    } else {
      contextLines.push(`  ${key}: ${fullPath} (missing)`);
    }
  }
  return { contextLines, injectBlocks };
}

/**
 * コンテキスト注入ブロックを parts 配列に追加する。
 */
function appendContextToParts(
  parts: string[],
  { contextLines, injectBlocks }: { contextLines: string[]; injectBlocks: string[] }
): void {
  if (contextLines.length > 0) {
    parts.push(`Context:\n${contextLines.join("\n")}`);
  }
  if (injectBlocks.length > 0) {
    parts.push(injectBlocks.join("\n\n"));
  }
}

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

  appendContextToParts(parts, buildContextBlocks(step, fd, flowDef, fs));
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

  appendContextToParts(parts, buildContextBlocks(step, fd, flowDef, fs));
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

  appendContextToParts(parts, buildContextBlocks(step, fd, flowDef, fs));
  parts.push(BASH_DISPATCH_SUFFIX);
  return parts.join("\n");
}

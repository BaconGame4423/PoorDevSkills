/**
 * team-prompt-builder.ts
 *
 * Agent Teams の teammate 用プロンプトを構築する。
 * コマンドファイルの内容を基に、Agent Teams コンテキストを付加。
 */

import path from "node:path";

import type { FlowDefinition } from "./flow-types.js";
import type { FileSystem } from "./interfaces.js";

// --- プロンプト構築 ---

export interface PromptBuildOptions {
  step: string;
  role: string;
  featureDir: string;
  projectDir: string;
  flowDef: FlowDefinition;
  isReviewer: boolean;
}

/**
 * Worker / Reviewer 用のプロンプトを構築する。
 *
 * 構造:
 * 1. Agent Teams コンテキスト（ルール）
 * 2. ステップ固有の指示
 * 3. コンテキストファイルのインライン展開
 */
export function buildTeammatePrompt(
  opts: PromptBuildOptions,
  fs: Pick<FileSystem, "exists" | "readFile">
): string {
  const { step, role, featureDir, projectDir, flowDef, isReviewer } = opts;
  const fd = path.join(projectDir, featureDir);

  const sections: string[] = [];

  // 1. Agent Teams ルール
  sections.push(buildRulesSection(role, isReviewer));

  // 2. ステップ指示
  sections.push(buildStepSection(step, featureDir));

  // 3. コンテキストファイル
  const ctxSection = buildContextSection(step, fd, flowDef, fs);
  if (ctxSection) sections.push(ctxSection);

  return sections.join("\n\n---\n\n");
}

function buildRulesSection(role: string, isReviewer: boolean): string {
  const lines = [
    `## Agent Teams Context`,
    ``,
    `Role: ${role}`,
    ``,
    `### Rules`,
  ];

  if (isReviewer) {
    lines.push(
      `- **Read-only**: Write, Edit, Bash は使用禁止`,
      `- 全ての視点を順次評価する（スキップ禁止）`,
      `- 各 issue: \`ISSUE: {C|H|M|L} | {description} | {location}\``,
      `- 最後に必ず: \`VERDICT: GO|CONDITIONAL|NO-GO\``,
      `- 完了時: SendMessage で supervisor に結果を報告`,
    );
  } else {
    lines.push(
      `- **git 操作禁止**: commit, push, checkout, clean, reset は一切実行しない`,
      `- Dashboard Update セクションは無視する`,
      `- 完了時: SendMessage で supervisor に成果物パスを報告`,
      `- エラー時: SendMessage で supervisor にエラー内容を報告`,
    );
  }

  return lines.join("\n");
}

function buildStepSection(step: string, featureDir: string): string {
  return [
    `## Step: ${step}`,
    ``,
    `Feature directory: ${featureDir}`,
  ].join("\n");
}

function buildContextSection(
  step: string,
  fd: string,
  flowDef: FlowDefinition,
  fs: Pick<FileSystem, "exists" | "readFile">
): string | null {
  const ctx = flowDef.context?.[step];
  if (!ctx) return null;

  const parts: string[] = [`## Context Files`];

  for (const [key, filename] of Object.entries(ctx)) {
    const fullPath = path.join(fd, filename);
    if (fs.exists(fullPath)) {
      const content = fs.readFile(fullPath);
      // 大きすぎるファイルは先頭を切り詰め
      const truncated = content.length > 50000
        ? content.slice(0, 50000) + "\n... (truncated)"
        : content;
      parts.push(`### ${key} (${filename})\n\`\`\`\n${truncated}\n\`\`\``);
    } else {
      parts.push(`### ${key} (${filename})\n*File not found*`);
    }
  }

  return parts.join("\n\n");
}

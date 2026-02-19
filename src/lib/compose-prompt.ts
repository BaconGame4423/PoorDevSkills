/**
 * compose-prompt.ts
 *
 * compose-prompt.sh の TypeScript 移植。
 * コマンドテンプレート + ヘッダー + コンテキストからプロンプトファイルを生成する。
 *
 * 処理:
 *   1. ヘッダーを先頭に追加
 *   2. コマンドファイルから YAML フロントマターを除去
 *   3. コンテキストファイルを末尾に追加（10KB 超は最初の 200 行のみ）
 *
 * compose-prompt.sh 全体参照。
 */

import fs from "node:fs";
import path from "node:path";

// --- ヘッダー定義 (Single Source of Truth) ---

const NON_INTERACTIVE_HEADER = `## Mode: NON_INTERACTIVE (pipeline sub-agent)
- No AskUserQuestion → use [NEEDS CLARIFICATION: ...] markers
- No Gate Check, Dashboard Update, handoffs, EnterPlanMode/ExitPlanMode
- Output progress: [PROGRESS: ...] / [REVIEW-PROGRESS: ...]
- If blocked → [ERROR: <your specific error>] and stop
- Git 操作制限: commit は許可、push は絶対に禁止（git push, git push origin 等すべて）
- Shell infrastructure: mkdir・ディレクトリ作成・/tmp/ 操作は禁止。/tmp/ ファイルは poll-dispatch.sh が自動管理する

⚠️ FILE SCOPE — 絶対に守ること:
- 変更可能: FEATURE_DIR 内 + プロジェクトソースファイルのみ
- 変更禁止: lib/, commands/, agents/, .poor-dev/, .opencode/command/, .opencode/agents/, .claude/agents/, .claude/commands/
- /tmp/ ファイルの読み取り・作成・変更は禁止（poll-dispatch.sh が自動管理）
- パイプライン基盤（シェルスクリプト、設定ファイル）の分析・修正・デバッグは禁止
- 基盤に問題を発見しても修正しないこと → [ERROR: infrastructure issue] を出力して停止

- End with: files created/modified, unresolved items`;

const READONLY_HEADER = `## Read-Only Execution Mode
You have READ-ONLY tool access (Edit, Write, Bash, NotebookEdit are disabled).
- Output the spec draft as plain markdown text in your response.
- First line MUST be: \`[BRANCH: suggested-short-name]\`
- The rest of your output is the spec draft content (using the Spec Template).
- Include \`[NEEDS CLARIFICATION: question]\` markers inline as needed (max 3).
- Do NOT attempt to create branches, directories, or files.`;

const HEADERS: Record<string, string> = {
  non_interactive: NON_INTERACTIVE_HEADER,
  readonly: READONLY_HEADER,
};

// --- YAML フロントマター除去 ---

/**
 * YAML フロントマター（--- ... --- ブロック）を除去する。
 * compose-prompt.sh L98-108 の awk スクリプトに対応。
 */
function stripYamlFrontmatter(content: string): string {
  const lines = content.split("\n");
  let inFront = false;
  let frontDone = false;
  let dashCount = 0;
  const result: string[] = [];

  for (const line of lines) {
    if (!frontDone && /^---\s*$/.test(line)) {
      dashCount++;
      if (dashCount === 1) {
        inFront = true;
        continue;
      }
      if (dashCount === 2) {
        inFront = false;
        frontDone = true;
        continue;
      }
    }
    if (!inFront) {
      result.push(line);
    }
  }

  return result.join("\n");
}

// --- コンテキストファイル読み込み ---

const MAX_CONTEXT_BYTES = 10240; // 10KB
const MAX_CONTEXT_LINES = 200;

/**
 * コンテキストファイルを読み込む（10KB 超は最初の 200 行のみ）。
 * compose-prompt.sh L129-136 に対応。
 */
function readContextFile(filePath: string): string {
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, "utf8");

  if (stat.size > MAX_CONTEXT_BYTES) {
    const lines = content.split("\n").slice(0, MAX_CONTEXT_LINES);
    return lines.join("\n") + "\n\n[TRUNCATED: file exceeds 10KB, showing first 200 lines]";
  }

  return content;
}

// --- 型定義 ---

export interface ComposeOptions {
  commandFile: string;
  outputFile: string;
  headers?: string[];
  contexts?: Record<string, string>;
}

export interface ComposeResult {
  success: boolean;
  error?: string;
}

// --- メイン関数 ---

/**
 * コマンドファイルからプロンプトファイルを生成する。
 * compose-prompt.sh のメインロジック全体に対応。
 */
export function composePrompt(opts: ComposeOptions): ComposeResult {
  const { commandFile, outputFile, headers = [], contexts = {} } = opts;

  // コマンドファイルの存在確認
  if (!fs.existsSync(commandFile)) {
    return { success: false, error: `Command file not found: ${commandFile}` };
  }

  const parts: string[] = [];

  // 1. ヘッダーを追加
  for (const headerName of headers) {
    const headerContent = HEADERS[headerName];
    if (headerContent) {
      parts.push(headerContent);
      parts.push("");
    } else {
      process.stderr.write(`Warning: Unknown header '${headerName}', skipped\n`);
    }
  }

  // 2. コマンドファイルを読み込み、YAML フロントマターを除去
  const rawCommand = fs.readFileSync(commandFile, "utf8");
  const strippedCommand = stripYamlFrontmatter(rawCommand);
  parts.push(strippedCommand);

  // 3. コンテキストファイルを追加
  for (const [key, filePath] of Object.entries(contexts)) {
    if (!fs.existsSync(filePath)) {
      process.stderr.write(`Warning: Context file not found: ${filePath} (key=${key}), skipped\n`);
      continue;
    }

    parts.push("");
    parts.push(`## Context: ${key}`);
    parts.push("");

    try {
      const contextContent = readContextFile(filePath);
      parts.push(contextContent);
    } catch (err) {
      process.stderr.write(`Warning: Failed to read context file: ${filePath}: ${String(err)}\n`);
    }
  }

  // 4. 出力ファイルに書き込む
  const output = parts.join("\n");
  const outputDir = path.dirname(outputFile);
  if (outputDir !== ".") {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, output, "utf8");

  return { success: true };
}

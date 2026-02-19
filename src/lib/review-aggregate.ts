/**
 * review-aggregate.ts
 *
 * review-aggregate.sh の TypeScript 移植。
 * ペルソナ出力集約・重複排除・issues ファイル生成。
 *
 * 主な変更点:
 * - bash サブプロセス → 型付き関数呼び出し
 * - mktemp/grep/sed → TypeScript 文字列処理
 * - ファイル書き込みを FileSystem 経由で実施
 *
 * review-aggregate.sh 全体参照。
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import type { FileSystem } from "./interfaces.js";

// --- 型定義 ---

export interface IssueRecord {
  id: string;
  severity: "C" | "H" | "M" | "L";
  description: string;
  location: string;
  persona: string;
}

export interface AggregateOptions {
  outputDir: string;
  logPath?: string;
  idPrefix: string;
  nextId: number;
  reviewType?: string;
  fileSystem: FileSystem;
}

export interface AggregateResult {
  total: number;
  C: number;
  H: number;
  M: number;
  L: number;
  nextId: number;
  issuesFile: string;
  converged: boolean;
  verdicts: string;
}

// --- YAML review-log 解析 ---

/**
 * review-log.yaml の "fixed:" ブロックから修正済み issue ID セットを取得する。
 * review-aggregate.sh L48-66 に対応。
 */
export function loadFixedIssues(logPath: string, fileSystem: Pick<FileSystem, "exists" | "readFile">): Set<string> {
  const fixed = new Set<string>();
  if (!logPath || !fileSystem.exists(logPath)) return fixed;

  try {
    const content = fileSystem.readFile(logPath);
    const lines = content.split("\n");
    let inFixed = false;

    for (const line of lines) {
      // "fixed:" ブロック開始
      if (/^\s*fixed:\s*$/.test(line)) {
        inFixed = true;
        continue;
      }
      if (inFixed) {
        // "- ID" 行 (例: "      - PR001")
        const m = line.match(/^\s*-\s*([A-Z]{2}\d+)\s*$/);
        if (m?.[1]) {
          fixed.add(m[1]);
        } else if (!/^\s*-/.test(line) && line.trim() !== "") {
          // ブロック終了（次のキーに移った）
          inFixed = false;
        }
      }
    }
  } catch { /* no-op */ }

  return fixed;
}

// --- ペルソナ出力解析 ---

interface ParsedPersonaOutput {
  verdict: string;
  issues: Array<{
    severity: "C" | "H" | "M" | "L";
    description: string;
    location: string;
  }>;
}

const ISSUE_LINE_RE = /^ISSUE:\s*(C|H|M|L)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*$/;
const VERDICT_LINE_RE = /^VERDICT:\s*(GO|CONDITIONAL|NO-GO)/m;

/**
 * opencode JSON または plaintext から VERDICT / ISSUE 行を抽出する。
 * review-aggregate.sh L80-130 に対応。
 */
function parsePersonaOutput(content: string, personaName: string): ParsedPersonaOutput {
  // opencode JSON から text part を抽出を試みる
  let text = content;
  try {
    // NDJSON: 各行がJSON {"type":"text","part":{...}} の場合
    const jsonLines = content.split("\n").filter((l) => l.trim().startsWith("{"));
    const parts: string[] = [];
    for (const line of jsonLines) {
      const obj = JSON.parse(line) as { type?: string; part?: { text?: string } };
      if (obj.type === "text" && obj.part?.text) {
        parts.push(obj.part.text);
      }
    }
    if (parts.length > 0) text = parts.join("\n");
  } catch { /* plaintext にフォールバック */ }

  void personaName;

  const verdictMatch = VERDICT_LINE_RE.exec(text);
  const verdict = verdictMatch?.[1] ?? "";

  const issues: ParsedPersonaOutput["issues"] = [];
  for (const line of text.split("\n")) {
    const m = ISSUE_LINE_RE.exec(line);
    if (m) {
      const severity = m[1] as "C" | "H" | "M" | "L";
      const description = m[2]?.trim() ?? "";
      const location = m[3]?.trim() ?? "";
      issues.push({ severity, description, location });
    }
  }

  return { verdict, issues };
}

// --- メイン集約 ---

/**
 * ペルソナ出力を集約し、issues ファイルを生成する。
 * review-aggregate.sh のメインロジック全体に対応。
 */
export function aggregateReviews(opts: AggregateOptions): AggregateResult {
  const { outputDir, logPath, idPrefix, reviewType, fileSystem } = opts;
  let { nextId } = opts;

  // 修正済み issue セットを取得
  const fixedIssues = logPath ? loadFixedIssues(logPath, fileSystem) : new Set<string>();

  // issues 一時ファイル（location 重複検出用セット）
  const issues: IssueRecord[] = [];
  const seenLocations = new Set<string>();
  const verdictParts: string[] = [];

  let countC = 0;
  let countH = 0;
  let countM = 0;
  let countL = 0;

  // outputDir 内の .txt / .json ファイルを処理
  let outputFiles: string[];
  try {
    outputFiles = fs
      .readdirSync(outputDir)
      .filter((f) => f.endsWith(".txt") || f.endsWith(".json"))
      .map((f) => path.join(outputDir, f));
  } catch {
    outputFiles = [];
  }

  for (const outputFile of outputFiles) {
    const personaName = path.basename(outputFile).replace(/\.[^.]+$/, "");

    let content = "";
    try {
      content = fs.readFileSync(outputFile, "utf8");
    } catch {
      continue;
    }

    const parsed = parsePersonaOutput(content, personaName);

    // verdict を収集
    if (parsed.verdict) {
      verdictParts.push(`${personaName}:${parsed.verdict}`);
    }

    // issue を処理
    for (const issue of parsed.issues) {
      // Dedup: location 重複をスキップ（同一 iteration 内の cross-persona）
      if (seenLocations.has(issue.location)) continue;

      seenLocations.add(issue.location);

      const issueId = `${idPrefix}${String(nextId).padStart(3, "0")}`;
      nextId++;

      issues.push({
        id: issueId,
        severity: issue.severity,
        description: issue.description,
        location: issue.location,
        persona: personaName,
      });

      switch (issue.severity) {
        case "C": countC++; break;
        case "H": countH++; break;
        case "M": countM++; break;
        case "L": countL++; break;
      }
    }
  }

  const total = issues.length;
  const converged = countC === 0 && countH === 0;
  const verdicts = verdictParts.join(" ").trim();

  // NOGO_COUNT チェック（0 issues だが NO-GO の場合は警告）
  const nogoCount = verdictParts.filter((v) => v.includes("NO-GO")).length;
  if (nogoCount > 0 && total === 0) {
    process.stderr.write(JSON.stringify({ warning: "NO-GO verdict but zero issues found" }) + "\n");
  }

  // issues をパイプ区切りフォーマットで書き出す
  const issuesContent = issues
    .map((i) => `${i.id}|${i.severity}|${i.description}|${i.location}|${i.persona}`)
    .join("\n");

  // stable 保存先の決定
  let issuesFile: string;
  if (logPath) {
    const logDir = path.dirname(logPath);
    if (reviewType) {
      issuesFile = path.join(logDir, `review-issues-${reviewType}.txt`);
    } else {
      issuesFile = path.join(logDir, "review-issues-latest.txt");
    }
    fileSystem.writeFile(issuesFile, issuesContent);
    // 互換性のため latest も更新
    fileSystem.writeFile(path.join(logDir, "review-issues-latest.txt"), issuesContent);
  } else {
    // logPath がない場合は一時ファイルに書き出す
    issuesFile = path.join(os.tmpdir(), `poor-dev-issues-${process.pid}.txt`);
    fileSystem.writeFile(issuesFile, issuesContent);
  }

  void fixedIssues;

  return {
    total,
    C: countC,
    H: countH,
    M: countM,
    L: countL,
    nextId,
    issuesFile,
    converged,
    verdicts,
  };
}

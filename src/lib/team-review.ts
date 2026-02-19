/**
 * team-review.ts
 *
 * Opus 仲介レビューループの収束判定ロジック。
 * review-aggregate.ts の収束判定を再利用しつつ、
 * Agent Teams 固有の判定（VERDICT 行バリデーション等）を追加。
 */

// --- 型定義 ---

export interface ReviewIssue {
  id: string;
  severity: "C" | "H" | "M" | "L";
  description: string;
  location: string;
  persona: string;
}

export interface ReviewerOutput {
  raw: string;
  issues: ReviewIssue[];
  verdict: string;
  hasVerdictLine: boolean;
}

export interface FixerOutput {
  fixed: string[];
  rejected: Array<{ id: string; reason: string }>;
}

export type ConvergenceResult =
  | { converged: true; verdict: "GO" }
  | { converged: false; reason: string; remainingIssues: ReviewIssue[] };

// --- パーサー ---

const ISSUE_LINE_RE = /^ISSUE:\s*(C|H|M|L)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*$/;
const VERDICT_LINE_RE = /^VERDICT:\s*(GO|CONDITIONAL|NO-GO)/m;

/**
 * Reviewer の raw 出力を解析する。
 */
export function parseReviewerOutput(
  raw: string,
  idPrefix: string,
  startId: number
): ReviewerOutput {
  const issues: ReviewIssue[] = [];
  let nextId = startId;
  let verdict = "";
  let hasVerdictLine = false;

  for (const line of raw.split("\n")) {
    const issueMatch = ISSUE_LINE_RE.exec(line);
    if (issueMatch) {
      const severity = issueMatch[1] as ReviewIssue["severity"];
      const description = issueMatch[2]?.trim() ?? "";
      const location = issueMatch[3]?.trim() ?? "";
      const id = `${idPrefix}${String(nextId).padStart(3, "0")}`;
      nextId++;
      issues.push({ id, severity, description, location, persona: "" });
    }

    const verdictMatch = VERDICT_LINE_RE.exec(line);
    if (verdictMatch) {
      verdict = verdictMatch[1] ?? "";
      hasVerdictLine = true;
    }
  }

  return { raw, issues, verdict, hasVerdictLine };
}

/**
 * Fixer の YAML 出力を解析する。
 */
export function parseFixerOutput(raw: string): FixerOutput {
  const fixed: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];

  // 簡易 YAML パーサー: "fixed:" と "rejected:" ブロックを解析
  const lines = raw.split("\n");
  let section: "none" | "fixed" | "rejected" = "none";

  for (const line of lines) {
    if (/^\s*fixed:\s*$/.test(line)) {
      section = "fixed";
      continue;
    }
    if (/^\s*rejected:\s*$/.test(line)) {
      section = "rejected";
      continue;
    }

    if (section === "fixed") {
      const m = line.match(/^\s*-\s*([A-Z]{2}\d+)\s*$/);
      if (m?.[1]) {
        fixed.push(m[1]);
      } else if (line.trim() !== "" && !line.trim().startsWith("-")) {
        section = "none";
      }
    }

    if (section === "rejected") {
      const idMatch = line.match(/^\s*-\s*id:\s*([A-Z]{2}\d+)/);
      if (idMatch?.[1]) {
        // 次の行で reason を探す
        const idx = lines.indexOf(line);
        const nextLine = lines[idx + 1];
        const reasonMatch = nextLine?.match(/^\s*reason:\s*"?(.+?)"?\s*$/);
        rejected.push({
          id: idMatch[1],
          reason: reasonMatch?.[1] ?? "no reason given",
        });
      }
    }
  }

  return { fixed, rejected };
}

// --- 収束判定 ---

/**
 * レビュー結果の収束判定。
 * C=0 かつ H=0 で GO/CONDITIONAL verdict → 収束。
 */
export function checkConvergence(
  reviewerOutputs: ReviewerOutput[],
  fixedIds: Set<string>
): ConvergenceResult {
  // 全 reviewer の issues を統合
  const allIssues: ReviewIssue[] = [];
  for (const output of reviewerOutputs) {
    allIssues.push(...output.issues);
  }

  // 修正済みを除外
  const remainingIssues = allIssues.filter((i) => !fixedIds.has(i.id));

  // C/H カウント
  const criticalCount = remainingIssues.filter((i) => i.severity === "C").length;
  const highCount = remainingIssues.filter((i) => i.severity === "H").length;

  if (criticalCount === 0 && highCount === 0) {
    return { converged: true, verdict: "GO" };
  }

  return {
    converged: false,
    reason: `${criticalCount} critical, ${highCount} high severity issues remaining`,
    remainingIssues,
  };
}

/**
 * VERDICT 行の存在を検証する。
 * 欠落時はリトライ指示用のメッセージを返す。
 */
export function validateVerdictLine(output: ReviewerOutput): string | null {
  if (output.hasVerdictLine) return null;
  return "VERDICT line missing. Please include exactly one line: VERDICT: GO|CONDITIONAL|NO-GO";
}

/**
 * 複数 reviewer の結果を統合して fixer 用のイシューサマリーを生成。
 */
export function summarizeIssuesForFixer(
  issues: ReviewIssue[]
): string {
  if (issues.length === 0) return "No issues to fix.";

  const lines = issues.map(
    (i) => `- [${i.id}] ${i.severity} | ${i.description} | ${i.location}`
  );
  return `Fix the following issues:\n${lines.join("\n")}`;
}

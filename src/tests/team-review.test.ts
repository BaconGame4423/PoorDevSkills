/**
 * team-review.test.ts
 *
 * Opus 仲介レビューの解析・収束判定テスト。
 */

import { describe, it, expect } from "vitest";
import {
  parseReviewerOutput,
  parseFixerOutput,
  checkConvergence,
  validateVerdictLine,
  summarizeIssuesForFixer,
} from "../lib/team-review.js";

describe("parseReviewerOutput", () => {
  it("ISSUE 行と VERDICT 行を解析する", () => {
    const raw = [
      "ISSUE: C | Missing auth check (SEC) | src/api.ts:42",
      "ISSUE: H | No error handling (CODE) | src/handler.ts:10",
      "ISSUE: M | Magic number (CODE) | src/utils.ts:5",
      "VERDICT: CONDITIONAL",
    ].join("\n");

    const result = parseReviewerOutput(raw, "AR", 1);

    expect(result.issues).toHaveLength(3);
    expect(result.issues[0]!.id).toBe("AR001");
    expect(result.issues[0]!.severity).toBe("C");
    expect(result.issues[1]!.id).toBe("AR002");
    expect(result.issues[1]!.severity).toBe("H");
    expect(result.verdict).toBe("CONDITIONAL");
    expect(result.hasVerdictLine).toBe(true);
  });

  it("VERDICT 行がない場合", () => {
    const raw = "ISSUE: L | Minor style issue | file.ts:1";
    const result = parseReviewerOutput(raw, "PR", 1);

    expect(result.issues).toHaveLength(1);
    expect(result.hasVerdictLine).toBe(false);
    expect(result.verdict).toBe("");
  });

  it("issues がない場合", () => {
    const raw = "Everything looks good.\nVERDICT: GO";
    const result = parseReviewerOutput(raw, "PR", 1);

    expect(result.issues).toHaveLength(0);
    expect(result.verdict).toBe("GO");
  });

  it("ID が連番になる", () => {
    const raw = [
      "ISSUE: M | A | file:1",
      "ISSUE: L | B | file:2",
    ].join("\n");
    const result = parseReviewerOutput(raw, "QR", 5);
    expect(result.issues[0]!.id).toBe("QR005");
    expect(result.issues[1]!.id).toBe("QR006");
  });
});

describe("parseFixerOutput", () => {
  it("fixed と rejected を解析する", () => {
    const raw = [
      "fixed:",
      "  - AR001",
      "  - AR002",
      "rejected:",
      "  - id: AR003",
      '    reason: "out of scope"',
    ].join("\n");

    const result = parseFixerOutput(raw);

    expect(result.fixed).toEqual(["AR001", "AR002"]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.id).toBe("AR003");
    expect(result.rejected[0]!.reason).toBe("out of scope");
  });

  it("fixed のみの場合", () => {
    const raw = "fixed:\n  - PR001";
    const result = parseFixerOutput(raw);
    expect(result.fixed).toEqual(["PR001"]);
    expect(result.rejected).toHaveLength(0);
  });

  it("空の場合", () => {
    const result = parseFixerOutput("nothing here");
    expect(result.fixed).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});

describe("checkConvergence", () => {
  it("C=0, H=0 で収束", () => {
    const outputs = [
      parseReviewerOutput("ISSUE: M | minor | file:1\nVERDICT: GO", "PR", 1),
    ];
    const result = checkConvergence(outputs, new Set());
    expect(result.converged).toBe(true);
  });

  it("C>0 で未収束", () => {
    const outputs = [
      parseReviewerOutput("ISSUE: C | critical | file:1\nVERDICT: NO-GO", "PR", 1),
    ];
    const result = checkConvergence(outputs, new Set());
    expect(result.converged).toBe(false);
    if (!result.converged) {
      expect(result.reason).toContain("1 critical");
    }
  });

  it("H>0 で未収束", () => {
    const outputs = [
      parseReviewerOutput("ISSUE: H | high | file:1\nVERDICT: CONDITIONAL", "PR", 1),
    ];
    const result = checkConvergence(outputs, new Set());
    expect(result.converged).toBe(false);
  });

  it("修正済み issues を除外して収束判定", () => {
    const outputs = [
      parseReviewerOutput("ISSUE: C | crit | file:1\nVERDICT: NO-GO", "PR", 1),
    ];
    const result = checkConvergence(outputs, new Set(["PR001"]));
    expect(result.converged).toBe(true);
  });

  it("複数 reviewer の issues を統合する", () => {
    const out1 = parseReviewerOutput("ISSUE: H | h1 | f:1\nVERDICT: CONDITIONAL", "AR", 1);
    const out2 = parseReviewerOutput("ISSUE: C | c1 | f:2\nVERDICT: NO-GO", "AR", 10);
    const result = checkConvergence([out1, out2], new Set());
    expect(result.converged).toBe(false);
    if (!result.converged) {
      expect(result.remainingIssues).toHaveLength(2);
    }
  });
});

describe("validateVerdictLine", () => {
  it("VERDICT あり → null", () => {
    const output = parseReviewerOutput("VERDICT: GO", "PR", 1);
    expect(validateVerdictLine(output)).toBeNull();
  });

  it("VERDICT なし → エラーメッセージ", () => {
    const output = parseReviewerOutput("no verdict here", "PR", 1);
    const msg = validateVerdictLine(output);
    expect(msg).toContain("VERDICT line missing");
  });
});

describe("summarizeIssuesForFixer", () => {
  it("issues を箇条書きにする", () => {
    const issues = [
      { id: "AR001", severity: "C" as const, description: "Missing check", location: "api.ts:42", persona: "SEC" },
      { id: "AR002", severity: "H" as const, description: "No handling", location: "handler.ts:10", persona: "CODE" },
    ];
    const summary = summarizeIssuesForFixer(issues);
    expect(summary).toContain("[AR001]");
    expect(summary).toContain("[AR002]");
    expect(summary).toContain("Missing check");
  });

  it("空 issues で 'No issues' メッセージ", () => {
    expect(summarizeIssuesForFixer([])).toContain("No issues");
  });
});

/**
 * step-complete-validation.test.ts
 *
 * --step-complete / --steps-complete の result ファイル検証ゲートのテスト。
 */

import { describe, it, expect } from "vitest";
import { validateResultFile, resolveExpectedResultFile } from "../lib/team-state-machine.js";
import { FEATURE_FLOW, BUGFIX_FLOW } from "../lib/flow-definitions.js";

// --- ヘルパー ---

function mockFs(files: Record<string, string> = {}) {
  return {
    exists: (p: string) => p in files,
    readFile: (p: string) => {
      if (!(p in files)) throw new Error(`not found: ${p}`);
      return files[p]!;
    },
  };
}

// --- validateResultFile ---

describe("validateResultFile", () => {
  it("result ファイルが存在しない場合は invalid を返す", () => {
    const result = validateResultFile("/path/to/missing.json", mockFs());
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("dispatch-worker.js 成功出力 (type:result) を valid として受け入れる", () => {
    const realResult = JSON.stringify({
      type: "result",
      subtype: "success",
      duration_ms: 136509,
      num_turns: 1,
      session_id: "abc-123",
      modelUsage: { "qwen3.5": { inputTokens: 27323, outputTokens: 408, costUSD: 0.147 } },
    });
    const fs = mockFs({ "/result.json": realResult });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(true);
  });

  it("dispatch-worker.js 成功出力 (session_id なし) も valid として受け入れる", () => {
    const realResult = JSON.stringify({
      type: "result",
      subtype: "success",
      duration_ms: 50000,
      num_turns: 3,
    });
    const fs = mockFs({ "/result.json": realResult });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(true);
  });

  it("dispatch-worker.js 失敗出力 (status:failed + exitCode) を valid として受け入れる", () => {
    const failResult = JSON.stringify({
      status: "failed",
      exitCode: 124,
      attempts: 2,
      lastError: "timeout",
    });
    const fs = mockFs({ "/result.json": failResult });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(true);
  });

  it("Opus 捏造 (status:completed + artifacts) を invalid として拒否する", () => {
    const fakeResult = JSON.stringify({
      status: "completed",
      artifacts: ["spec.md"],
      summary: "spec.md とチェックリストを生成完了",
    });
    const fs = mockFs({ "/result.json": fakeResult });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("invalid result format");
    expect(result.reason).toContain("status,artifacts,summary");
  });

  it("Opus 捏造 (summary のみ) を invalid として拒否する", () => {
    const fakeResult = JSON.stringify({
      summary: "すべて完了",
      artifacts: ["plan.md", "spec.md"],
    });
    const fs = mockFs({ "/result.json": fakeResult });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(false);
  });

  it("不正 JSON を invalid として拒否する", () => {
    const fs = mockFs({ "/result.json": "not json {{{" });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not valid JSON");
  });

  it("空オブジェクトを invalid として拒否する", () => {
    const fs = mockFs({ "/result.json": "{}" });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("invalid result format");
  });

  it("status:failed で exitCode が文字列の場合は invalid として拒否する", () => {
    const badFail = JSON.stringify({
      status: "failed",
      exitCode: "124",
    });
    const fs = mockFs({ "/result.json": badFail });
    const result = validateResultFile("/result.json", fs);
    expect(result.valid).toBe(false);
  });
});

// --- resolveExpectedResultFile ---

describe("resolveExpectedResultFile", () => {
  it("team タイプのステップで -worker-result.json を返す", () => {
    const result = resolveExpectedResultFile("specify", "/proj/specs/001", FEATURE_FLOW);
    expect(result).toBe("/proj/specs/001/.pd-dispatch/specify-worker-result.json");
  });

  it("review-loop タイプのステップで -reviewer-result.json を返す", () => {
    const result = resolveExpectedResultFile("planreview", "/proj/specs/001", FEATURE_FLOW);
    expect(result).toBe("/proj/specs/001/.pd-dispatch/planreview-reviewer-result.json");
  });

  it("teamConfig がないステップで null を返す", () => {
    const flowDef = { steps: ["unknown"], teamConfig: {} };
    const result = resolveExpectedResultFile("unknown", "/proj/specs/001", flowDef);
    expect(result).toBeNull();
  });

  it("teamConfig 自体が未定義のフローで null を返す", () => {
    const flowDef = { steps: ["x"] };
    const result = resolveExpectedResultFile("x", "/proj/specs/001", flowDef);
    expect(result).toBeNull();
  });

  it("bugfix フローの bugfix ステップで -worker-result.json を返す", () => {
    const result = resolveExpectedResultFile("bugfix", "/proj/specs/001", BUGFIX_FLOW);
    expect(result).toBe("/proj/specs/001/.pd-dispatch/bugfix-worker-result.json");
  });

  it("implement ステップで -worker-result.json を返す", () => {
    const result = resolveExpectedResultFile("implement", "/proj/specs/001", FEATURE_FLOW);
    expect(result).toBe("/proj/specs/001/.pd-dispatch/implement-worker-result.json");
  });

  it("architecturereview (review-loop) で -reviewer-result.json を返す", () => {
    const result = resolveExpectedResultFile("architecturereview", "/proj/specs/001", FEATURE_FLOW);
    expect(result).toBe("/proj/specs/001/.pd-dispatch/architecturereview-reviewer-result.json");
  });
});

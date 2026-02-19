/**
 * apply-clarifications.test.ts
 *
 * applyClarifications() の単体テスト。
 * apply-clarifications.ts (apply-clarifications.sh TS 移植) のカバレッジ。
 */

import { describe, it, expect, vi } from "vitest";
import { applyClarifications } from "../lib/apply-clarifications.js";
import { makeFileSystem, makeStateManager } from "./fixtures/mocks.js";

// ================================================================
// バリデーションケース
// ================================================================

describe("applyClarifications - バリデーション", () => {
  it("pending-clarifications.json が存在しない → error", () => {
    const fs = makeFileSystem({
      "/fd/spec.md": "# Spec",
    });
    const result = applyClarifications({
      featureDir: "/fd",
      userAnswers: "My answers",
      fileSystem: fs,
    });
    expect(result.status).toBe("error");
    expect(result.error).toContain("no pending-clarifications.json");
  });

  it("spec.md が存在しない → error", () => {
    const fs = makeFileSystem({
      "/fd/pending-clarifications.json": JSON.stringify(["Q1"]),
    });
    const result = applyClarifications({
      featureDir: "/fd",
      userAnswers: "My answers",
      fileSystem: fs,
    });
    expect(result.status).toBe("error");
    expect(result.error).toContain("no spec.md");
  });

  it("userAnswers が空文字 → error", () => {
    const fs = makeFileSystem({
      "/fd/pending-clarifications.json": JSON.stringify(["Q1"]),
      "/fd/spec.md": "# Spec",
    });
    const result = applyClarifications({
      featureDir: "/fd",
      userAnswers: "   ",
      fileSystem: fs,
    });
    expect(result.status).toBe("error");
    expect(result.error).toContain("no answers");
  });

  it("pending-clarifications.json が不正 JSON → error", () => {
    const fs = makeFileSystem({
      "/fd/pending-clarifications.json": "INVALID JSON",
      "/fd/spec.md": "# Spec",
    });
    const result = applyClarifications({
      featureDir: "/fd",
      userAnswers: "My answers",
      fileSystem: fs,
    });
    expect(result.status).toBe("error");
  });
});

// ================================================================
// 正常系
// ================================================================

describe("applyClarifications - 正常系", () => {
  it("spec.md に Clarifications セクションを追記する", () => {
    const questions = ["[NEEDS CLARIFICATION: What is X?]", "[NEEDS CLARIFICATION: Why Y?]"];
    const fileSystem = makeFileSystem({
      "/fd/pending-clarifications.json": JSON.stringify(questions),
      "/fd/spec.md": "# Original Spec\n\nExisting content.",
    });

    const result = applyClarifications({
      featureDir: "/fd",
      userAnswers: "Answer A and B",
      fileSystem,
    });

    expect(result.status).toBe("applied");
    expect(result.questions).toBe(2);
    expect(result.spec).toBe("/fd/spec.md");

    // spec.md が更新されているか
    const writeCalls = (fileSystem.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const specWrite = writeCalls.find(([p]: string[]) => p === "/fd/spec.md");
    expect(specWrite).toBeDefined();
    const written = specWrite![1] as string;
    expect(written).toContain("## Clarifications");
    expect(written).toContain("Answer A and B");
    expect(written).toContain("What is X?");
    expect(written).toContain("Why Y?");
  });

  it("pending-clarifications.json を削除する", () => {
    const fileSystem = makeFileSystem({
      "/fd/pending-clarifications.json": JSON.stringify(["Q1"]),
      "/fd/spec.md": "# Spec",
    });

    applyClarifications({
      featureDir: "/fd",
      userAnswers: "Answer",
      fileSystem,
    });

    const removeCalls = (fileSystem.removeFile as ReturnType<typeof vi.fn>).mock.calls;
    const pendingRemoved = removeCalls.some(([p]: string[]) =>
      p?.includes("pending-clarifications.json")
    );
    expect(pendingRemoved).toBe(true);
  });

  it("stateManager が提供された場合 clearApproval を呼ぶ", () => {
    const fileSystem = makeFileSystem({
      "/fd/pending-clarifications.json": JSON.stringify(["Q1"]),
      "/fd/spec.md": "# Spec",
      "/fd/pipeline-state.json": "{}",
    });
    const stateManager = makeStateManager();

    applyClarifications({
      featureDir: "/fd",
      userAnswers: "Answer",
      fileSystem,
      stateManager,
    });

    expect(stateManager.clearApproval).toHaveBeenCalledWith("/fd/pipeline-state.json");
  });

  it("stateManager が提供されない場合 clearApproval を呼ばない（エラーにもならない）", () => {
    const fileSystem = makeFileSystem({
      "/fd/pending-clarifications.json": JSON.stringify(["Q1"]),
      "/fd/spec.md": "# Spec",
    });

    // stateManager なしで呼び出し
    expect(() =>
      applyClarifications({
        featureDir: "/fd",
        userAnswers: "Answer",
        fileSystem,
      })
    ).not.toThrow();
  });

  it("質問の [NEEDS CLARIFICATION: ...] マーカーを除去して表示する", () => {
    const fileSystem = makeFileSystem({
      "/fd/pending-clarifications.json": JSON.stringify([
        "[NEEDS CLARIFICATION: What is the target audience?]",
      ]),
      "/fd/spec.md": "# Spec",
    });

    applyClarifications({
      featureDir: "/fd",
      userAnswers: "Developers",
      fileSystem,
    });

    const writeCalls = (fileSystem.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const specWrite = writeCalls.find(([p]: string[]) => p === "/fd/spec.md");
    const written = specWrite![1] as string;
    expect(written).toContain("What is the target audience?");
    expect(written).not.toContain("[NEEDS CLARIFICATION:");
  });
});

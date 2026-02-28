/**
 * team-instruction.test.ts
 *
 * buildBashDispatchPrompt / buildBashReviewPrompt のテスト。
 */

import { describe, it, expect } from "vitest";
import {
  buildBashDispatchPrompt,
  buildBashReviewPrompt,
  buildBashFixerBasePrompt,
  rewriteRelativeFilePaths,
} from "../lib/team-instruction.js";
import { FEATURE_FLOW } from "../lib/flow-definitions.js";
import type { FlowDefinition } from "../lib/flow-types.js";

function mockFs(files: Record<string, string> = {}) {
  return {
    exists: (p: string) => p in files,
    readFile: (p: string) => {
      if (!(p in files)) throw new Error(`not found: ${p}`);
      return files[p]!;
    },
  };
}

describe("buildBashDispatchPrompt", () => {
  it("inject ファイルの内容をプロンプトに埋め込む", () => {
    const fs = mockFs({
      "/proj/specs/001/spec.md": "# Spec Content\nFeature details here",
    });

    // contextInject で spec を inject 指定するフロー
    const flowDef: FlowDefinition = {
      steps: ["plan"],
      context: { plan: { spec: "spec.md" } },
      contextInject: { plan: { spec: true } },
      artifacts: { plan: "plan.md" },
    };

    const prompt = buildBashDispatchPrompt("plan", "/proj/specs/001", flowDef, fs);

    expect(prompt).toContain("Step: plan");
    expect(prompt).toContain("## Context: spec");
    expect(prompt).toContain("# Spec Content");
    expect(prompt).toContain("Feature details here");
    expect(prompt).toContain("[inject — content below]");
  });

  it("self-read ファイルはパスのみ記載する", () => {
    const fs = mockFs({
      "/proj/specs/001/spec.md": "spec content",
      "/proj/specs/001/plan.md": "plan content",
    });

    const flowDef: FlowDefinition = {
      steps: ["tasks"],
      context: { tasks: { spec: "spec.md", plan: "plan.md" } },
      contextInject: { tasks: { spec: true, plan: false } },
      artifacts: { tasks: "tasks.md" },
    };

    const prompt = buildBashDispatchPrompt("tasks", "/proj/specs/001", flowDef, fs);

    // spec は inject
    expect(prompt).toContain("## Context: spec");
    expect(prompt).toContain("spec content");

    // plan は self-read
    expect(prompt).toContain("[self-read — use Read tool]");
    expect(prompt).not.toContain("## Context: plan");
    expect(prompt).not.toContain("plan content");
  });

  it("50,000 文字超の inject ファイルを切り詰める", () => {
    const longContent = "x".repeat(60_000);
    const fs = mockFs({
      "/proj/specs/001/spec.md": longContent,
    });

    const flowDef: FlowDefinition = {
      steps: ["plan"],
      context: { plan: { spec: "spec.md" } },
      contextInject: { plan: { spec: true } },
    };

    const prompt = buildBashDispatchPrompt("plan", "/proj/specs/001", flowDef, fs);

    expect(prompt).toContain("... (truncated)");
    // 50000 + header + truncation marker should be less than 60000
    expect(prompt.length).toBeLessThan(55_000);
  });

  it("SendMessage 不使用の指示を末尾に含む", () => {
    const prompt = buildBashDispatchPrompt("specify", "/proj/specs/001", {
      steps: ["specify"],
      artifacts: { specify: "spec.md" },
    }, mockFs());

    expect(prompt).toContain("SendMessage ツールは使用不可");
    expect(prompt).toContain("Bash Dispatch");
  });

  it("FEATURE_FLOW の implement ステップで spec と tasks を inject する", () => {
    const fs = mockFs({
      "/proj/specs/001/spec.md": "# Spec\nFeature spec content",
      "/proj/specs/001/tasks.md": "# Tasks\n- Task 1: implement",
      "/proj/specs/001/plan.md": "# Plan\nArchitecture details",
    });
    const prompt = buildBashDispatchPrompt("implement", "/proj/specs/001", FEATURE_FLOW, fs);

    // spec と tasks は inject
    expect(prompt).toContain("## Context: spec");
    expect(prompt).toContain("Feature spec content");
    expect(prompt).toContain("## Context: tasks");
    expect(prompt).toContain("Task 1: implement");
    // plan は self-read
    expect(prompt).toContain("plan.md");
    expect(prompt).toContain("[self-read");
    expect(prompt).not.toContain("## Context: plan");
  });

  it("FEATURE_FLOW の specify ステップで正しい出力パスを含む", () => {
    const prompt = buildBashDispatchPrompt(
      "specify",
      "/proj/specs/001",
      FEATURE_FLOW,
      mockFs()
    );

    expect(prompt).toContain("Step: specify");
    expect(prompt).toContain("spec.md");
  });
});

describe("buildBashReviewPrompt", () => {
  it("ターゲットファイルリストを含む", () => {
    const targets = ["/proj/specs/001/plan.md", "/proj/specs/001/spec.md"];
    const prompt = buildBashReviewPrompt(
      "planreview",
      "/proj/specs/001",
      targets,
      { steps: ["planreview"] },
      mockFs()
    );

    expect(prompt).toContain("/proj/specs/001/plan.md");
    expect(prompt).toContain("/proj/specs/001/spec.md");
    expect(prompt).toContain("Reviewer");
  });

  it("priorFixes ありの場合 'Already Fixed' セクションを含む", () => {
    const targets = ["/proj/specs/001/index.html"];
    const priorFixes = [
      "(architecturereview) SRIハッシュを追加",
      "(architecturereview) CSP ヘッダー設定",
    ];
    const prompt = buildBashReviewPrompt(
      "qualityreview",
      "/proj/specs/001",
      targets,
      { steps: ["qualityreview"] },
      mockFs(),
      priorFixes
    );

    expect(prompt).toContain("## Already Fixed (do not re-flag)");
    expect(prompt).toContain("(architecturereview) SRIハッシュを追加");
    expect(prompt).toContain("(architecturereview) CSP ヘッダー設定");
  });

  it("priorFixes が空の場合 'Already Fixed' セクションを含まない", () => {
    const targets = ["/proj/specs/001/index.html"];
    const prompt = buildBashReviewPrompt(
      "qualityreview",
      "/proj/specs/001",
      targets,
      { steps: ["qualityreview"] },
      mockFs(),
      []
    );

    expect(prompt).not.toContain("Already Fixed");
  });
});

describe("CRITICAL directive for implement/testdesign", () => {
  it("implement ステップで CRITICAL ディレクティブを含む", () => {
    const fs = mockFs({
      "/proj/specs/001/spec.md": "spec",
      "/proj/specs/001/tasks.md": "tasks",
    });
    const prompt = buildBashDispatchPrompt("implement", "/proj/specs/001", FEATURE_FLOW, fs);
    expect(prompt).toContain("CRITICAL:");
    expect(prompt).toContain("/proj/specs/001/");
    expect(prompt).toContain("Do NOT write files to the current working directory");
  });

  it("testdesign ステップで CRITICAL ディレクティブを含む", () => {
    const fs = mockFs({
      "/proj/specs/001/spec.md": "spec",
      "/proj/specs/001/tasks.md": "tasks",
    });
    const prompt = buildBashDispatchPrompt("testdesign", "/proj/specs/001", FEATURE_FLOW, fs);
    expect(prompt).toContain("CRITICAL:");
    expect(prompt).toContain("/proj/specs/001/");
  });

  it("plan ステップで CRITICAL ディレクティブを含まない", () => {
    const fs = mockFs({
      "/proj/specs/001/spec.md": "spec",
    });
    const prompt = buildBashDispatchPrompt("plan", "/proj/specs/001", FEATURE_FLOW, fs);
    expect(prompt).not.toContain("CRITICAL:");
  });

  it("specify ステップで CRITICAL ディレクティブを含まない", () => {
    const prompt = buildBashDispatchPrompt("specify", "/proj/specs/001", FEATURE_FLOW, mockFs());
    expect(prompt).not.toContain("CRITICAL:");
  });
});

describe("rewriteRelativeFilePaths", () => {
  it("相対パスを絶対パスに変換する", () => {
    const content = "**File**: `index.html`\nSome text\n**File**: `styles/main.css`";
    const result = rewriteRelativeFilePaths(content, "/proj/specs/001");
    expect(result).toContain("**File**: `/proj/specs/001/index.html`");
    expect(result).toContain("**File**: `/proj/specs/001/styles/main.css`");
  });

  it("既に絶対パスの場合は変換しない", () => {
    const content = "**File**: `/absolute/path/index.html`";
    const result = rewriteRelativeFilePaths(content, "/proj/specs/001");
    expect(result).toBe("**File**: `/absolute/path/index.html`");
  });

  it("マッチしない場合は変換なし", () => {
    const content = "No file references here.\nJust plain text.";
    const result = rewriteRelativeFilePaths(content, "/proj/specs/001");
    expect(result).toBe(content);
  });

  it("inject 時に tasks.md 内の相対パスが変換される", () => {
    const fs = mockFs({
      "/proj/specs/001/spec.md": "spec content",
      "/proj/specs/001/tasks.md": "# Tasks\n- Task 1\n  **File**: `index.html`\n  **File**: `app.js`",
    });
    const prompt = buildBashDispatchPrompt("implement", "/proj/specs/001", FEATURE_FLOW, fs);
    expect(prompt).toContain("**File**: `/proj/specs/001/index.html`");
    expect(prompt).toContain("**File**: `/proj/specs/001/app.js`");
  });
});

describe("buildBashFixerBasePrompt", () => {
  it("Fixer ロールの記述を含む", () => {
    const targets = ["/proj/specs/001/plan.md"];
    const prompt = buildBashFixerBasePrompt(
      "planreview",
      "/proj/specs/001",
      targets,
      { steps: ["planreview"] },
      mockFs()
    );

    expect(prompt).toContain("Fixer");
    expect(prompt).toContain("fix issues");
    expect(prompt).toContain("Bash Dispatch");
  });
});

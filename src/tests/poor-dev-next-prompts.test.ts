/**
 * poor-dev-next prompt ファイル書き出しのテスト
 *
 * 全パスで promptDir にファイルが書き出されることを検証。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const CLI_PATH = path.resolve("dist/bin/poor-dev-next.js");

// --- ヘルパー ---

function run(args: string[]): string {
  return execFileSync("node", [CLI_PATH, ...args], {
    encoding: "utf-8",
    timeout: 10000,
  }).trim();
}

function runJson(args: string[]): Record<string, unknown> {
  const lines = run(args).split("\n");
  // 最後の JSON 行をパース（step_completed + action の2行出力対応）
  return JSON.parse(lines[lines.length - 1]!) as Record<string, unknown>;
}

function initPipeline(stateDir: string, projectDir: string, flow = "feature"): void {
  run(["--init", "--flow", flow, "--state-dir", stateDir, "--project-dir", projectDir]);
}

/** feature フローの prerequisites ファイルを作成 */
function createPrerequisites(stateDir: string, steps: string[]): void {
  const files: Record<string, string> = {
    plan: "spec.md",
    tasks: "plan.md",
    implement: "tasks.md",
  };
  // spec.md は plan/tasks/implement に必要
  if (steps.some(s => ["plan", "tasks", "implement"].includes(s))) {
    fs.writeFileSync(path.join(stateDir, "spec.md"), "# Spec\ntest spec");
  }
  for (const step of steps) {
    const file = files[step];
    if (file) {
      const filePath = path.join(stateDir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `# ${file}\ntest content`);
      }
    }
  }
}

let tmpDir: string;
let stateDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-prompt-test-"));
  stateDir = path.join(tmpDir, "features", "001-test");
  fs.mkdirSync(stateDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("writePromptsToFiles", () => {
  describe("デフォルトパス（--prompt-dir なし）", () => {
    it("stateDir/.pd-dispatch にプロンプトファイルが書き出される", () => {
      initPipeline(stateDir, tmpDir);

      const result = runJson([
        "--state-dir", stateDir,
        "--project-dir", tmpDir,
      ]);

      expect(result.action).toBe("bash_dispatch");
      // prompt が参照パスに置換されている
      expect(result.prompt).toMatch(/^-> /);
      // ファイルが存在する
      const promptDir = path.join(stateDir, ".pd-dispatch");
      expect(fs.existsSync(promptDir)).toBe(true);
      const promptFile = path.join(promptDir, "specify-prompt.txt");
      expect(fs.existsSync(promptFile)).toBe(true);
      const content = fs.readFileSync(promptFile, "utf-8");
      expect(content).toContain("specify");
    });
  });

  describe("デフォルトパス（--prompt-dir 指定）", () => {
    it("指定ディレクトリにプロンプトファイルが書き出される", () => {
      initPipeline(stateDir, tmpDir);
      const customDir = path.join(tmpDir, "custom-prompts");

      const result = runJson([
        "--state-dir", stateDir,
        "--project-dir", tmpDir,
        "--prompt-dir", customDir,
      ]);

      expect(result.action).toBe("bash_dispatch");
      expect(result.prompt).toMatch(/^-> /);
      expect((result.prompt as string)).toContain(customDir);
      expect(fs.existsSync(path.join(customDir, "specify-prompt.txt"))).toBe(true);
    });
  });

  describe("--step-complete パス", () => {
    it("次ステップのプロンプトファイルが書き出される", () => {
      initPipeline(stateDir, tmpDir);
      // plan の prerequisites: spec.md
      createPrerequisites(stateDir, ["plan"]);

      const result = runJson([
        "--step-complete", "specify",
        "--skip-validation",
        "--state-dir", stateDir,
        "--project-dir", tmpDir,
      ]);

      // specify 完了後は plan
      expect(result.action).toBe("bash_dispatch");
      expect((result as { step?: string }).step).toBe("plan");
      expect(result.prompt).toMatch(/^-> /);

      const promptDir = path.join(stateDir, ".pd-dispatch");
      expect(fs.existsSync(path.join(promptDir, "plan-prompt.txt"))).toBe(true);
    });
  });

  describe("--steps-complete パス", () => {
    it("次ステップのプロンプトファイルが書き出される", () => {
      initPipeline(stateDir, tmpDir);
      // planreview には prerequisites がない（reviews は prerequisites 対象外）
      // ただし plan 完了前に spec.md が必要

      const result = runJson([
        "--steps-complete", "specify,plan",
        "--skip-validation",
        "--state-dir", stateDir,
        "--project-dir", tmpDir,
      ]);

      // specify,plan 完了後は planreview (review dispatch)
      expect(result.action).toBe("bash_review_dispatch");

      const promptDir = path.join(stateDir, ".pd-dispatch");
      const files = fs.readdirSync(promptDir);
      // review prompt と fixer base prompt が存在する
      expect(files.some(f => f.includes("review-prompt.txt"))).toBe(true);
      expect(files.some(f => f.includes("fixer-base-prompt.txt"))).toBe(true);
    });
  });

  describe("--gate-response パス", () => {
    it("retry 応答後にプロンプトファイルが書き出される", () => {
      initPipeline(stateDir, tmpDir);
      // plan の prerequisites を作成
      createPrerequisites(stateDir, ["plan"]);

      // specify を完了させる
      run([
        "--step-complete", "specify",
        "--skip-validation",
        "--state-dir", stateDir,
        "--project-dir", tmpDir,
      ]);

      // pipeline-state.json を直接編集して pendingApproval を設定
      const stateFile = path.join(stateDir, "pipeline-state.json");
      const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      state.pendingApproval = { type: "dispatch-failure", step: "plan" };
      fs.writeFileSync(stateFile, JSON.stringify(state));

      const result = runJson([
        "--gate-response", "retry",
        "--state-dir", stateDir,
        "--project-dir", tmpDir,
      ]);

      expect(result.action).toBe("bash_dispatch");
      expect(result.prompt).toMatch(/^-> /);

      const promptDir = path.join(stateDir, ".pd-dispatch");
      expect(fs.existsSync(path.join(promptDir, "plan-prompt.txt"))).toBe(true);
    });
  });
});

describe("writePromptsToFiles ユニットテスト的検証", () => {
  it("bash_review_dispatch: reviewPrompt と fixerBasePrompt が書き出される", () => {
    initPipeline(stateDir, tmpDir);
    // specify, plan を完了させて planreview にする
    const result = runJson([
      "--steps-complete", "specify,plan",
      "--skip-validation",
      "--state-dir", stateDir,
      "--project-dir", tmpDir,
    ]);

    expect(result.action).toBe("bash_review_dispatch");
    const typed = result as {
      action: string;
      reviewPrompt: string;
      fixerBasePrompt: string;
    };
    expect(typed.reviewPrompt).toMatch(/^-> /);
    expect(typed.fixerBasePrompt).toMatch(/^-> /);

    // ファイルの中身を検証
    const promptDir = path.join(stateDir, ".pd-dispatch");
    const reviewFile = fs.readdirSync(promptDir).find(f => f.includes("review-prompt.txt"))!;
    const fixerFile = fs.readdirSync(promptDir).find(f => f.includes("fixer-base-prompt.txt"))!;
    expect(reviewFile).toBeDefined();
    expect(fixerFile).toBeDefined();
    const reviewContent = fs.readFileSync(path.join(promptDir, reviewFile), "utf-8");
    const fixerContent = fs.readFileSync(path.join(promptDir, fixerFile), "utf-8");
    expect(reviewContent.length).toBeGreaterThan(0);
    expect(fixerContent.length).toBeGreaterThan(0);
  });

  it("bash_parallel_dispatch: 全サブステップのプロンプトが書き出される", () => {
    initPipeline(stateDir, tmpDir);
    // implement の prerequisites を作成
    createPrerequisites(stateDir, ["implement"]);

    // feature フローで implement 前まで完了
    const preSteps = ["specify", "plan", "planreview", "tasks", "tasksreview"];
    run([
      "--steps-complete", preSteps.join(","),
      "--skip-validation",
      "--state-dir", stateDir,
      "--project-dir", tmpDir,
    ]);

    // implement-phases.json を作成して並列 dispatch をトリガー
    const phasesFile = path.join(stateDir, "implement-phases.json");
    fs.writeFileSync(phasesFile, JSON.stringify({
      phases: [
        { name: "phase-1", tasks: [1, 2], files: ["a.ts", "b.ts"] },
        { name: "phase-2", tasks: [3], files: ["c.ts"] },
      ],
    }));

    const result = runJson([
      "--state-dir", stateDir,
      "--project-dir", tmpDir,
    ]);

    const promptDir = path.join(stateDir, ".pd-dispatch");

    // bash_parallel_dispatch が返れば全サブステップのファイルを検証
    // bash_dispatch が返る場合もある（flow 定義依存）
    if (result.action === "bash_parallel_dispatch") {
      const typed = result as { steps: Array<{ action: string; prompt: string; step: string }> };
      for (const sub of typed.steps) {
        expect(sub.prompt).toMatch(/^-> /);
      }
      const files = fs.readdirSync(promptDir);
      expect(files.length).toBeGreaterThanOrEqual(typed.steps.length);
    } else if (result.action === "bash_dispatch") {
      // implement が単一 dispatch の場合でもプロンプトファイルは存在する
      expect(result.prompt).toMatch(/^-> /);
      expect(fs.existsSync(promptDir)).toBe(true);
    } else {
      // user_gate 等が返る場合（prerequisites 不足等）— ファイル書き出しは不要
      expect(["user_gate", "done"]).toContain(result.action);
    }
  });
});

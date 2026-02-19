/**
 * team-state-machine.test.ts
 *
 * computeNextInstruction のテスト。
 */

import { describe, it, expect } from "vitest";
import { computeNextInstruction, type ComputeContext } from "../lib/team-state-machine.js";
import { FEATURE_FLOW, BUGFIX_FLOW } from "../lib/flow-definitions.js";
import type { PipelineState } from "../lib/types.js";

// --- ヘルパー ---

function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    flow: "feature",
    variant: null,
    pipeline: [],
    completed: [],
    current: null,
    status: "active",
    pauseReason: null,
    condition: null,
    pendingApproval: null,
    updated: new Date().toISOString(),
    ...overrides,
  };
}

function mockFs(files: Record<string, string> = {}) {
  return {
    exists: (p: string) => p in files,
    readFile: (p: string) => {
      if (!(p in files)) throw new Error(`not found: ${p}`);
      return files[p]!;
    },
  };
}

function makeCtx(overrides: Partial<ComputeContext> = {}): ComputeContext {
  return {
    state: makeState(),
    featureDir: "specs/001-test",
    projectDir: "/proj",
    flowDef: FEATURE_FLOW,
    useAgentTeams: true,
    ...overrides,
  };
}

// --- テスト ---

describe("computeNextInstruction", () => {
  describe("Agent Teams パス", () => {
    it("初期状態で最初のステップの create_team を返す", () => {
      const ctx = makeCtx();
      const action = computeNextInstruction(ctx, mockFs());

      expect(action.action).toBe("create_team");
      if (action.action === "create_team") {
        expect(action.step).toBe("specify");
        expect(action.team_name).toBe("pd-specify-001");
        expect(action.teammates.length).toBeGreaterThan(0);
      }
    });

    it("specify 完了後に suggest の create_team を返す", () => {
      const ctx = makeCtx({
        state: makeState({ completed: ["specify"] }),
      });
      // suggest には spec.md が必要
      const fs = mockFs({ "/proj/specs/001-test/spec.md": "spec" });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("create_team");
      if (action.action === "create_team") {
        expect(action.step).toBe("suggest");
      }
    });

    it("レビューステップで create_review_team を返す", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: ["specify", "suggest", "plan"],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/plan.md": "plan",
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("create_review_team");
      if (action.action === "create_review_team") {
        expect(action.step).toBe("planreview");
        expect(action.communication).toBe("opus-mediated");
        expect(action.max_iterations).toBe(12);
      }
    });

    it("全ステップ完了で done を返す", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [...FEATURE_FLOW.steps],
        }),
      });
      const action = computeNextInstruction(ctx, mockFs());

      expect(action.action).toBe("done");
      if (action.action === "done") {
        expect(action.summary).toContain("completed");
      }
    });

    it("前提ファイル欠落で user_gate を返す", () => {
      const ctx = makeCtx({
        state: makeState({ completed: ["specify"] }),
      });
      // spec.md がない → suggest の前提失敗
      const action = computeNextInstruction(ctx, mockFs());

      expect(action.action).toBe("user_gate");
      if (action.action === "user_gate") {
        expect(action.step).toBe("suggest");
        expect(action.message).toContain("spec.md");
      }
    });
  });

  describe("レガシーパス", () => {
    it("useAgentTeams=false で dispatch_step を返す", () => {
      const ctx = makeCtx({ useAgentTeams: false });
      const action = computeNextInstruction(ctx, mockFs());

      expect(action.action).toBe("dispatch_step");
      if (action.action === "dispatch_step") {
        expect(action.step).toBe("specify");
        expect(action.commandFile).toContain("poor-dev.specify.md");
      }
    });
  });

  describe("pipeline 上書き", () => {
    it("state.pipeline が設定されていればそれを使う", () => {
      const ctx = makeCtx({
        state: makeState({
          pipeline: ["tasks", "implement"],
          completed: ["tasks"],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/tasks.md": "tasks",
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("create_team");
      if (action.action === "create_team") {
        expect(action.step).toBe("implement");
      }
    });
  });

  describe("done アクションの artifacts", () => {
    it("存在するアーティファクトファイルを収集する", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [...FEATURE_FLOW.steps],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
        "/proj/specs/001-test/plan.md": "plan",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("done");
      if (action.action === "done") {
        expect(action.artifacts).toContain("/proj/specs/001-test/spec.md");
        expect(action.artifacts).toContain("/proj/specs/001-test/plan.md");
      }
    });
  });
});

/**
 * team-state-machine.test.ts
 *
 * computeNextInstruction のテスト。
 */

import { describe, it, expect } from "vitest";
import { computeNextInstruction, type ComputeContext } from "../lib/team-state-machine.js";
import { FEATURE_FLOW, BUGFIX_FLOW, EXPLORATION_FLOW } from "../lib/flow-definitions.js";
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
    ...overrides,
  };
}

// --- テスト ---

describe("computeNextInstruction", () => {
  describe("Bash Dispatch パス", () => {
    it("初期状態で最初のステップの bash_dispatch を返す", () => {
      const ctx = makeCtx();
      const action = computeNextInstruction(ctx, mockFs());

      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action.step).toBe("specify");
        expect(action.worker.role).toBe("worker-specify");
        expect(action.worker.agentFile).toBe("agents/claude/worker-specify.md");
        expect(action.worker.tools).toBe("Read,Write,Edit,Bash,Grep,Glob");
        expect(action.worker.maxTurns).toBe(30);
        expect(action.prompt).toContain("Step: specify");
        expect(action.prompt).toContain("Bash Dispatch");
        expect(action.prompt).toContain("SendMessage");
        // command フィールド検証
        expect(action.command).toContain("dispatch-worker.js");
        expect(action.command).toContain("--prompt-file");
        expect(action.command).toContain("specify-prompt.txt");
        expect(action.command).toContain("--result-file");
        expect(action.command).toContain("specify-worker-result.json");
        expect(action.command).toContain("--timeout 600");
        expect(action.command).toContain("--max-retries 1");
        expect(action.command).toContain("--append-system-prompt-file agents/claude/worker-specify.md");
      }
    });

    it("specify 完了後に plan の bash_dispatch を返す", () => {
      const ctx = makeCtx({
        state: makeState({ completed: ["specify"] }),
      });
      // plan には spec.md が必要
      const fs = mockFs({ "/proj/specs/001-test/spec.md": "spec" });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action.step).toBe("plan");
      }
    });

    it("レビューステップで bash_review_dispatch を返す", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: ["specify", "plan"],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/plan.md": "plan",
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_review_dispatch");
      if (action.action === "bash_review_dispatch") {
        expect(action.step).toBe("planreview");
        expect(action.reviewer.role).toBe("reviewer-plan-unified");
        expect(action.reviewer.tools).toBe("Read,Glob,Grep");
        expect(action.fixer.role).toBe("review-fixer");
        expect(action.fixer.tools).toBe("Read,Write,Edit,Bash,Grep,Glob");
        expect(action.maxIterations).toBe(4);
        expect(action.reviewPrompt).toContain("Step: planreview");
        expect(action.fixerBasePrompt).toContain("Step: planreview");
        // reviewerCommand フィールド検証
        expect(action.reviewerCommand).toContain("dispatch-worker.js");
        expect(action.reviewerCommand).toContain("--prompt-file");
        expect(action.reviewerCommand).toContain("planreview-review-prompt.txt");
        expect(action.reviewerCommand).toContain("--result-file");
        expect(action.reviewerCommand).toContain("planreview-reviewer-result.json");
        expect(action.reviewerCommand).toContain("--append-system-prompt-file agents/claude/reviewer-plan-unified.md");
        // fixerCommandPrefix フィールド検証
        expect(action.fixerCommandPrefix).toContain("dispatch-worker.js");
        expect(action.fixerCommandPrefix).not.toContain("--prompt-file");
        expect(action.fixerCommandPrefix).toContain("--result-file");
        expect(action.fixerCommandPrefix).toContain("planreview-fixer-result.json");
        expect(action.fixerCommandPrefix).toContain("--append-system-prompt-file agents/claude/review-fixer.md");
      }
    });

    it("_meta が付与される", () => {
      const ctx = makeCtx();
      const action = computeNextInstruction(ctx, mockFs());

      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action._meta).toBeDefined();
        expect(action._meta!.recovery_hint).toContain("poor-dev-next.js");
        expect(action._meta!.step_complete_cmd).toContain("--step-complete specify");
      }
    });
  });

  describe("全ステップ完了", () => {
    it("done を返す", () => {
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
  });

  describe("前提ファイル欠落", () => {
    it("user_gate を返す", () => {
      const ctx = makeCtx({
        state: makeState({ completed: ["specify"] }),
      });
      // spec.md がない → plan の前提失敗
      const action = computeNextInstruction(ctx, mockFs());

      expect(action.action).toBe("user_gate");
      if (action.action === "user_gate") {
        expect(action.step).toBe("plan");
        expect(action.message).toContain("spec.md");
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

      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action.step).toBe("implement");
      }
    });
  });

  describe("status ガード", () => {
    it("paused 状態で user_gate (resume/abort) を返す", () => {
      const ctx = makeCtx({
        state: makeState({
          status: "paused",
          current: "implement",
          pauseReason: "Reclassified as feature",
        }),
      });
      const action = computeNextInstruction(ctx, mockFs());
      expect(action.action).toBe("user_gate");
      if (action.action === "user_gate") {
        expect(action.step).toBe("implement");
        expect(action.message).toBe("Reclassified as feature");
        expect(action.options).toContain("resume");
        expect(action.options).toContain("abort");
      }
    });

    it("awaiting-approval 状態で user_gate (approve/reject) を返す", () => {
      const ctx = makeCtx({
        state: makeState({
          status: "awaiting-approval",
          pendingApproval: { type: "review", step: "planreview" },
        }),
      });
      const action = computeNextInstruction(ctx, mockFs());
      expect(action.action).toBe("user_gate");
      if (action.action === "user_gate") {
        expect(action.step).toBe("planreview");
        expect(action.message).toContain("review");
        expect(action.options).toContain("approve");
        expect(action.options).toContain("reject");
      }
    });

    it("completed 状態で done を返す", () => {
      const ctx = makeCtx({
        state: makeState({ status: "completed" }),
      });
      const action = computeNextInstruction(ctx, mockFs());
      expect(action.action).toBe("done");
      if (action.action === "done") {
        expect(action.summary).toContain("already completed");
      }
    });

    it("paused で pauseReason が null の場合デフォルトメッセージを返す", () => {
      const ctx = makeCtx({
        state: makeState({ status: "paused", pauseReason: null }),
      });
      const action = computeNextInstruction(ctx, mockFs());
      expect(action.action).toBe("user_gate");
      if (action.action === "user_gate") {
        expect(action.message).toBe("Pipeline paused");
      }
    });

    it("awaiting-approval + user-gate で gateOptions 付き user_gate を返す", () => {
      const ctx = makeCtx({
        state: makeState({
          flow: "exploration",
          status: "awaiting-approval",
          pendingApproval: { type: "user-gate", step: "discovery" },
        }),
        flowDef: EXPLORATION_FLOW,
      });
      const action = computeNextInstruction(ctx, mockFs());
      expect(action.action).toBe("user_gate");
      if (action.action === "user_gate") {
        expect(action.step).toBe("discovery");
        expect(action.message).toContain("探索が完了しました");
        expect(action.gateOptions).toBeDefined();
        expect(action.gateOptions).toHaveLength(3);
        expect(action.gateOptions![0]!.conditionalKey).toBe("discovery:ROADMAP");
        expect(action.options).toHaveLength(3);
      }
    });

    it("awaiting-approval + user-gate で flowDef に gate がない場合は通常 approval", () => {
      const ctx = makeCtx({
        state: makeState({
          status: "awaiting-approval",
          pendingApproval: { type: "user-gate", step: "nonexistent" },
        }),
        flowDef: FEATURE_FLOW,
      });
      const action = computeNextInstruction(ctx, mockFs());
      expect(action.action).toBe("user_gate");
      if (action.action === "user_gate") {
        expect(action.gateOptions).toBeUndefined();
        expect(action.options).toContain("approve");
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

  describe("配列 artifacts", () => {
    it("plan の bash_dispatch で string artifact が返る", () => {
      const ctx = makeCtx({
        state: makeState({ completed: ["specify"] }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action.step).toBe("plan");
        expect(action.artifacts).toEqual(["/proj/specs/001-test/plan.md"]);
      }
    });

    it("implement の bash_dispatch で '*' sentinel artifacts が返る", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: ["specify", "plan", "planreview", "tasks", "tasksreview"],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/tasks.md": "tasks",
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action.step).toBe("implement");
        expect(action.artifacts).toEqual(["*"]);
      }
    });

    it("implement の bash_dispatch で spec と tasks が inject される", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: ["specify", "plan", "planreview", "tasks", "tasksreview"],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/tasks.md": "# Tasks\n- Task 1",
        "/proj/specs/001-test/spec.md": "# Spec\nFeature details",
        "/proj/specs/001-test/plan.md": "# Plan\nArchitecture",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action.step).toBe("implement");
        // spec と tasks は inject
        expect(action.prompt).toContain("## Context: spec");
        expect(action.prompt).toContain("Feature details");
        expect(action.prompt).toContain("## Context: tasks");
        expect(action.prompt).toContain("Task 1");
        // plan は self-read
        expect(action.prompt).toContain("[self-read");
        expect(action.prompt).not.toContain("## Context: plan");
      }
    });
  });

  describe("reviewTargets '*' パターン", () => {
    it("reviewTargets='*' で feature dir 全体を target にする", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [
            "specify", "plan", "planreview",
            "tasks", "tasksreview", "implement", "testdesign",
          ],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_review_dispatch");
      if (action.action === "bash_review_dispatch") {
        expect(action.step).toBe("architecturereview");
        expect(action.targetFiles).toEqual(["/proj/specs/001-test"]);
      }
    });
  });

  describe("unified review teams", () => {
    it("architecturereview が reviewer-arch-unified を使う", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [
            "specify", "plan", "planreview",
            "tasks", "tasksreview", "implement", "testdesign",
          ],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_review_dispatch");
      if (action.action === "bash_review_dispatch") {
        expect(action.reviewer.role).toBe("reviewer-arch-unified");
        expect(action.fixer.role).toBe("review-fixer");
      }
    });
  });

  describe("parallelGroups 並列ディスパッチ", () => {
    it("全ステップ未完了 → bash_parallel_dispatch を返す", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [
            "specify", "plan", "planreview",
            "tasks", "tasksreview", "implement",
          ],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_parallel_dispatch");
      if (action.action === "bash_parallel_dispatch") {
        expect(action.steps).toHaveLength(3);
        const stepNames = action.steps.map((s) => s.step);
        expect(stepNames).toContain("testdesign");
        expect(stepNames).toContain("architecturereview");
        expect(stepNames).toContain("qualityreview");
        // testdesign は bash_dispatch、残り2つは bash_review_dispatch
        const testdesignAction = action.steps.find((s) => s.step === "testdesign");
        expect(testdesignAction?.action).toBe("bash_dispatch");
        const archAction = action.steps.find((s) => s.step === "architecturereview");
        expect(archAction?.action).toBe("bash_review_dispatch");
        // _meta に steps-complete コマンドが含まれる
        expect(action._meta).toBeDefined();
        expect(action._meta!.step_complete_cmd).toContain("--steps-complete");
        expect(action._meta!.step_complete_cmd).toContain("testdesign,architecturereview,qualityreview");
        // 並列グループ内の各ステップに command フィールドがある
        if (testdesignAction?.action === "bash_dispatch") {
          expect(testdesignAction.command).toContain("dispatch-worker.js");
          expect(testdesignAction.command).toContain("testdesign-prompt.txt");
        }
        if (archAction?.action === "bash_review_dispatch") {
          expect(archAction.reviewerCommand).toContain("dispatch-worker.js");
          expect(archAction.fixerCommandPrefix).toContain("dispatch-worker.js");
          expect(archAction.fixerCommandPrefix).not.toContain("--prompt-file");
        }
      }
    });

    it("一部完了済み → 単一ステップ bash_review_dispatch にフォールバック", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [
            "specify", "plan", "planreview",
            "tasks", "tasksreview", "implement", "testdesign",
          ],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      // testdesign 完了済みなので parallelGroup 不成立 → 単一ステップ
      expect(action.action).toBe("bash_review_dispatch");
      if (action.action === "bash_review_dispatch") {
        expect(action.step).toBe("architecturereview");
      }
    });

    it("parallelGroups 未定義のフロー → 従来の単一ステップ動作", () => {
      const ctx = makeCtx({
        state: makeState({
          flow: "bugfix",
          pipeline: ["bugfix"],
          completed: [],
        }),
        flowDef: BUGFIX_FLOW,
      });
      const fs = mockFs({});
      const action = computeNextInstruction(ctx, fs);

      // BUGFIX_FLOW には parallelGroups がない → 従来動作
      expect(action.action).toBe("bash_dispatch");
      if (action.action === "bash_dispatch") {
        expect(action.step).toBe("bugfix");
      }
    });

    it("動的 pipeline で group ステップが欠落 → フォールバック", () => {
      // replace-pipeline で testdesign が欠落したケース
      const ctx = makeCtx({
        state: makeState({
          pipeline: [
            "specify", "plan", "planreview",
            "tasks", "tasksreview", "implement",
            "architecturereview", "qualityreview", "phasereview",
          ],
          completed: [
            "specify", "plan", "planreview",
            "tasks", "tasksreview", "implement",
          ],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      // testdesign が pipeline にないので parallelGroup 不成立 → 単一ステップ
      expect(action.action).toBe("bash_review_dispatch");
      if (action.action === "bash_review_dispatch") {
        expect(action.step).toBe("architecturereview");
      }
    });

    it("並列グループの _meta.step_complete_cmd にカンマ区切りステップ名が含まれる", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [
            "specify", "plan", "planreview",
            "tasks", "tasksreview", "implement",
          ],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("bash_parallel_dispatch");
      if (action.action === "bash_parallel_dispatch") {
        expect(action._meta!.recovery_hint).toContain("poor-dev-next.js");
      }
    });
  });

  describe("done で artifacts を収集", () => {
    it("存在する全 artifacts を収集する", () => {
      const ctx = makeCtx({
        state: makeState({
          completed: [...FEATURE_FLOW.steps],
        }),
      });
      const fs = mockFs({
        "/proj/specs/001-test/spec.md": "spec",
        "/proj/specs/001-test/plan.md": "plan",
        "/proj/specs/001-test/tasks.md": "tasks",
        "/proj/specs/001-test/test-plan.md": "testplan",
      });
      const action = computeNextInstruction(ctx, fs);

      expect(action.action).toBe("done");
      if (action.action === "done") {
        expect(action.artifacts).toContain("/proj/specs/001-test/spec.md");
        expect(action.artifacts).toContain("/proj/specs/001-test/plan.md");
        expect(action.artifacts).toContain("/proj/specs/001-test/tasks.md");
        expect(action.artifacts).toContain("/proj/specs/001-test/test-plan.md");
        // implement "*" → fd itself
        expect(action.artifacts).toContain("/proj/specs/001-test");
      }
    });
  });
});

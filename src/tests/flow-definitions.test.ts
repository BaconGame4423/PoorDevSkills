/**
 * flow-definitions.test.ts
 *
 * FlowDefinition 型 + ビルトインフロー定義のテスト。
 */

import { describe, it, expect } from "vitest";
import {
  BUILTIN_FLOWS,
  FEATURE_FLOW,
  BUGFIX_FLOW,
  ROADMAP_FLOW,
  DISCOVERY_INIT_FLOW,
  DISCOVERY_REBUILD_FLOW,
  INVESTIGATION_FLOW,
  getFlowDefinition,
} from "../lib/flow-definitions.js";
import type { FlowDefinition } from "../lib/flow-types.js";

describe("BUILTIN_FLOWS registry", () => {
  it("全ビルトインフローが登録されている", () => {
    expect(Object.keys(BUILTIN_FLOWS)).toEqual(
      expect.arrayContaining([
        "feature", "bugfix", "roadmap",
        "discovery-init", "discovery-rebuild", "investigation",
      ])
    );
    expect(Object.keys(BUILTIN_FLOWS)).toHaveLength(6);
  });

  it("各フローの steps が非空配列", () => {
    for (const [name, flow] of Object.entries(BUILTIN_FLOWS)) {
      expect(flow.steps, `${name}.steps`).toBeInstanceOf(Array);
      expect(flow.steps.length, `${name}.steps.length`).toBeGreaterThan(0);
    }
  });

  it("全フローが JSON シリアライズ可能", () => {
    for (const [name, flow] of Object.entries(BUILTIN_FLOWS)) {
      const json = JSON.stringify(flow);
      const parsed = JSON.parse(json) as FlowDefinition;
      expect(parsed.steps, name).toEqual(flow.steps);
    }
  });
});

describe("getFlowDefinition", () => {
  it("存在するフローを返す", () => {
    expect(getFlowDefinition("feature")).toBe(FEATURE_FLOW);
    expect(getFlowDefinition("bugfix")).toBe(BUGFIX_FLOW);
  });

  it("存在しないフローで null を返す", () => {
    expect(getFlowDefinition("nonexistent")).toBeNull();
  });
});

describe("FEATURE_FLOW", () => {
  it("steps にtestdesign を含む", () => {
    expect(FEATURE_FLOW.steps).toContain("testdesign");
  });

  it("全レビューステップが reviews に含まれる", () => {
    const expected = ["planreview", "tasksreview", "architecturereview", "qualityreview", "phasereview"];
    expect(FEATURE_FLOW.reviews).toEqual(expected);
  });

  it("conditionals が空", () => {
    expect(FEATURE_FLOW.conditionals).toEqual([]);
  });

  it("context に全主要ステップのマッピングがある", () => {
    const ctx = FEATURE_FLOW.context!;
    expect(ctx["specify"]).toEqual({ input: "input.txt" });
    expect(ctx["plan"]).toEqual({ spec: "spec.md", suggestions: "suggestions.yaml" });
    expect(ctx["implement"]).toEqual({ tasks: "tasks.md", plan: "plan.md" });
  });

  it("prerequisites が正しく定義されている", () => {
    const prereqs = FEATURE_FLOW.prerequisites!;
    expect(prereqs["suggest"]).toEqual(["spec.md"]);
    expect(prereqs["tasks"]).toEqual(["plan.md", "spec.md"]);
    expect(prereqs["implement"]).toEqual(["tasks.md", "spec.md"]);
  });

  it("artifacts が正しく定義されている", () => {
    const artifacts = FEATURE_FLOW.artifacts!;
    expect(artifacts["specify"]).toBe("spec.md");
    expect(artifacts["plan"]).toBe("plan.md");
    expect(artifacts["testdesign"]).toBe("test-plan.md");
  });

  it("reviewPersonaGroups が全レビューステップに定義されている", () => {
    const groups = FEATURE_FLOW.reviewPersonaGroups!;
    for (const rev of FEATURE_FLOW.reviews!) {
      expect(groups[rev], rev).toBeDefined();
    }
  });

  it("teamConfig に全ステップの設定がある", () => {
    const tc = FEATURE_FLOW.teamConfig!;
    for (const step of FEATURE_FLOW.steps) {
      expect(tc[step], step).toBeDefined();
    }
  });

  it("レビューステップの teamConfig が review-loop または parallel-review", () => {
    const tc = FEATURE_FLOW.teamConfig!;
    expect(tc["planreview"]!.type).toBe("review-loop");
    expect(tc["architecturereview"]!.type).toBe("parallel-review");
    expect(tc["qualityreview"]!.type).toBe("parallel-review");
  });

  it("全レビューの reviewCommunication が opus-mediated", () => {
    const tc = FEATURE_FLOW.teamConfig!;
    for (const rev of FEATURE_FLOW.reviews!) {
      expect(tc[rev]!.reviewCommunication, rev).toBe("opus-mediated");
    }
  });

  it("discussionSteps が定義されている", () => {
    expect(FEATURE_FLOW.discussionSteps).toEqual(["discussion"]);
  });
});

describe("BUGFIX_FLOW", () => {
  it("steps が bugfix のみ", () => {
    expect(BUGFIX_FLOW.steps).toEqual(["bugfix"]);
  });

  it("conditionals に bugfix が含まれる", () => {
    expect(BUGFIX_FLOW.conditionals).toContain("bugfix");
  });

  it("conditionalBranches に RECLASSIFY_FEATURE がある", () => {
    const branches = BUGFIX_FLOW.conditionalBranches!;
    expect(branches["bugfix:RECLASSIFY_FEATURE"]).toBeDefined();
    expect(branches["bugfix:RECLASSIFY_FEATURE"]!.action).toBe("pause");
  });

  it("SCALE_SMALL の pipeline が正しい", () => {
    const branch = BUGFIX_FLOW.conditionalBranches!["bugfix:SCALE_SMALL"]!;
    expect(branch.action).toBe("replace-pipeline");
    expect(branch.pipeline).toContain("implement");
    expect(branch.variant).toBe("bugfix-small");
  });

  it("SCALE_LARGE の pipeline が tasks を含む", () => {
    const branch = BUGFIX_FLOW.conditionalBranches!["bugfix:SCALE_LARGE"]!;
    expect(branch.pipeline).toContain("tasks");
    expect(branch.pipeline).toContain("plan");
  });
});

describe("DISCOVERY_REBUILD_FLOW", () => {
  it("conditionals に rebuildcheck が含まれる", () => {
    expect(DISCOVERY_REBUILD_FLOW.conditionals).toContain("rebuildcheck");
  });

  it("REBUILD の pipeline に harvest が含まれる", () => {
    const branch = DISCOVERY_REBUILD_FLOW.conditionalBranches!["rebuildcheck:REBUILD"]!;
    expect(branch.pipeline).toContain("harvest");
  });

  it("CONTINUE は pause アクション", () => {
    const branch = DISCOVERY_REBUILD_FLOW.conditionalBranches!["rebuildcheck:CONTINUE"]!;
    expect(branch.action).toBe("pause");
  });
});

describe("ROADMAP_FLOW", () => {
  it("steps が正しい順序", () => {
    expect(ROADMAP_FLOW.steps).toEqual(["concept", "goals", "milestones", "roadmap"]);
  });

  it("全ステップの context に spec がある", () => {
    const ctx = ROADMAP_FLOW.context!;
    for (const step of ROADMAP_FLOW.steps) {
      expect(ctx[step], step).toEqual({ spec: "spec.md" });
    }
  });
});

describe("INVESTIGATION_FLOW", () => {
  it("steps が investigate のみ", () => {
    expect(INVESTIGATION_FLOW.steps).toEqual(["investigate"]);
  });
});

/**
 * flow-definitions.ts
 *
 * ビルトインフロー定義 + BUILTIN_FLOWS レジストリ。
 * pipeline-runner.ts の FLOW_STEPS / REVIEW_STEPS / CONDITIONAL_STEPS /
 * checkPrerequisites() / contextArgsForStep() を宣言的に置換する。
 */

import type { FlowDefinition } from "./flow-types.js";

// --- Feature Flow ---

export const FEATURE_FLOW: FlowDefinition = {
  steps: [
    "specify", "suggest", "plan", "planreview",
    "tasks", "tasksreview", "testdesign", "implement",
    "architecturereview", "qualityreview", "phasereview",
  ],
  reviews: [
    "planreview", "tasksreview",
    "architecturereview", "qualityreview", "phasereview",
  ],
  conditionals: [],
  context: {
    specify:   { input: "input.txt" },
    suggest:   { spec: "spec.md" },
    plan:      { spec: "spec.md", suggestions: "suggestions.yaml" },
    tasks:     { plan: "plan.md", spec: "spec.md" },
    testdesign: { spec: "spec.md", plan: "plan.md", tasks: "tasks.md" },
    implement: { tasks: "tasks.md", plan: "plan.md" },
    planreview:  { plan: "plan.md", spec: "spec.md" },
    tasksreview: { tasks: "tasks.md", spec: "spec.md", plan: "plan.md" },
    architecturereview: { spec: "spec.md" },
    qualityreview:      { spec: "spec.md" },
    phasereview:        { spec: "spec.md" },
  },
  prerequisites: {
    suggest: ["spec.md"],
    plan: ["spec.md"],
    tasks: ["plan.md", "spec.md"],
    implement: ["tasks.md", "spec.md"],
  },
  artifacts: {
    specify: "spec.md",
    suggest: "suggestions.yaml",
    plan: "plan.md",
    tasks: "tasks.md",
    testdesign: "test-plan.md",
  },
  reviewPersonaGroups: {
    planreview: "planreview",
    tasksreview: "tasksreview",
    architecturereview: "architecturereview",
    qualityreview: "qualityreview",
    phasereview: "phasereview",
  },
  discussionSteps: ["discussion"],
  teamConfig: {
    specify:  { type: "team", teammates: [{ role: "worker-specify" }] },
    suggest:  { type: "team", teammates: [{ role: "worker-suggest" }] },
    plan:     { type: "team", teammates: [{ role: "worker-plan" }] },
    planreview: {
      type: "review-loop",
      teammates: [
        { role: "reviewer-plan-unified", writeAccess: false },
        { role: "review-fixer" },
      ],
      maxReviewIterations: 12,
      reviewCommunication: "opus-mediated",
    },
    tasks:       { type: "team", teammates: [{ role: "worker-tasks" }] },
    tasksreview: {
      type: "review-loop",
      teammates: [
        { role: "reviewer-tasks-unified", writeAccess: false },
        { role: "review-fixer" },
      ],
      maxReviewIterations: 12,
      reviewCommunication: "opus-mediated",
    },
    testdesign:  { type: "team", teammates: [{ role: "worker-testdesign" }] },
    implement:   { type: "team", teammates: [{ role: "worker-implement" }] },
    architecturereview: {
      type: "parallel-review",
      teammates: [
        { role: "reviewer-arch-unified", writeAccess: false },
        { role: "review-fixer" },
      ],
      maxReviewIterations: 12,
      reviewCommunication: "opus-mediated",
    },
    qualityreview: {
      type: "parallel-review",
      teammates: [
        { role: "reviewer-quality-unified", writeAccess: false },
        { role: "review-fixer" },
      ],
      maxReviewIterations: 12,
      reviewCommunication: "opus-mediated",
    },
    phasereview: {
      type: "parallel-review",
      teammates: [
        { role: "reviewer-phase-unified", writeAccess: false },
        { role: "review-fixer" },
      ],
      maxReviewIterations: 12,
      reviewCommunication: "opus-mediated",
    },
  },
  conditionalBranches: {},
};

// --- Bugfix Flow ---

export const BUGFIX_FLOW: FlowDefinition = {
  steps: ["bugfix"],
  conditionals: ["bugfix"],
  context: {
    bugfix: { bug_report: "bug-report.md" },
  },
  conditionalBranches: {
    "bugfix:RECLASSIFY_FEATURE": {
      pattern: "\\[RECLASSIFY: FEATURE\\]",
      action: "pause",
      pauseReason: "Reclassified as feature",
    },
    "bugfix:SCALE_SMALL": {
      pattern: "\\[SCALE: SMALL\\]",
      action: "replace-pipeline",
      pipeline: ["bugfix", "planreview", "implement", "qualityreview", "phasereview"],
      variant: "bugfix-small",
    },
    "bugfix:SCALE_LARGE": {
      pattern: "\\[SCALE: LARGE\\]",
      action: "replace-pipeline",
      pipeline: [
        "bugfix", "plan", "planreview", "tasks", "tasksreview",
        "implement", "architecturereview", "qualityreview", "phasereview",
      ],
      variant: "bugfix-large",
    },
  },
};

// --- Roadmap Flow ---

export const ROADMAP_FLOW: FlowDefinition = {
  steps: ["concept", "goals", "milestones", "roadmap"],
  context: {
    concept: { spec: "spec.md" },
    goals: { spec: "spec.md" },
    milestones: { spec: "spec.md" },
    roadmap: { spec: "spec.md" },
  },
};

// --- Discovery Init Flow ---

export const DISCOVERY_INIT_FLOW: FlowDefinition = {
  steps: ["discovery"],
};

// --- Discovery Rebuild Flow ---

export const DISCOVERY_REBUILD_FLOW: FlowDefinition = {
  steps: ["rebuildcheck"],
  conditionals: ["rebuildcheck"],
  conditionalBranches: {
    "rebuildcheck:REBUILD": {
      pattern: "\\[VERDICT: REBUILD\\]",
      action: "replace-pipeline",
      pipeline: [
        "rebuildcheck", "harvest", "plan", "planreview",
        "tasks", "tasksreview", "implement",
        "architecturereview", "qualityreview", "phasereview",
      ],
      variant: "discovery-rebuild",
    },
    "rebuildcheck:CONTINUE": {
      pattern: "\\[VERDICT: CONTINUE\\]",
      action: "pause",
      variant: "discovery-continue",
      pauseReason: "CONTINUE verdict",
    },
  },
};

// --- Investigation Flow ---

export const INVESTIGATION_FLOW: FlowDefinition = {
  steps: ["investigate"],
};

// --- Registry ---

export const BUILTIN_FLOWS: Record<string, FlowDefinition> = {
  feature: FEATURE_FLOW,
  bugfix: BUGFIX_FLOW,
  roadmap: ROADMAP_FLOW,
  "discovery-init": DISCOVERY_INIT_FLOW,
  "discovery-rebuild": DISCOVERY_REBUILD_FLOW,
  investigation: INVESTIGATION_FLOW,
};

/** ビルトインフロー定義を取得。見つからなければ null。 */
export function getFlowDefinition(flowName: string): FlowDefinition | null {
  return BUILTIN_FLOWS[flowName] ?? null;
}

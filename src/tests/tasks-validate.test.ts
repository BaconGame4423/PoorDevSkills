/**
 * tasks-validate.test.ts
 *
 * validateTasks() の単体テスト。
 * tasks-validate.ts (tasks-validate.sh TS 移植) のカバレッジ。
 */

import { describe, it, expect } from "vitest";
import { validateTasks } from "../lib/tasks-validate.js";

// ================================================================
// 基本的なタスク構文チェック
// ================================================================

describe("validateTasks - タスク ID チェック", () => {
  it("有効なタスク行 → valid=true, tasks=2", () => {
    const content = [
      "# Tasks",
      "- [ ] [T001] First task",
      "- [ ] [T002] Second task",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.valid).toBe(true);
    expect(result.stats.tasks).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("タスク ID なしのタスク行 → エラー", () => {
    const content = "- [ ] Missing task ID\n";
    const result = validateTasks(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing task ID"))).toBe(true);
    expect(result.stats.bad_format).toBe(1);
  });

  it("完了タスク [X] も正しくカウントされる", () => {
    const content = [
      "- [X] [T001] Done task",
      "- [ ] [T002] Pending task",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.stats.tasks).toBe(2);
    expect(result.valid).toBe(true);
  });

  it("空コンテンツ → valid=true, 0 tasks", () => {
    const result = validateTasks("");
    expect(result.valid).toBe(true);
    expect(result.stats.tasks).toBe(0);
  });

  it("見出しのみ → valid=true", () => {
    const content = "# Tasks\n## Phase 1: Setup\n";
    const result = validateTasks(content);
    expect(result.valid).toBe(true);
  });
});

// ================================================================
// depends 参照チェック
// ================================================================

describe("validateTasks - depends 参照チェック", () => {
  it("存在するタスク ID への depends → エラーなし", () => {
    const content = [
      "- [ ] [T001] First",
      "  - depends: [T001]",
      "- [ ] [T002] Second",
      "  - depends: [T001, T002]",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.errors.filter((e) => e.includes("depends"))).toHaveLength(0);
  });

  it("存在しないタスク ID への depends → エラー", () => {
    const content = [
      "- [ ] [T001] First",
      "  - depends: [T999]",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("T999") && e.includes("non-existent"))).toBe(true);
  });

  it("複数の存在しない依存 → 複数エラー", () => {
    const content = [
      "- [ ] [T001] First",
      "  - depends: [T998, T999]",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.errors.filter((e) => e.includes("non-existent"))).toHaveLength(2);
  });
});

// ================================================================
// 並列グループ
// ================================================================

describe("validateTasks - 並列グループ files 重複検出", () => {
  it("[P] マーカー + files: あり → 重複なし → warnings なし", () => {
    const content = [
      "- [ ] [T001] Frontend [P:group1]",
      "  - files: src/frontend/**",
      "- [ ] [T002] Backend [P:group1]",
      "  - files: src/backend/**",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.warnings.filter((w) => w.includes("overlap"))).toHaveLength(0);
  });

  it("[P] マーカー + 同じ glob → 重複 warning", () => {
    const content = [
      "- [ ] [T001] Task A [P]",
      "  - files: src/app/**",
      "- [ ] [T002] Task B [P]",
      "  - files: src/app/**",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.warnings.some((w) => w.includes("overlap"))).toBe(true);
  });

  it("[P] マーカー + files: なし → warning", () => {
    const content = [
      "- [ ] [T001] Task A [P]",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.warnings.some((w) => w.includes("T001") && w.includes("files:"))).toBe(true);
  });
});

// ================================================================
// フェーズカウント
// ================================================================

describe("validateTasks - フェーズカウント", () => {
  it("フェーズなし → phases=0", () => {
    const content = "- [ ] [T001] task\n";
    const result = validateTasks(content);
    expect(result.stats.phases).toBe(0);
  });

  it("3フェーズ → phases=3", () => {
    const content = [
      "## Phase 1: Setup",
      "- [ ] [T001] task",
      "## Phase 2: Core",
      "- [ ] [T002] task",
      "## Phase 3: Test",
      "- [ ] [T003] task",
    ].join("\n");
    const result = validateTasks(content);
    expect(result.stats.phases).toBe(3);
  });
});

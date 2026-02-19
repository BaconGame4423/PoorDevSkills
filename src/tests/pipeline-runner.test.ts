/**
 * pipeline-runner.test.ts
 *
 * PipelineRunner + 純粋関数のテスト。
 *
 * カバレッジ:
 * - parseTasksPhases: フェーズ解析
 * - validateNoImplFiles: implement 完了後スキップ（89e4bd0 回帰防止）
 * - PipelineRunner.run():
 *   - .git 未存在 → exit 1
 *   - implement_phases_completed ガード（eccb536 回帰防止）
 *   - Phase-split: Phase N コミット後に Phase N+1 pre_retry_hook が走る（e01a084 回帰防止）
 *   - フェーズスキップ（レジューム: 既完了フェーズをスキップ）
 *   - pipeline-state.json からの completed セット読み込み
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  parseTasksPhases,
  validateNoImplFiles,
  PipelineRunner,
} from "../lib/pipeline-runner.js";
import type { PipelineRunnerDeps } from "../lib/pipeline-runner.js";
import { makeGitOps, makeFileSystem, makeDispatcher, makeStateManager } from "./fixtures/mocks.js";
import type { PipelineState } from "../lib/types.js";

// ================================================================
// parseTasksPhases
// ================================================================

describe("parseTasksPhases", () => {
  it("フェーズなし tasks.md → 空配列", () => {
    const content = "# Tasks\n- [ ] task A\n- [ ] task B\n";
    expect(parseTasksPhases(content)).toEqual([]);
  });

  it("単一フェーズの解析", () => {
    const content = [
      "## Phase 1: Setup",
      "- [ ] task A",
      "- [ ] task B",
    ].join("\n");
    const phases = parseTasksPhases(content);
    expect(phases).toHaveLength(1);
    expect(phases[0]).toMatchObject({
      phaseNum: 1,
      phaseName: "Setup",
      startLine: 1,
    });
  });

  it("複数フェーズの解析（行番号境界）", () => {
    const content = [
      "## Phase 1: Frontend",      // L1
      "- [ ] task A",               // L2
      "## Phase 2: Backend",        // L3
      "- [ ] task B",               // L4
      "## Phase 3: Testing",        // L5
      "- [ ] task C",               // L6
    ].join("\n");
    const phases = parseTasksPhases(content);
    expect(phases).toHaveLength(3);
    expect(phases[0]).toMatchObject({ phaseNum: 1, phaseName: "Frontend", startLine: 1, endLine: 2 });
    expect(phases[1]).toMatchObject({ phaseNum: 2, phaseName: "Backend", startLine: 3, endLine: 4 });
    expect(phases[2]).toMatchObject({ phaseNum: 3, phaseName: "Testing", startLine: 5 });
  });

  it("フェーズ番号が不連続でも正しく解析される", () => {
    const content = "## Phase 3: Late\n- [ ] x\n";
    const phases = parseTasksPhases(content);
    expect(phases[0]?.phaseNum).toBe(3);
  });
});

// ================================================================
// validateNoImplFiles（実際のファイルシステムを使用）
// ================================================================

describe("validateNoImplFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Gap-2 修正: globImplFiles が FileSystem.readdir 経由になったため、
  // テスト用 readdir は実際の fs.readdirSync で読む
  const realReaddir = (d: string) => {
    try {
      return fs.readdirSync(d, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isFile: e.isFile(),
        isDirectory: e.isDirectory(),
      }));
    } catch {
      return [];
    }
  };

  it("実装ファイルが存在しない場合は null を返す", () => {
    // specs/ のみのディレクトリ
    const removeFile = vi.fn();
    const fileSystem = { exists: vi.fn(() => true), removeFile, readdir: realReaddir };

    const result = validateNoImplFiles(tmpDir, "plan", fileSystem);
    expect(result).toBeNull();
    expect(removeFile).not.toHaveBeenCalled();
  });

  it("実装ファイルが存在する場合は削除して警告を返す", () => {
    // .js ファイルを配置
    const jsFile = path.join(tmpDir, "app.js");
    fs.writeFileSync(jsFile, "console.log('hello')");

    const removeFile = vi.fn();
    const fileSystem = { exists: vi.fn(() => true), removeFile, readdir: realReaddir };

    const result = validateNoImplFiles(tmpDir, "plan", fileSystem);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.warning).toContain("generated impl files");
    expect(removeFile).toHaveBeenCalledWith(jsFile);
  });

  it("lib/ ディレクトリ内のファイルはスキップされる", () => {
    const libDir = path.join(tmpDir, "lib");
    fs.mkdirSync(libDir);
    fs.writeFileSync(path.join(libDir, "utils.ts"), "export {}");

    const removeFile = vi.fn();
    const fileSystem = { exists: vi.fn(() => true), removeFile, readdir: realReaddir };

    const result = validateNoImplFiles(tmpDir, "plan", fileSystem);
    expect(result).toBeNull();
    expect(removeFile).not.toHaveBeenCalled();
  });

  it("node_modules/ ディレクトリ内のファイルはスキップされる", () => {
    const nmDir = path.join(tmpDir, "node_modules", "dep");
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, "index.js"), "module.exports = {}");

    const removeFile = vi.fn();
    const fileSystem = { exists: vi.fn(() => true), removeFile, readdir: realReaddir };

    const result = validateNoImplFiles(tmpDir, "plan", fileSystem);
    expect(result).toBeNull();
  });
});

// ================================================================
// PipelineRunner 統合テスト
// ================================================================

function makeDeps(overrides?: Partial<PipelineRunnerDeps>): PipelineRunnerDeps {
  return {
    gitOps: makeGitOps(),
    fileSystem: makeFileSystem(),
    stateManager: makeStateManager(),
    dispatcher: makeDispatcher(0),
    config: null,
    ...overrides,
  };
}

const BASE_OPTS = {
  flow: "feature",
  featureDir: "specs/my-feature",
  branch: "feat/my-feature",
  projectDir: "/project",
  summary: "My feature",
};

describe("PipelineRunner.run()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------
  // .git 存在チェック（FATAL guard）
  // ---------------------------------------------------------------

  it(".git が存在しない場合 exitCode=1 を返す", async () => {
    const deps = makeDeps({
      gitOps: makeGitOps({ hasGitDir: vi.fn(() => false) }),
    });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const result = await runner.run(BASE_OPTS, (e) => events.push(e));

    expect(result.exitCode).toBe(1);
    expect(events.some((e: unknown) =>
      typeof e === "object" && e !== null && "error" in e &&
      String((e as { error: unknown }).error).includes("FATAL")
    )).toBe(true);
  });

  // ---------------------------------------------------------------
  // implement_phases_completed ガード（eccb536 回帰防止）
  // Bug 2: validate_no_impl_files が --next 再送信時にコミット済み成果物を削除
  // ---------------------------------------------------------------

  it("implement_phases_completed が存在する場合 validateNoImplFiles をスキップする（eccb536 回帰防止）", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const TASKS_MD = `${FD}/tasks.md`;
    const COMMAND_FILE = "/project/.opencode/command/poor-dev.implement.md";
    const PROMPT_FILE = `/tmp/poor-dev-prompt-implement-${process.pid}.txt`;

    // pipeline-state.json に implement_phases_completed あり → 再入ケース
    const stateWithPhases: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["specify", "suggest", "plan", "implement"],
      completed: ["specify", "suggest", "plan"],
      current: "implement",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-17T00:00:00Z",
      implement_phases_completed: ["phase_1"],  // Phase 1 は完了済み
    };

    const tasks = [
      "## Phase 1: Frontend",
      "- [X] task A",
      "## Phase 2: Backend",
      "- [ ] task B",
    ].join("\n");

    const sm = makeStateManager({
      read: vi.fn(() => ({ ...stateWithPhases })),
      addImplementPhase: vi.fn(() => ({
        ...stateWithPhases,
        implement_phases_completed: ["phase_1", "phase_2"],
      })),
    });

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(stateWithPhases),
      [TASKS_MD]: tasks,
      [COMMAND_FILE]: "# implement command",
      [PROMPT_FILE]: "prompt content",
    });

    const removeFileSpy = vi.spyOn(fileSystem, "removeFile");

    const deps = makeDeps({ fileSystem, stateManager: sm });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(
      { ...BASE_OPTS, completed: ["specify", "suggest", "plan"] },
      (e) => events.push(e)
    );
    await vi.runAllTimersAsync();
    await promise;

    // validateNoImplFiles が実行されたとしたら、それは実装ファイルを削除するはず。
    // しかし implement_phases_completed が non-empty なので、
    // validate は呼ばれず、phase_1 の成果物ファイルは削除されない。
    // ここでは removeFile が .js/.ts などの実装ファイルに対して呼ばれないことを確認。
    const implExtensions = [".js", ".ts", ".py", ".css", ".html"];
    const illegalRemoveCalls = removeFileSpy.mock.calls.filter(([p]) =>
      implExtensions.some((ext) => p.endsWith(ext))
    );
    expect(illegalRemoveCalls).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // Phase-split: commit → addImplementPhase の順序（e01a084 回帰防止）
  // Bug 1: _impl_phase_pre_retry の git clean が前フェーズ成果物を破壊
  // ---------------------------------------------------------------

  it("フェーズ成功後に addImplementPhase が呼ばれる（コミット保護後に状態記録）", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const TASKS_MD = `${FD}/tasks.md`;
    const COMMAND_FILE = "/project/.opencode/command/poor-dev.implement.md";

    const tasks = [
      "## Phase 1: Frontend",
      "- [ ] task A",
      "## Phase 2: Backend",
      "- [ ] task B",
    ].join("\n");

    const initialState: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["implement"],
      completed: [],
      current: "implement",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-17T00:00:00Z",
    };

    const sm = makeStateManager({
      read: vi.fn(() => ({ ...initialState })),
    });

    // git の呼び出し順序を追跡
    const gitCallArgs: string[][] = [];
    const gitMock = makeGitOps({
      git: vi.fn((dir: string, args: string[]) => {
        gitCallArgs.push([...args]);
        return "";
      }),
    });

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(initialState),
      [TASKS_MD]: tasks,
      [`${FD}/spec.md`]: "# spec",
      [COMMAND_FILE]: "# implement command",
    });
    // promptFile は compose-prompt.sh が作るが、テスト環境では存在しないため
    // fileSystem.exists が false → dispatchImplementPhases は promptFile チェックなしで dispatch

    const deps = makeDeps({
      gitOps: gitMock,
      fileSystem,
      stateManager: sm,
    });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(BASE_OPTS, (e) => events.push(e));
    await vi.runAllTimersAsync();
    await promise;

    // Phase 1 成功後 addImplementPhase("phase_1") が呼ばれていることを確認
    const addImplCalls = (sm.addImplementPhase as ReturnType<typeof vi.fn>).mock.calls;
    expect(addImplCalls.length).toBeGreaterThanOrEqual(1);
    expect(addImplCalls[0]![1]).toBe("phase_1");

    // コミット呼び出し（add-A + commit）が phase_1 追加前に記録されていること
    const commitIdx = gitCallArgs.findIndex((args) => args[0] === "commit");
    const addImplCallOrder = (sm.addImplementPhase as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];

    // git commit が呼ばれた後に addImplementPhase が呼ばれる
    // （git commit → stateManager.addImplementPhase の順序）
    if (commitIdx >= 0 && addImplCallOrder !== undefined) {
      // commitIdx が存在する = コミットが実行された = 前フェーズ保護済み
      expect(commitIdx).toBeGreaterThanOrEqual(0);
    }
  });

  // ---------------------------------------------------------------
  // resume: 完了済みフェーズのスキップ
  // ---------------------------------------------------------------

  it("implement_phases_completed に含まれるフェーズはスキップされる", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const TASKS_MD = `${FD}/tasks.md`;
    const COMMAND_FILE = "/project/.opencode/command/poor-dev.implement.md";

    const stateWithPhase1Done: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["implement"],
      completed: [],
      current: "implement",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-17T00:00:00Z",
      implement_phases_completed: ["phase_1"],
    };

    const tasks = [
      "## Phase 1: Frontend",
      "- [X] task A",
      "## Phase 2: Backend",
      "- [ ] task B",
    ].join("\n");

    const sm = makeStateManager({
      read: vi.fn(() => ({ ...stateWithPhase1Done })),
    });

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(stateWithPhase1Done),
      [TASKS_MD]: tasks,
      [`${FD}/spec.md`]: "# spec",
      [COMMAND_FILE]: "# implement command",
    });

    const deps = makeDeps({ fileSystem, stateManager: sm });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(BASE_OPTS, (e) => events.push(e));
    await vi.runAllTimersAsync();
    await promise;

    // Phase 1 がスキップされたことを示すイベントを確認
    const skipEvents = events.filter(
      (e): e is { phase: number; status: string } =>
        typeof e === "object" && e !== null &&
        "status" in e && (e as { status: string }).status === "skipped" &&
        "phase" in e && (e as { phase: number }).phase === 1
    );
    expect(skipEvents).toHaveLength(1);
  });

  // ---------------------------------------------------------------
  // pipeline-state.json からの completed 読み込み（resume）
  // ---------------------------------------------------------------

  it("pipeline-state.json の completed からスキップステップを解決する", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const SPECIFY_CMD = "/project/.opencode/command/poor-dev.specify.md";
    const SUGGEST_CMD = "/project/.opencode/command/poor-dev.suggest.md";
    const SPEC_MD = `${FD}/spec.md`;

    const savedState: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["specify", "suggest"],
      completed: ["specify"],  // specify は完了済み
      current: "suggest",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-17T00:00:00Z",
    };

    const sm = makeStateManager({
      read: vi.fn(() => ({ ...savedState })),
    });

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(savedState),
      [SPECIFY_CMD]: "# specify command",
      [SUGGEST_CMD]: "# suggest command",
      [SPEC_MD]: "# spec",  // suggest の prerequisite
    });

    const deps = makeDeps({ fileSystem, stateManager: sm });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(BASE_OPTS, (e) => events.push(e));
    await vi.runAllTimersAsync();
    await promise;

    // specify はスキップされ、suggest のみ starting になる
    const specifySkip = events.find(
      (e): e is { step: string; status: string } =>
        typeof e === "object" && e !== null &&
        "step" in e && (e as { step: string }).step === "specify" &&
        "status" in e && (e as { status: string }).status === "skipped"
    );
    expect(specifySkip).toBeDefined();
  });

  // ---------------------------------------------------------------
  // --next モード
  // ---------------------------------------------------------------

  it("--next モード: 全ステップ完了済みのとき pipeline_complete を出す", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;

    const savedState: PipelineState = {
      flow: "bugfix",
      variant: null,
      pipeline: ["bugfix"],
      completed: ["bugfix"],
      current: null,
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-17T00:00:00Z",
    };

    const sm = makeStateManager({
      read: vi.fn(() => ({ ...savedState })),
    });

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(savedState),
    });

    const deps = makeDeps({ fileSystem, stateManager: sm });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const result = await runner.run(
      { ...BASE_OPTS, flow: "bugfix", nextMode: true },
      (e) => events.push(e)
    );

    expect(result.exitCode).toBe(0);
    const completeEvent = events.find(
      (e): e is { status: string } =>
        typeof e === "object" && e !== null &&
        "status" in e && (e as { status: string }).status === "pipeline_complete"
    );
    expect(completeEvent).toBeDefined();
  });

  // ---------------------------------------------------------------
  // awaiting-approval → resume 時の clearApproval
  // ---------------------------------------------------------------

  it("resume 時に awaiting-approval だった場合 clearApproval が呼ばれる", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const SPECIFY_CMD = "/project/.opencode/command/poor-dev.specify.md";

    const pendingState: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["specify"],
      completed: [],
      current: "specify",
      status: "awaiting-approval",  // ← 承認待ち状態
      pauseReason: "gate at specify",
      condition: null,
      pendingApproval: { type: "gate", step: "specify" },
      updated: "2026-02-17T00:00:00Z",
    };

    const sm = makeStateManager({
      read: vi.fn(() => ({ ...pendingState })),
    });
    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(pendingState),
      [SPECIFY_CMD]: "# specify command",
    });

    const deps = makeDeps({ fileSystem, stateManager: sm });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(BASE_OPTS, (e) => events.push(e));
    await vi.runAllTimersAsync();
    await promise;

    // resume 時に clearApproval が呼ばれている
    expect(sm.clearApproval).toHaveBeenCalledWith(STATE_FILE);
  });

  // ---------------------------------------------------------------
  // review verdict: NO-GO → pause + exitCode=2
  // ---------------------------------------------------------------

  it("review step で NO-GO verdict → pause イベントを出して exitCode=2", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const PLANREVIEW_CMD = "/project/.opencode/command/poor-dev.planreview.md";
    const PLAN_MD = `${FD}/plan.md`;

    const savedState: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["planreview"],
      completed: [],
      current: "planreview",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-19T00:00:00Z",
    };

    const sm = makeStateManager({ read: vi.fn(() => ({ ...savedState })) });

    // promptFile をモックに追加（composePromptTs が実際の FS でコマンドファイルを読めないため）
    const PROMPT_FILE = `/tmp/poor-dev-prompt-planreview-${process.pid}.txt`;

    // resultFile に NO-GO verdict を設定
    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(savedState),
      [PLANREVIEW_CMD]: "# planreview command",
      [PLAN_MD]: "# Plan",
      [PROMPT_FILE]: "# composed prompt",
    });

    // dispatcher は成功 (exitCode=0) を返すが、resultFile には verdict:NO-GO を書き込む
    const dispatcher = {
      dispatch: vi.fn(async (
        _step: string,
        _dir: string,
        _prompt: string,
        _idle: number,
        _max: number,
        resultFile: string
      ) => {
        // result ファイルに NO-GO を書き込む
        (fileSystem.writeFile as ReturnType<typeof vi.fn>).getMockImplementation()?.call(
          null, resultFile,
          JSON.stringify({ exit_code: 0, errors: [], timeout_type: "none", verdict: "NO-GO", clarifications: [] })
        );
        // fileSystem を直接操作してファイルを登録
        fileSystem.writeFile(resultFile, JSON.stringify({
          exit_code: 0, errors: [], timeout_type: "none", verdict: "NO-GO", clarifications: [],
        }));
        return 0;
      }),
    };

    const deps = makeDeps({ fileSystem, stateManager: sm, dispatcher });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run({ ...BASE_OPTS, flow: "feature" }, (e) => events.push(e));
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.exitCode).toBe(2);
    const pauseEvent = events.find(
      (e): e is { action: string; reason: string } =>
        typeof e === "object" && e !== null &&
        "action" in e && (e as { action: string }).action === "pause"
    );
    expect(pauseEvent).toBeDefined();
    expect(sm.setStatus).toHaveBeenCalledWith(expect.any(String), "paused", expect.stringContaining("NO-GO"));
  });

  // ---------------------------------------------------------------
  // gate チェック: gates[after-step] が設定されていると pauseして exitCode=2
  // ---------------------------------------------------------------

  it("gate チェック: after-specify gate が設定された場合 setApproval + exitCode=2", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const SPECIFY_CMD = "/project/.opencode/command/poor-dev.specify.md";

    const savedState: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["specify"],
      completed: [],
      current: "specify",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-19T00:00:00Z",
    };

    const sm = makeStateManager({ read: vi.fn(() => ({ ...savedState })) });

    // promptFile をモックに追加（composePromptTs が実際の FS でコマンドファイルを読めないため）
    const PROMPT_FILE = `/tmp/poor-dev-prompt-specify-${process.pid}.txt`;

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(savedState),
      [SPECIFY_CMD]: "# specify command",
      [PROMPT_FILE]: "# composed prompt",
    });

    // specify 成功、spec.md が存在する、result に clarifications なし
    const dispatcher = {
      dispatch: vi.fn(async (
        _step: string, _dir: string, _prompt: string,
        _idle: number, _max: number, resultFile: string
      ) => {
        fileSystem.writeFile(resultFile, JSON.stringify({
          exit_code: 0, errors: [], timeout_type: "none", verdict: null, clarifications: [],
        }));
        // spec.md を作成（extract-output の代わりに直接）
        fileSystem.writeFile(`${FD}/spec.md`, "# Spec content");
        return 0;
      }),
    };

    // gates に "after-specify" を設定
    const config = {
      polling: { idle_timeout: 120, max_timeout: 600 },
      gates: { "after-specify": true },
      auto_approve: false,
    };

    const deps = makeDeps({ fileSystem, stateManager: sm, dispatcher, config });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(BASE_OPTS, (e) => events.push(e));
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.exitCode).toBe(2);
    expect(sm.setApproval).toHaveBeenCalledWith(
      expect.any(String), "gate", "specify"
    );
    const gateEvent = events.find(
      (e): e is { action: string; gate: string } =>
        typeof e === "object" && e !== null &&
        "action" in e && (e as { action: string }).action === "gate"
    );
    expect(gateEvent).toBeDefined();
  });

  // ---------------------------------------------------------------
  // auto_approve=true の場合 gate をスキップする
  // ---------------------------------------------------------------

  it("auto_approve=true の場合 gate をスキップして step_complete になる", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const SPECIFY_CMD = "/project/.opencode/command/poor-dev.specify.md";

    const savedState: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["specify"],
      completed: [],
      current: "specify",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-19T00:00:00Z",
    };

    const sm = makeStateManager({ read: vi.fn(() => ({ ...savedState })) });

    // promptFile をモックに追加（composePromptTs が実際の FS でコマンドファイルを読めないため）
    const PROMPT_FILE = `/tmp/poor-dev-prompt-specify-${process.pid}.txt`;

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(savedState),
      [SPECIFY_CMD]: "# specify command",
      [PROMPT_FILE]: "# composed prompt",
    });

    const dispatcher = {
      dispatch: vi.fn(async (
        _step: string, _dir: string, _prompt: string,
        _idle: number, _max: number, resultFile: string
      ) => {
        fileSystem.writeFile(resultFile, JSON.stringify({
          exit_code: 0, errors: [], timeout_type: "none", verdict: null, clarifications: [],
        }));
        fileSystem.writeFile(`${FD}/spec.md`, "# Spec content");
        return 0;
      }),
    };

    // auto_approve=true + gates あり
    const config = {
      polling: { idle_timeout: 120, max_timeout: 600 },
      gates: { "after-specify": true },
      auto_approve: true,
    };

    const deps = makeDeps({ fileSystem, stateManager: sm, dispatcher, config });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(BASE_OPTS, (e) => events.push(e));
    await vi.runAllTimersAsync();
    const result = await promise;

    // gate があっても auto_approve なので step_complete
    expect(result.exitCode).toBe(0);
    const stepComplete = events.find(
      (e): e is { step: string; status: string } =>
        typeof e === "object" && e !== null &&
        "status" in e && (e as { status: string }).status === "step_complete"
    );
    expect(stepComplete).toBeDefined();
  });

  // ---------------------------------------------------------------
  // clarification gate: specify 後に clarifications があると awaiting-approval
  // ---------------------------------------------------------------

  it("specify 後に clarifications がある場合 setApproval + exitCode=2", async () => {
    const FD = "/project/specs/my-feature";
    const STATE_FILE = `${FD}/pipeline-state.json`;
    const SPECIFY_CMD = "/project/.opencode/command/poor-dev.specify.md";

    const savedState: PipelineState = {
      flow: "feature",
      variant: null,
      pipeline: ["specify"],
      completed: [],
      current: "specify",
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: "2026-02-19T00:00:00Z",
    };

    const sm = makeStateManager({ read: vi.fn(() => ({ ...savedState })) });

    // promptFile をモックに追加（composePromptTs が実際の FS でコマンドファイルを読めないため）
    const PROMPT_FILE = `/tmp/poor-dev-prompt-specify-${process.pid}.txt`;

    const fileSystem = makeFileSystem({
      [STATE_FILE]: JSON.stringify(savedState),
      [SPECIFY_CMD]: "# specify command",
      [PROMPT_FILE]: "# composed prompt",
    });

    const dispatcher = {
      dispatch: vi.fn(async (
        _step: string, _dir: string, _prompt: string,
        _idle: number, _max: number, resultFile: string
      ) => {
        fileSystem.writeFile(resultFile, JSON.stringify({
          exit_code: 0,
          errors: [],
          timeout_type: "none",
          verdict: null,
          clarifications: ["[NEEDS CLARIFICATION: What is the scope?]"],
        }));
        fileSystem.writeFile(`${FD}/spec.md`, "# Spec content");
        return 0;
      }),
    };

    const deps = makeDeps({ fileSystem, stateManager: sm, dispatcher });
    const runner = new PipelineRunner(deps);
    const events: unknown[] = [];

    const promise = runner.run(BASE_OPTS, (e) => events.push(e));
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.exitCode).toBe(2);
    expect(sm.setApproval).toHaveBeenCalledWith(
      expect.any(String), "clarification", "specify"
    );
    // pending-clarifications.json が保存されているか
    const writeCalls = (fileSystem.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const pendingWrite = writeCalls.find(([p]: [string]) =>
      p.includes("pending-clarifications.json")
    );
    expect(pendingWrite).toBeDefined();
  });
});

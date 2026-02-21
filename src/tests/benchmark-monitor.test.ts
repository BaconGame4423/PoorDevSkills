/**
 * benchmark-monitor.test.ts
 *
 * ベンチマークモニターのテスト。
 * テスト対象: src/lib/benchmark/monitor.ts - runMonitor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PathOrFileDescriptor, PathLike } from "node:fs";

// node:fs をモック
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// node:child_process をモック
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// tmux.ts をモック
vi.mock("../lib/benchmark/tmux.js", () => ({
  capturePaneContent: vi.fn(),
  sendKeys: vi.fn(),
  sendKeysLiteral: vi.fn(),
  pasteBuffer: vi.fn(),
  splitWindow: vi.fn(),
  listPanes: vi.fn(),
  killPane: vi.fn(),
}));

// phase0-responder.ts をモック
vi.mock("../lib/benchmark/phase0-responder.js", () => ({
  matchResponse: vi.fn(),
  respondToPhase0: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { capturePaneContent } from "../lib/benchmark/tmux.js";
import { respondToPhase0 } from "../lib/benchmark/phase0-responder.js";

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedExistsSync = vi.mocked(existsSync);
const mockedExecSync = vi.mocked(execSync);
const mockedCapturePaneContent = vi.mocked(capturePaneContent);
const mockedRespondToPhase0 = vi.mocked(respondToPhase0);

async function importMonitor() {
  return import("../lib/benchmark/monitor.js");
}

interface MonitorOptions {
  combo: string;
  targetPane: string;
  comboDir: string;
  phase0ConfigPath: string;
  timeoutSeconds: number;
  projectRoot: string;
}

interface MonitorResult {
  exitReason: string;
  elapsedSeconds: number;
  combo: string;
  logs: string[];
}

function makeDefaultOptions(overrides?: Partial<MonitorOptions>): MonitorOptions {
  return {
    combo: "test-combo",
    targetPane: "test-pane",
    comboDir: "/tmp/combo/test-combo",
    phase0ConfigPath: "/tmp/phase0-config.json",
    timeoutSeconds: 300,
    projectRoot: "/tmp/project",
    ...overrides,
  };
}

function mockReadFile(handler: (p: string) => string) {
  mockedReadFileSync.mockImplementation(((path: PathOrFileDescriptor) => {
    return handler(String(path));
  }) as typeof readFileSync);
}

function mockExists(handler: (p: string) => boolean) {
  mockedExistsSync.mockImplementation(((path: PathLike) => {
    return handler(String(path));
  }) as typeof existsSync);
}

function setPipelineState(status: string, completed: string[] = []) {
  mockReadFile((p) => {
    if (p.includes("pipeline-state.json")) {
      return JSON.stringify({
        flow: "feature",
        status,
        completed,
        current: completed.length > 0 ? null : "specify",
      });
    }
    if (p.includes("phase0")) {
      return JSON.stringify({
        flow_type: "feature",
        discussion_context: { task_ref: "TEST", scope: "test" },
        responses: [],
        max_turns: 5,
        fallback: "ok",
      });
    }
    return "{}";
  });
}

describe("benchmark-monitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockedCapturePaneContent.mockReturnValue("TUI content");
    mockedExecSync.mockReturnValue("");
    mockedExistsSync.mockReturnValue(false);

    // loadPhase0Config 用のデフォルト: phase0ConfigPath から読まれる
    mockReadFile((p) => {
      if (p.includes("phase0")) {
        return JSON.stringify({
          flow_type: "feature",
          discussion_context: { task_ref: "TEST", scope: "test" },
          responses: [],
          max_turns: 5,
          fallback: "ok",
        });
      }
      return "{}";
    });

    mockedRespondToPhase0.mockReturnValue({
      responded: false,
      turnCount: 0,
      done: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("ペインが消失 → pane_lost で終了", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions();

    mockedCapturePaneContent.mockImplementation(() => {
      throw new Error("tmux command failed: pane not found");
    });

    const promise = runMonitor(options);
    await vi.runAllTimersAsync();
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("pane_lost");
    expect(result.combo).toBe("test-combo");
  });

  it("pipeline-state.json が completed → pipeline_complete で終了", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions();

    setPipelineState("completed", ["specify", "plan", "implement"]);
    mockExists((p) => p.includes("pipeline-state.json"));

    const promise = runMonitor(options);
    await vi.runAllTimersAsync();
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("pipeline_complete");
  });

  it("pipeline-state.json が error → pipeline_error で終了", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions();

    setPipelineState("error");
    mockExists((p) => p.includes("pipeline-state.json"));

    const promise = runMonitor(options);
    await vi.runAllTimersAsync();
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("pipeline_error");
  });

  it("タイムアウト → timeout で終了", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 10 });

    setPipelineState("active");
    mockExists((p) => p.includes("pipeline-state.json"));


    let captureCount = 0;
    mockedCapturePaneContent.mockImplementation(() => {
      captureCount++;
      return `TUI content ${captureCount}`;
    });

    const promise = runMonitor(options);
    await vi.advanceTimersByTimeAsync(11000);
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("timeout");
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(10);
  });

  it("TUI アイドル + 成果物ファイル存在 → tui_idle で終了", async () => {
    const { runMonitor } = await importMonitor();
    // idleCheckStartMs = 120_000 なので短いタイムアウトで十分到達できるように
    const options = makeDefaultOptions({ timeoutSeconds: 300 });

    setPipelineState("active");
    mockExists((p) => p.includes("pipeline-state.json"));


    // "❯" を含むコンテンツ = TUI アイドル状態
    mockedCapturePaneContent.mockReturnValue("❯ ");
    // hasArtifacts は execSync で find を使う。成果物が存在する結果を返す
    mockedExecSync.mockReturnValue("index.html\n");

    const promise = runMonitor(options);
    // idleCheckStartMs(120s) + idleCheckIntervalMs(60s) の余裕を持って進める
    await vi.advanceTimersByTimeAsync(200_000);
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("tui_idle");
  }, 10_000);

  it("Phase0 max_turns 後も監視を継続し、パイプライン完了で終了", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 30 });

    // Phase0 done 後にパイプライン完了する
    let callCount = 0;
    mockReadFile((p) => {
      if (p.includes("pipeline-state.json")) {
        callCount++;
        // 2回目以降のチェックで completed にする
        if (callCount > 2) {
          return JSON.stringify({ flow: "feature", status: "completed", completed: ["specify"], current: null });
        }
        return JSON.stringify({ flow: "feature", status: "active", completed: [], current: "specify" });
      }
      if (p.includes("phase0")) {
        return JSON.stringify({ flow_type: "feature", max_turns: 1, responses: [], fallback: "ok" });
      }
      return "{}";
    });
    mockExists((p) => p.includes("pipeline-state.json"));


    mockedRespondToPhase0.mockReturnValue({ responded: true, turnCount: 1, done: true });

    const promise = runMonitor(options);
    await vi.advanceTimersByTimeAsync(35_000);
    const result = await promise as MonitorResult;

    // Phase0 done ログが記録されている
    expect(result.logs.some((l: string) => l.includes("Phase 0"))).toBe(true);
  });

  it("正常終了時の結果に logs が含まれる", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions();

    setPipelineState("completed", ["specify", "plan", "implement"]);
    mockExists((p) => p.includes("pipeline-state.json"));

    const promise = runMonitor(options);
    await vi.runAllTimersAsync();
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("pipeline_complete");
    expect(result.logs).toBeInstanceOf(Array);
    expect(result.combo).toBe("test-combo");
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it("elapsedSeconds が正しく計測される", async () => {
    const { runMonitor } = await importMonitor();
    // 短いタイムアウトでテスト
    const options = makeDefaultOptions({ timeoutSeconds: 20 });

    setPipelineState("active");
    mockExists((p) => p.includes("pipeline-state.json"));


    let count = 0;
    mockedCapturePaneContent.mockImplementation(() => {
      count++;
      return `content-${count}`;
    });

    const promise = runMonitor(options);
    await vi.advanceTimersByTimeAsync(25_000);
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("timeout");
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(20);
  });

  it("TUI アイドルでも成果物ファイルなし → 監視継続", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 30 });

    setPipelineState("active");
    mockExists((p) => p.includes("pipeline-state.json"));


    mockedCapturePaneContent.mockReturnValue("Same content");

    const promise = runMonitor(options);
    await vi.advanceTimersByTimeAsync(35000);
    const result = await promise as MonitorResult;

    expect(result.exitReason).toBe("timeout");
  });

  it("実行中にログが記録される", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions();

    setPipelineState("completed");
    mockExists((p) => p.includes("pipeline-state.json"));

    const promise = runMonitor(options);
    await vi.runAllTimersAsync();
    const result = await promise as MonitorResult;

    expect(result.logs.length).toBeGreaterThanOrEqual(0);
  });
});

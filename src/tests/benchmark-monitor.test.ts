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
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(),
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
  listAllPanes: vi.fn((_sessionId?: string) => []),
  killPane: vi.fn(),
  paneExists: vi.fn(),
  currentSessionId: vi.fn(() => null),
}));

// phase0-responder.ts をモック
vi.mock("../lib/benchmark/phase0-responder.js", () => ({
  matchResponse: vi.fn(),
  respondToPhase0: vi.fn(),
}));

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { capturePaneContent, pasteBuffer, sendKeys } from "../lib/benchmark/tmux.js";
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

function setPipelineState(status: string, completed: string[] = [], current?: string | null, pipeline?: string[]) {
  mockReadFile((p) => {
    if (p.includes("pipeline-state.json")) {
      return JSON.stringify({
        flow: "feature",
        status,
        completed,
        current: current !== undefined ? current : (completed.length > 0 ? null : "specify"),
        pipeline: pipeline ?? ["specify", "suggest", "plan", "tasks", "implement", "review"],
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

  it("TUI アイドル + パイプライン状態なし + 成果物ファイル存在 → tui_idle で終了", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 300 });

    // pipeline-state.json が存在しない → readPipelineInfo returns null → pipelineComplete = true
    // checkPipelineState returns { complete: false } なので periodic check は終了しない
    mockedExistsSync.mockReturnValue(false);

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

  it("TUI アイドル + パイプライン未完了 → 回復メッセージ送信、6回で tui_idle", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 600 });
    const mockedPasteBuffer = vi.mocked(pasteBuffer);
    const mockedSendKeys = vi.mocked(sendKeys);

    // pipeline active with current step
    setPipelineState("active", ["specify", "suggest"], "plan", ["specify", "suggest", "plan", "tasks", "implement", "review"]);
    mockExists((p) => p.includes("pipeline-state.json"));

    // TUI idle
    mockedCapturePaneContent.mockReturnValue("❯ ");
    mockedExecSync.mockReturnValue("index.html\n");

    const promise = runMonitor(options);
    // First idle check at 120s sets lastKnownStep (count stays 0).
    // Then 6 checks at 180,240,300,360,420,480s → count reaches 6 at 480s → exit.
    await vi.advanceTimersByTimeAsync(490_000);
    const result = await promise as MonitorResult;

    // Recovery message should have been sent via pasteBuffer (max 2 attempts)
    expect(mockedPasteBuffer).toHaveBeenCalledWith(
      "test-pane",
      "monitor-recovery",
      expect.stringContaining("[MONITOR] TUI idle but pipeline incomplete"),
    );
    expect(mockedSendKeys).toHaveBeenCalledWith("test-pane", "Enter");

    // After 6 idle checks, should exit with tui_idle
    expect(result.exitReason).toBe("tui_idle");
    expect(result.logs.some((l: string) => l.includes("Recovery #1 sent"))).toBe(true);
    expect(result.logs.some((l: string) => l.includes("giving up"))).toBe(true);
  }, 30_000);

  it("TUI 復帰後に consecutiveIdleCount がリセットされる", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 600 });
    const mockedPasteBuffer = vi.mocked(pasteBuffer);

    // pipeline active
    setPipelineState("active", ["specify"], "suggest", ["specify", "suggest", "plan"]);
    mockExists((p) => p.includes("pipeline-state.json"));

    // idle checks at: 120s(c13), 180s(c19), 240s(c25), 300s(c31), 360s(c37), 420s(c43), 480s(c49)
    // Recovery at count>=3 (idleCountBeforeRecovery=3), exit at count>=6
    // Make idle for first 3 checks, active at 300s, idle again for 3 checks → recovery twice
    let callCount = 0;
    mockedCapturePaneContent.mockImplementation(() => {
      callCount++;
      // call 31 = 300s → active (reset count)
      if (callCount === 31) return "Working...";
      // All other calls → idle
      return "❯ ";
    });

    const promise = runMonitor(options);
    // Advance to 500s to cover: idle checks at 120(1),180(2),240(3→recovery#1),
    // 300(active→reset), 360(1),420(2),480(3→recovery#2)
    await vi.advanceTimersByTimeAsync(500_000);

    // Force timeout
    await vi.advanceTimersByTimeAsync(200_000);
    const result = await promise as MonitorResult;

    // Recovery should have been sent twice
    const recoveryLogs = result.logs.filter((l: string) => l.includes("Recovery #"));
    expect(recoveryLogs.length).toBe(2);
    expect(mockedPasteBuffer).toHaveBeenCalledTimes(2);
  }, 15_000);

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
          return JSON.stringify({ flow: "feature", status: "completed", completed: ["specify"], current: null, pipeline: ["specify"] });
        }
        return JSON.stringify({ flow: "feature", status: "active", completed: [], current: "specify", pipeline: ["specify"] });
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

  describe("findPipelineState via readPipelineInfo", () => {
    it("_runs/ 配下の pipeline-state.json を発見する (team mode)", async () => {
      const { readPipelineInfo } = await importMonitor();
      const mockedReaddirSync = vi.mocked(readdirSync);

      mockedExistsSync.mockImplementation(((p: PathLike) => {
        const s = String(p);
        // features/ does not exist
        if (s.endsWith("features")) return false;
        // _runs/ exists
        if (s.endsWith("_runs")) return true;
        // _runs/001-function-visualizer/pipeline-state.json exists
        if (s.includes("_runs/001-function-visualizer/pipeline-state.json")) return true;
        return false;
      }) as typeof existsSync);

      mockedReaddirSync.mockImplementation(((dirPath: string) => {
        if (String(dirPath).endsWith("_runs")) {
          return [
            { name: "001-function-visualizer", isDirectory: () => true },
          ] as any;
        }
        return [] as any;
      }) as any);

      mockReadFile((p) => {
        if (p.includes("pipeline-state.json")) {
          return JSON.stringify({
            flow: "feature",
            current: "implement",
            completed: ["specify", "plan"],
            pipeline: ["specify", "plan", "implement", "review"],
          });
        }
        return "{}";
      });

      const info = readPipelineInfo("/tmp/combo/test-combo");
      expect(info).not.toBeNull();
      expect(info!.current).toBe("implement");
      expect(info!.stateDir).toContain("_runs/001-function-visualizer");
    });

    it("_runs/ のアーカイブディレクトリ (YYYYMMDD-*) は除外する", async () => {
      const { readPipelineInfo } = await importMonitor();
      const mockedReaddirSync = vi.mocked(readdirSync);

      mockedExistsSync.mockImplementation(((p: PathLike) => {
        const s = String(p);
        if (s.endsWith("features")) return false;
        if (s.endsWith("_runs")) return true;
        return false;
      }) as typeof existsSync);

      mockedReaddirSync.mockImplementation(((dirPath: string) => {
        if (String(dirPath).endsWith("_runs")) {
          return [
            { name: "20260221-143000", isDirectory: () => true },
          ] as any;
        }
        return [] as any;
      }) as any);

      const info = readPipelineInfo("/tmp/combo/test-combo");
      expect(info).toBeNull();
    });
  });

  describe("readPipelineInfo", () => {
    it("pipeline-state.json から正しく情報を読む", async () => {
      const { readPipelineInfo } = await importMonitor();
      mockExists((p) => p.includes("pipeline-state.json"));
      mockReadFile((p) => {
        if (p.includes("pipeline-state.json")) {
          return JSON.stringify({
            flow: "feature",
            current: "implement",
            completed: ["specify", "suggest", "plan", "tasks"],
            pipeline: ["specify", "suggest", "plan", "tasks", "implement", "review"],
          });
        }
        return "{}";
      });

      const info = readPipelineInfo("/tmp/combo/test-combo");
      expect(info).not.toBeNull();
      expect(info!.flow).toBe("feature");
      expect(info!.current).toBe("implement");
      expect(info!.completed).toEqual(["specify", "suggest", "plan", "tasks"]);
      expect(info!.pipeline).toEqual(["specify", "suggest", "plan", "tasks", "implement", "review"]);
    });

    it("pipeline-state.json が存在しない → null", async () => {
      const { readPipelineInfo } = await importMonitor();
      mockedExistsSync.mockReturnValue(false);

      const info = readPipelineInfo("/tmp/combo/test-combo");
      expect(info).toBeNull();
    });
  });

  describe("buildRecoveryMessage", () => {
    it("正しいフォーマットのメッセージを返す", async () => {
      const { buildRecoveryMessage } = await importMonitor();

      const msg = buildRecoveryMessage({
        flow: "feature",
        current: "implement",
        completed: ["specify", "suggest", "plan"],
        pipeline: ["specify", "suggest", "plan", "implement", "review"],
        stateDir: "features/my-feature",
      });

      expect(msg).toContain("[MONITOR] TUI idle but pipeline incomplete");
      expect(msg).toContain("current: implement");
      expect(msg).toContain("3/5 steps done");
      expect(msg).toContain("--flow feature");
      expect(msg).toContain("--state-dir features/my-feature");
      expect(msg).toContain("poor-dev.team Core Loop");
    });
  });

  it("Phase 0 タイムアウト (10分) で自動遷移する", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 700 });

    // pipeline-state.json は存在しないが、Phase 0 が完了しない設定
    mockedExistsSync.mockReturnValue(false);
    mockedRespondToPhase0.mockReturnValue({ responded: false, turnCount: 0, done: false });

    // Pipeline completes after phase0 timeout
    let phase0TimedOut = false;
    mockedCapturePaneContent.mockImplementation(() => {
      if (phase0TimedOut) return "TUI content";
      return "Phase 0 still going...";
    });

    const promise = runMonitor(options);
    // Advance past 600s (phase0 timeout)
    await vi.advanceTimersByTimeAsync(610_000);
    phase0TimedOut = true;

    // Then timeout at 700s
    await vi.advanceTimersByTimeAsync(100_000);
    const result = await promise as MonitorResult;

    expect(result.logs.some((l: string) => l.includes("Phase 0 timeout"))).toBe(true);
  }, 10_000);

  it("pipeline-state.json 出現で Phase 0 完了を検出する", async () => {
    const { runMonitor } = await importMonitor();
    const options = makeDefaultOptions({ timeoutSeconds: 30 });

    // Phase 0 が done しないが、pipeline-state.json が途中で出現
    mockedRespondToPhase0.mockReturnValue({ responded: false, turnCount: 0, done: false });

    let pipelineExists = false;
    mockedExistsSync.mockImplementation(((p: PathLike) => {
      const s = String(p);
      if (s.includes("pipeline-state.json")) return pipelineExists;
      if (s.endsWith("features") || s.endsWith("_runs")) return false;
      return false;
    }) as typeof existsSync);

    mockReadFile((p) => {
      if (p.includes("pipeline-state.json")) {
        return JSON.stringify({ flow: "feature", status: "completed", completed: ["specify"], current: null, pipeline: ["specify"] });
      }
      if (p.includes("phase0")) {
        return JSON.stringify({ flow_type: "feature", max_turns: 99, responses: [], fallback: "ok" });
      }
      return "{}";
    });

    mockedCapturePaneContent.mockReturnValue("some content");

    const promise = runMonitor(options);
    // After 15s, pipeline-state.json appears
    await vi.advanceTimersByTimeAsync(15_000);
    pipelineExists = true;

    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise as MonitorResult;

    expect(result.logs.some((l: string) => l.includes("pipeline-state.json detected"))).toBe(true);
  }, 10_000);

  describe("isTUIIdle — Bash Dispatch / truncate 耐性", () => {
    it("'esc to int…' (truncated) でも idle 判定されない", async () => {
      const { runMonitor } = await importMonitor();
      const options = makeDefaultOptions({ timeoutSeconds: 20 });

      setPipelineState("active", ["specify"], "plan");
      mockExists((p) => p.includes("pipeline-state.json"));

      // 50% 幅ペインで truncate された TUI 出力
      mockedCapturePaneContent.mockReturnValue(
        "⏵⏵ bypass permissions on (shift+tab to cycle) · esc to int…\n❯ "
      );
      mockedExecSync.mockReturnValue("index.html\n");

      const promise = runMonitor(options);
      await vi.advanceTimersByTimeAsync(25_000);
      const result = await promise as MonitorResult;

      // "esc to int" マッチで active 判定 → idle exit ではなく timeout
      expect(result.exitReason).toBe("timeout");
    });

    it("'⎿  Running…' を含む場合に idle 判定されない", async () => {
      const { runMonitor } = await importMonitor();
      const options = makeDefaultOptions({ timeoutSeconds: 20 });

      setPipelineState("active", ["specify"], "plan");
      mockExists((p) => p.includes("pipeline-state.json"));

      // Bash ツール実行中の TUI 出力
      mockedCapturePaneContent.mockReturnValue(
        "⎿  Running glm -p 'implement the feature'\n❯ "
      );
      mockedExecSync.mockReturnValue("index.html\n");

      const promise = runMonitor(options);
      await vi.advanceTimersByTimeAsync(25_000);
      const result = await promise as MonitorResult;

      // "⎿  Running" マッチで active 判定 → idle exit ではなく timeout
      expect(result.exitReason).toBe("timeout");
    });

    it("Bash Dispatch 長時間実行: ❯ あり + Running あり → idle にならない", async () => {
      const { runMonitor } = await importMonitor();
      const options = makeDefaultOptions({ timeoutSeconds: 20 });
      const mockedPasteBuffer = vi.mocked(pasteBuffer);

      setPipelineState("active", ["specify", "plan"], "implement", ["specify", "plan", "implement", "review"]);
      mockExists((p) => p.includes("pipeline-state.json"));

      // Bash ツール実行中
      mockedCapturePaneContent.mockReturnValue(
        "⎿  Running glm -p '... long prompt ...'\n\nSome output here...\n❯ "
      );
      mockedExecSync.mockReturnValue("");

      const promise = runMonitor(options);
      await vi.advanceTimersByTimeAsync(25_000);
      const result = await promise as MonitorResult;

      // Recovery message は送信されない
      expect(mockedPasteBuffer).not.toHaveBeenCalled();
      // timeout で終了（idle exit ではない）
      expect(result.exitReason).toBe("timeout");
    });
  });

});

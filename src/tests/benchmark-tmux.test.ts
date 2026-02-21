/**
 * benchmark-tmux.test.ts
 *
 * tmux ユーティリティ関数のテスト。
 *
 * テスト対象: src/lib/benchmark/tmux.ts
 * - capturePaneContent
 * - sendKeys
 * - sendKeysLiteral
 * - pasteBuffer
 * - splitWindow
 * - listPanes
 * - killPane
 * - paneExists
 *
 * child_process.execFileSync を vi.mock でモックして実際の tmux は呼ばない。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// node:child_process をモック
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "node:child_process";

// テスト対象の関数をインポート（モック適用後）
const mockedExecFileSync = vi.mocked(execFileSync);

// テスト対象モジュールを動的インポート
async function importTmux() {
  return import("../lib/benchmark/tmux.js");
}

describe("tmux utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------
  // capturePaneContent
  // ---------------------------------------------------------------

  describe("capturePaneContent", () => {
    it("正しい tmux コマンドで execFileSync が呼ばれる", async () => {
      const expectedContent = "pane content line 1\npane content line 2";
      mockedExecFileSync.mockReturnValue(expectedContent as any);

      const { capturePaneContent } = await importTmux();
      const result = capturePaneContent("test-pane");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        ["capture-pane", "-t", "test-pane", "-p", "-S", "-100"],
        expect.any(Object)
      );
      expect(result).toBe(expectedContent);
    });

    it("ペイン ID が正しく渡される", async () => {
      mockedExecFileSync.mockReturnValue("content" as any);

      const { capturePaneContent } = await importTmux();
      capturePaneContent("my-pane:0.1");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        expect.arrayContaining(["-t", "my-pane:0.1"]),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // sendKeys
  // ---------------------------------------------------------------

  describe("sendKeys", () => {
    it("正しいコマンドが実行される", async () => {
      mockedExecFileSync.mockReturnValue("" as any);

      const { sendKeys } = await importTmux();
      sendKeys("test-pane", "Enter");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        ["send-keys", "-t", "test-pane", "Enter"],
        expect.any(Object)
      );
    });

    it("複数キーを送信できる", async () => {
      mockedExecFileSync.mockReturnValue("" as any);

      const { sendKeys } = await importTmux();
      sendKeys("test-pane", "C-c");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        expect.arrayContaining(["C-c"]),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // sendKeysLiteral
  // ---------------------------------------------------------------

  describe("sendKeysLiteral", () => {
    it("リテラルテキストとして送信する", async () => {
      mockedExecFileSync.mockReturnValue("" as any);

      const { sendKeysLiteral } = await importTmux();
      sendKeysLiteral("test-pane", "echo 'hello world'");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        ["send-keys", "-t", "test-pane", "-l", "echo 'hello world'"],
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // pasteBuffer
  // ---------------------------------------------------------------

  describe("pasteBuffer", () => {
    it("set-buffer + paste-buffer の 2 コマンドが順番に実行される", async () => {
      mockedExecFileSync.mockReturnValue("" as any);

      const { pasteBuffer } = await importTmux();
      pasteBuffer("test-pane", "test-buffer", "multi\nline\ntext");

      // 2回呼ばれることを確認
      expect(mockedExecFileSync).toHaveBeenCalledTimes(2);

      // 1回目: set-buffer
      expect(mockedExecFileSync).toHaveBeenNthCalledWith(
        1,
        "tmux",
        expect.arrayContaining(["set-buffer"]),
        expect.any(Object)
      );

      // 2回目: paste-buffer
      expect(mockedExecFileSync).toHaveBeenNthCalledWith(
        2,
        "tmux",
        expect.arrayContaining(["paste-buffer"]),
        expect.any(Object)
      );
    });

    it("バッファ名とテキストが正しく渡される", async () => {
      mockedExecFileSync.mockReturnValue("" as any);

      const { pasteBuffer } = await importTmux();
      pasteBuffer("my-pane", "my-buffer", "test content");

      // set-buffer: テキストがそのまま渡される（クォート無し）
      expect(mockedExecFileSync).toHaveBeenNthCalledWith(
        1,
        "tmux",
        ["set-buffer", "-b", "my-buffer", "test content"],
        expect.any(Object)
      );

      // paste-buffer: ペインIDとバッファ名が正しい
      expect(mockedExecFileSync).toHaveBeenNthCalledWith(
        2,
        "tmux",
        ["paste-buffer", "-p", "-t", "my-pane", "-b", "my-buffer", "-d"],
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // splitWindow
  // ---------------------------------------------------------------

  describe("splitWindow", () => {
    it("正しいオプションが渡される（デフォルト）", async () => {
      mockedExecFileSync.mockReturnValue("new-pane-id" as any);

      const { splitWindow } = await importTmux();
      const result = splitWindow({});

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        ["split-window", "-P", "-F", "#{pane_id}"],
        expect.any(Object)
      );
      expect(result).toBe("new-pane-id");
    });

    it("垂直分割オプションが渡される", async () => {
      mockedExecFileSync.mockReturnValue("new-pane-id" as any);

      const { splitWindow } = await importTmux();
      splitWindow({ vertical: true });

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        expect.arrayContaining(["-v"]),
        expect.any(Object)
      );
    });

    it("ターゲットペインが指定される", async () => {
      mockedExecFileSync.mockReturnValue("new-pane-id" as any);

      const { splitWindow } = await importTmux();
      splitWindow({ targetPane: "source-pane" });

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        expect.arrayContaining(["-t", "source-pane"]),
        expect.any(Object)
      );
    });

    it("パーセンテージが指定される", async () => {
      mockedExecFileSync.mockReturnValue("new-pane-id" as any);

      const { splitWindow } = await importTmux();
      splitWindow({ percentage: 50 });

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        expect.arrayContaining(["-p", "50"]),
        expect.any(Object)
      );
    });

    it("全オプションを組み合わせて使用できる", async () => {
      mockedExecFileSync.mockReturnValue("new-pane-id" as any);

      const { splitWindow } = await importTmux();
      splitWindow({ vertical: true, targetPane: "main", percentage: 30 });

      const args = mockedExecFileSync.mock.calls[0]?.[1] as string[];
      expect(args).toContain("-v");
      expect(args).toContain("-t");
      expect(args).toContain("main");
      expect(args).toContain("-p");
      expect(args).toContain("30");
    });
  });

  // ---------------------------------------------------------------
  // listPanes
  // ---------------------------------------------------------------

  describe("listPanes", () => {
    it("ペイン一覧を配列で返す", async () => {
      mockedExecFileSync.mockReturnValue("pane0\npane1\npane2" as any);

      const { listPanes } = await importTmux();
      const result = listPanes();

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        expect.arrayContaining(["list-panes"]),
        expect.any(Object)
      );
      expect(result).toEqual(["pane0", "pane1", "pane2"]);
    });

    it("空の結果の場合は空配列を返す", async () => {
      mockedExecFileSync.mockImplementation(() => {
        throw new Error("no panes");
      });

      const { listPanes } = await importTmux();
      const result = listPanes();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // listAllPanes
  // ---------------------------------------------------------------

  describe("listAllPanes", () => {
    it("全セッションのペイン一覧を返す (-a フラグ付き)", async () => {
      mockedExecFileSync.mockReturnValue("%0\n%1\n%2\n%3" as any);

      const { listAllPanes } = await importTmux();
      const result = listAllPanes();

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        ["list-panes", "-a", "-F", "#{pane_id}"],
        expect.any(Object)
      );
      expect(result).toEqual(["%0", "%1", "%2", "%3"]);
    });

    it("エラー時は空配列を返す", async () => {
      mockedExecFileSync.mockImplementation(() => {
        throw new Error("no server");
      });

      const { listAllPanes } = await importTmux();
      const result = listAllPanes();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // killPane
  // ---------------------------------------------------------------

  describe("killPane", () => {
    it("指定されたペインを削除する", async () => {
      mockedExecFileSync.mockReturnValue("" as any);

      const { killPane } = await importTmux();
      killPane("target-pane");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "tmux",
        ["kill-pane", "-t", "target-pane"],
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // paneExists
  // ---------------------------------------------------------------

  describe("paneExists", () => {
    it("正常時 true を返す", async () => {
      // list-panes の出力にペインIDが含まれていればtrue
      mockedExecFileSync.mockReturnValue("existing-pane\nother-pane\n" as any);

      const { paneExists } = await importTmux();
      const result = paneExists("existing-pane");

      expect(result).toBe(true);
    });

    it("エラー時 false を返す", async () => {
      // ペインが存在しない場合、tmux はエラーを投げる
      mockedExecFileSync.mockImplementation(() => {
        throw new Error("can't find pane: non-existent-pane");
      });

      const { paneExists } = await importTmux();
      const result = paneExists("non-existent-pane");

      expect(result).toBe(false);
    });

    it("任意のエラーで false を返す", async () => {
      mockedExecFileSync.mockImplementation(() => {
        throw new Error("some tmux error");
      });

      const { paneExists } = await importTmux();
      const result = paneExists("any-pane");

      expect(result).toBe(false);
    });
  });
});

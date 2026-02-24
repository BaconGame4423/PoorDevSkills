/**
 * benchmark-phase0-responder.test.ts
 *
 * Phase 0 自動応答ロジックのテスト。
 *
 * テスト対象: src/lib/benchmark/phase0-responder.ts
 * - matchResponse
 * - respondToPhase0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// tmux 関数をモック
vi.mock("../lib/benchmark/tmux.js", () => ({
  capturePaneContent: vi.fn(),
  sendKeys: vi.fn(),
  sendKeysLiteral: vi.fn(),
  pasteBuffer: vi.fn(),
}));

import { capturePaneContent, sendKeys, pasteBuffer } from "../lib/benchmark/tmux.js";

const mockedCapturePaneContent = vi.mocked(capturePaneContent);
const mockedSendKeys = vi.mocked(sendKeys);
const mockedPasteBuffer = vi.mocked(pasteBuffer);

// テスト対象モジュールを動的インポート
async function importResponder() {
  return import("../lib/benchmark/phase0-responder.js");
}

// Phase0Config の型定義（テスト用）
interface Phase0Config {
  flow_type: string;
  discussion_context: { task_ref: string; scope: string };
  responses: Array<{ pattern: string; response: string }>;
  max_turns: number;
  fallback: string;
}

// テスト用デフォルト設定
function makeDefaultConfig(overrides?: Partial<Phase0Config>): Phase0Config {
  return {
    flow_type: "feature",
    discussion_context: {
      task_ref: "TEST-001",
      scope: "Add new feature",
    },
    responses: [
      { pattern: "scope|目的|ゴール", response: "この機能のゴールは〇〇です" },
      { pattern: "技術|technology|ライブラリ", response: "TypeScript を使用します" },
    ],
    max_turns: 5,
    fallback: "はい、進めてください",
    ...overrides,
  };
}

/**
 * TUI のプロンプト待ち状態をシミュレートするペイン内容を生成。
 * respondToPhase0 は ❯ プロンプトが表示されている場合のみ応答する。
 */
function withPrompt(questionText: string): string {
  return `${questionText}\n\n❯ \n\n  ⏵⏵ bypass permissions on (shift+tab to cycle)`;
}

describe("phase0-responder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------
  // matchResponse
  // ---------------------------------------------------------------

  describe("matchResponse", () => {
    it("パターンにマッチする場合 → 対応する response を返す", async () => {
      const { matchResponse } = await importResponder();
      const config = makeDefaultConfig({
        responses: [
          { pattern: "scope", response: "この機能のゴールは〇〇です" },
          { pattern: "技術", response: "TypeScript を使用します" },
        ],
      });

      const result = matchResponse("この機能の scope を教えてください", config);

      expect(result).toBe("この機能のゴールは〇〇です");
    });

    it("複数パターンがマッチする場合 → 最初のマッチを返す", async () => {
      const { matchResponse } = await importResponder();
      const config = makeDefaultConfig({
        responses: [
          { pattern: "scope", response: "first match" },
          { pattern: "目的", response: "second match" },
        ],
      });

      const result = matchResponse("scope と 目的 どちらも含む", config);

      expect(result).toBe("first match");
    });

    it("マッチしない場合 → null を返す", async () => {
      const { matchResponse } = await importResponder();
      const config = makeDefaultConfig();

      const result = matchResponse("全く関係のないテキスト", config);

      expect(result).toBeNull();
    });

    it("OR パターン (|) が正規表現として動作する", async () => {
      const { matchResponse } = await importResponder();
      const config = makeDefaultConfig({
        responses: [
          { pattern: "scope|目的|ゴール", response: "matched via OR" },
        ],
      });

      expect(matchResponse("scopeを教えて", config)).toBe("matched via OR");
      expect(matchResponse("目的は何?", config)).toBe("matched via OR");
      expect(matchResponse("ゴール設定", config)).toBe("matched via OR");
      expect(matchResponse("無関係テキスト", config)).toBeNull();
    });

    it("空のコンテンツ → null を返す", async () => {
      const { matchResponse } = await importResponder();
      const config = makeDefaultConfig();

      expect(matchResponse("", config)).toBeNull();
    });

    it("大文字小文字を区別しない（ケースインセンシティブ）", async () => {
      const { matchResponse } = await importResponder();
      const config = makeDefaultConfig({
        responses: [
          { pattern: "SCOPE", response: "case insensitive match" },
        ],
      });

      const result = matchResponse("scope を教えて", config);
      expect(result).toBe("case insensitive match");
    });
  });

  // ---------------------------------------------------------------
  // respondToPhase0
  // ---------------------------------------------------------------

  describe("respondToPhase0", () => {
    it("プロンプト待ちで質問がある場合 → 応答を送信、responded=true", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("この機能の scope は何ですか?")
      );

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.responded).toBe(true);
      expect(result.done).toBe(false);
      expect(result.turnCount).toBe(1);
      expect(mockedCapturePaneContent).toHaveBeenCalledWith("test-pane");
    });

    it("プロンプトなし（処理中）→ responded=false", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      // ❯ がない = Claude が処理中
      mockedCapturePaneContent.mockReturnValue("この scope は?\n\n✻ Churned for 1m");

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.responded).toBe(false);
      expect(result.done).toBe(false);
    });

    it("質問がない場合 → responded=false", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("承認しました。次に進みます。")
      );

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.responded).toBe(false);
      expect(result.done).toBe(false);
    });

    it("turnCount >= max_turns → done=true", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig({ max_turns: 3 });

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("質問がありますか?")
      );

      const result = respondToPhase0("test-pane", config, 3);

      expect(result.done).toBe(true);
    });

    it("turnCount が max_turns に達した瞬間に done=true", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig({ max_turns: 2 });

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("質問?")
      );

      const result1 = respondToPhase0("test-pane", config, 0);
      expect(result1.turnCount).toBe(1);
      expect(result1.done).toBe(false);

      const result2 = respondToPhase0("test-pane", config, 1);
      expect(result2.turnCount).toBe(2);
      expect(result2.done).toBe(true);
    });

    it("マッチしない質問 → fallback を送信", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig({
        fallback: "カスタムフォールバック応答",
        responses: [],
      });

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("未知の質問ですか?")
      );

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.responded).toBe(true);
      expect(
        mockedPasteBuffer.mock.calls.length > 0 ||
        mockedSendKeys.mock.calls.length > 0
      ).toBe(true);
    });

    it("複数回呼び出しで turnCount が増加する", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("scopeの質問?")
      );

      const result1 = respondToPhase0("test-pane", config, 0);
      expect(result1.turnCount).toBe(1);

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("技術の質問?")
      );
      const result2 = respondToPhase0("test-pane", config, result1.turnCount);
      expect(result2.turnCount).toBe(2);
    });

    it("空のペインコンテンツ → responded=false", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      mockedCapturePaneContent.mockReturnValue("");

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.responded).toBe(false);
    });

    it("Opus からの応答待ち状態（thinking）→ responded=false", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      mockedCapturePaneContent.mockReturnValue("Opus thinking...\n✻ Churned for 30s");

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.responded).toBe(false);
    });

    it("パターンマッチした応答を送信する", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig({
        responses: [
          { pattern: "テスト", response: "テスト応答メッセージ" },
        ],
      });

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("テストについてどう思いますか?")
      );

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.responded).toBe(true);
      expect(
        mockedPasteBuffer.mock.calls.length > 0 ||
        mockedSendKeys.mock.calls.length > 0
      ).toBe(true);
    });

    it("ペイン内容に bash_dispatch 等が含まれても done=false（偽陽性防止）", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      // poor-dev.md スキルテキストに bash_dispatch が含まれるケース
      // Phase 0 終了判定は findPipelineState() に一本化されているため、
      // テキストマッチでは done にならない
      mockedCapturePaneContent.mockReturnValue(
        withPrompt("bash_dispatch で specify を実行中... 質問はありますか?")
      );

      const result = respondToPhase0("test-pane", config, 0);

      // exit patterns 削除済み → テキスト内の bash_dispatch では done にならない
      expect(result.done).toBe(false);
      // 質問マーカー ? があり、プロンプト待ちなので応答する
      expect(result.responded).toBe(true);
    });

    it("ペイン内容に pipeline-state.json が含まれても done=false", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      mockedCapturePaneContent.mockReturnValue(
        withPrompt("pipeline-state.json を作成します。よろしいですか?")
      );

      const result = respondToPhase0("test-pane", config, 0);

      expect(result.done).toBe(false);
      expect(result.responded).toBe(true);
    });

    it("古い出力の ? では応答しない（最新20行のみ対象）", async () => {
      const { respondToPhase0 } = await importResponder();
      const config = makeDefaultConfig();

      // 質問は古い出力に埋もれている（20行以上前）
      const oldLines = Array(25).fill("これは古い出力行です").join("\n");
      mockedCapturePaneContent.mockReturnValue(
        `この scope は何ですか?\n${oldLines}\n❯ \n\n  ⏵⏵ bypass permissions on`
      );

      const result = respondToPhase0("test-pane", config, 0);

      // 最新20行に ? がないので responded=false
      expect(result.responded).toBe(false);
    });
  });
});

import type { Phase0Config } from "./types.js";
import { capturePaneContent, pasteBuffer, sendKeys } from "./tmux.js";

/**
 * Phase 0 終了を示すキーワード。
 * これらがペインに出現したら Discussion フェーズは完了と判断。
 */
const PHASE0_EXIT_PATTERNS = [
  "TeamCreate",
  "create_team",
  "create_review_team",
  "pd-",               // チーム名 pd-<step>-<NNN>
  "poor-dev-next.js",  // TS ヘルパー呼び出し
  "step_complete",
  "pipeline-state.json",
];

export function matchResponse(
  paneContent: string,
  config: Phase0Config
): string | null {
  for (const entry of config.responses) {
    // pattern は "|" 区切りの OR マッチ（正規表現として評価）
    const regex = new RegExp(entry.pattern, "i");
    if (regex.test(paneContent)) {
      return entry.response;
    }
  }
  return null;
}

/**
 * ペインの最後 N 行を取得する。
 * 質問検出は最新の出力のみ対象にし、スクロール済みの古い `?` を無視する。
 */
function getRecentLines(paneContent: string, n: number): string {
  const lines = paneContent.split("\n");
  return lines.slice(-n).join("\n");
}

/**
 * TUI がユーザー入力待ち（❯ プロンプト表示中）かどうかを判定。
 * Claude が処理中（thinking/churning）の場合は false。
 */
function isWaitingForInput(paneContent: string): boolean {
  const lines = paneContent.split("\n");
  // 最後の非空行から ❯ を探す
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (trimmed.length === 0) continue;
    // ❯ がプロンプト行にあるか
    if (trimmed.startsWith("❯") || trimmed === "❯") return true;
    // bypass permissions やヒント行はスキップ
    if (trimmed.includes("bypass permissions") || trimmed.includes("Tip:") || trimmed.includes("ctrl+")) continue;
    // それ以外の実質的な行がある = まだ出力中
    return false;
  }
  return false;
}

export function respondToPhase0(
  paneId: string,
  config: Phase0Config,
  turnCount: number
): { responded: boolean; turnCount: number; done: boolean } {
  if (turnCount >= config.max_turns) {
    return { responded: false, turnCount, done: true };
  }

  const paneContent = capturePaneContent(paneId);

  // Phase 0 終了検出: パイプライン実行が始まっていれば応答停止
  for (const exitPattern of PHASE0_EXIT_PATTERNS) {
    if (paneContent.includes(exitPattern)) {
      return { responded: false, turnCount, done: true };
    }
  }

  // TUI がプロンプト待ちでなければ応答しない
  if (!isWaitingForInput(paneContent)) {
    return { responded: false, turnCount, done: false };
  }

  // 最近の出力（最後20行）に質問マーカーがあるか
  const recentContent = getRecentLines(paneContent, 20);
  if (!recentContent.includes("?") && !recentContent.includes("？")) {
    return { responded: false, turnCount, done: false };
  }

  const response = matchResponse(recentContent, config);
  const textToSend = response ?? config.fallback;

  pasteBuffer(paneId, `phase0-buf-${Date.now()}`, textToSend);
  sendKeys(paneId, "Enter");

  const newTurnCount = turnCount + 1;
  const done = newTurnCount >= config.max_turns;

  return { responded: true, turnCount: newTurnCount, done };
}

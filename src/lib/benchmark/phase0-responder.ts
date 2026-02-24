import type { Phase0Config } from "./types.js";
import { capturePaneContent, pasteBuffer, sendKeys } from "./tmux.js";

/**
 * UI タイプを検出する。
 * AskUserQuestion の selection UI と通常のテキストプロンプトを区別。
 */
function detectUIType(recentContent: string): "text" | "selection" | "unknown" {
  const lines = recentContent.split("\n");
  // Claude CLI selection UI: "Enter to select · ↑/↓ to navigate" hint or "❯ N." cursor
  if (lines.some(l => l.includes("Enter to select"))) return "selection";
  if (lines.some(l => /❯\s*\d+\./.test(l))) return "selection";
  // opencode selection UI: indented bullet/marker characters
  const hasOptions = lines.some(l => /^\s{2,}[○●▸▹►◆◇>\[\(]/.test(l));
  if (hasOptions) return "selection";
  if (lines.some(l => l.trim().startsWith("❯"))) return "text";
  return "unknown";
}

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
  // Selection UI は常にユーザー入力待ち状態
  if (lines.some(l => l.includes("Enter to select"))) return true;
  // ❯ N. カーソルパターン（Plan Mode 終了ダイアログ等、"Enter to select" ヒントなし）
  if (lines.some(l => /❯\s*\d+\./.test(l))) return true;
  // 最後の非空行から ❯ を探す
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (trimmed.length === 0) continue;
    // ❯ がプロンプト行にあるか
    if (trimmed.startsWith("❯") || trimmed === "❯") return true;
    // bypass permissions やヒント行、selection UI ナビゲーション行はスキップ
    if (trimmed.includes("bypass permissions") || trimmed.includes("Tip:") || trimmed.includes("ctrl+") || trimmed.includes("ctrl-g")) continue;
    // Plan ファイルパス行 (~/.claude/plans/...) をスキップ
    if (trimmed.startsWith("~/.claude/") || trimmed.includes("/.claude/plans/")) continue;
    if (trimmed.includes("Enter to select") || trimmed.includes("↑/↓ to navigate")) continue;
    // "N. Chat about this" 等の selection UI 末尾行はスキップ
    if (/^\d+\.\s/.test(trimmed)) continue;
    // Claude Code TUI のセパレータ行（ボックスドローイング文字のみ）はスキップ
    if (/^[─━═┄┅┈┉\-]+$/.test(trimmed)) continue;
    // それ以外の実質的な行がある = まだ出力中
    return false;
  }
  return false;
}

export function respondToPhase0(
  paneId: string,
  config: Phase0Config,
  turnCount: number,
  paneContent?: string
): { responded: boolean; turnCount: number; done: boolean } {
  if (turnCount >= config.max_turns) {
    return { responded: false, turnCount, done: true };
  }

  const content = paneContent ?? capturePaneContent(paneId);

  // TUI がプロンプト待ちでなければ応答しない
  if (!isWaitingForInput(content)) {
    return { responded: false, turnCount, done: false };
  }

  // Selection UI 検出は全文に対して行う。
  // Claude Code の AskUserQuestion は選択肢の下に大量の空白パディングがあるため、
  // getRecentLines() では "Enter to select" や "?" を検出できない。
  const fullUIType = detectUIType(content);
  if (fullUIType === "selection") {
    sendKeys(paneId, "Enter");
    const newTurnCount = turnCount + 1;
    const done = newTurnCount >= config.max_turns;
    return { responded: true, turnCount: newTurnCount, done };
  }

  // テキストプロンプト: 最近の出力に質問マーカーがあるか
  const recentContent = getRecentLines(content, 20);
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

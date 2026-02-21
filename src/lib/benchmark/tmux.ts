import { execFileSync } from "node:child_process";

function execTmux(args: string[]): string {
  try {
    return execFileSync("tmux", args, { encoding: "utf-8" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`tmux command failed: tmux ${args.join(" ")}\n${msg}`);
  }
}

function execTmuxSafe(args: string[]): string | null {
  try {
    return execTmux(args);
  } catch {
    return null;
  }
}

export function capturePaneContent(paneId: string): string {
  return execTmux(["capture-pane", "-t", paneId, "-p", "-S", "-100"]);
}

/**
 * 単一キー送信用。テキスト送信は sendKeysLiteral を使う。
 * keys はスペース区切りで複数キーを指定可能（例: "C-c Enter"）。
 */
export function sendKeys(paneId: string, keys: string): void {
  execTmux(["send-keys", "-t", paneId, ...keys.split(" ")]);
}

export function sendKeysLiteral(paneId: string, text: string): void {
  execTmux(["send-keys", "-t", paneId, "-l", text]);
}

export function pasteBuffer(
  paneId: string,
  bufferName: string,
  text: string
): void {
  execTmux(["set-buffer", "-b", bufferName, text]);
  execTmux(["paste-buffer", "-p", "-t", paneId, "-b", bufferName, "-d"]);
}

export function splitWindow(options: {
  vertical?: boolean;
  targetPane?: string;
  percentage?: number;
}): string {
  const args = ["split-window"];
  if (options.vertical) {
    args.push("-v");
  }
  if (options.targetPane) {
    args.push("-t", options.targetPane);
  }
  if (options.percentage) {
    args.push("-p", String(options.percentage));
  }
  args.push("-P", "-F", "#{pane_id}");
  const result = execTmux(args);
  return result.trim();
}

export function listPanes(): string[] {
  const result = execTmuxSafe(["list-panes", "-F", "#{pane_id}"]);
  if (!result) {
    return [];
  }
  return result
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function killPane(paneId: string): void {
  execTmux(["kill-pane", "-t", paneId]);
}

export function paneExists(paneId: string): boolean {
  const result = execTmuxSafe(["list-panes", "-F", "#{pane_id}"]);
  if (!result) {
    return false;
  }
  const panes = result
    .trim()
    .split("\n")
    .map((s) => s.trim());
  return panes.includes(paneId);
}

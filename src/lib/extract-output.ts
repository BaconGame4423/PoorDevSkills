/**
 * extract-output.ts
 *
 * extract-output.sh の TypeScript 移植。
 * ディスパッチ出力を抽出してアーティファクトファイルに保存する。
 *
 * 対応フォーマット:
 *   1. opencode JSON lines (.part.text フィールド)
 *   2. claude plaintext（そのまま）
 *
 * [BRANCH: ...] メタデータ行を除去する。
 *
 * extract-output.sh 全体参照。
 */

import fs from "node:fs";
import path from "node:path";

// --- 型定義 ---

export interface ExtractResult {
  status: "ok" | "error";
  bytes?: number;
  format?: "opencode" | "plaintext";
  error?: string;
}

// --- コンテンツ抽出 ---

/**
 * opencode JSON lines から text パートを抽出する。
 * extract-output.sh L42-45 に対応。
 */
function extractOpencodeJson(content: string): string | null {
  const parts: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trimmed) as { type?: string; part?: { text?: string } };
      if (obj.type === "text" && obj.part?.text) {
        parts.push(obj.part.text);
      }
    } catch { /* no-op */ }
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * [BRANCH: ...] メタデータ行を除去する。
 * extract-output.sh の sed '/^\[BRANCH:/d' に対応。
 */
function removeBranchLines(content: string): string {
  return content
    .split("\n")
    .filter((line) => !line.startsWith("[BRANCH:"))
    .join("\n");
}

// --- メイン関数 ---

/**
 * output ファイルからコンテンツを抽出して saveTo に保存する。
 * extract-output.sh のメインロジック全体に対応。
 */
export function extractOutput(outputFile: string, saveTo: string): ExtractResult {
  // outputFile の存在確認
  if (!fs.existsSync(outputFile)) {
    return { status: "error", error: `Output file not found: ${outputFile}` };
  }

  const rawContent = fs.readFileSync(outputFile, "utf8");
  if (!rawContent.trim()) {
    return { status: "error", error: `Output file is empty: ${outputFile}` };
  }

  // 保存先ディレクトリを作成
  fs.mkdirSync(path.dirname(saveTo), { recursive: true });

  // Strategy 1: opencode JSON format
  const opencodeText = extractOpencodeJson(rawContent);
  let format: "opencode" | "plaintext";
  let extracted: string;

  if (opencodeText !== null) {
    format = "opencode";
    extracted = removeBranchLines(opencodeText);
  } else {
    // Strategy 2: plaintext
    format = "plaintext";
    extracted = removeBranchLines(rawContent);
  }

  // バリデーション
  if (!extracted.trim()) {
    return { status: "error", error: `Extraction produced empty file: ${saveTo}` };
  }

  // 書き込み
  fs.writeFileSync(saveTo, extracted, "utf8");
  const bytes = Buffer.byteLength(extracted, "utf8");

  return { status: "ok", bytes, format };
}

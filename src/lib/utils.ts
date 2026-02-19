/**
 * utils.ts
 *
 * utils.sh の TypeScript 移植。
 * 共通ユーティリティ関数群。
 *
 * utils.sh 全体参照。
 */

import fs from "node:fs";
import path from "node:path";

import type { PoorDevConfig } from "./types.js";

// --- JSON ヘルパー ---

/**
 * JSON 文字列から jq 式相当の値を抽出する。
 * utils.sh の json_get() に対応。
 *
 * @example jsonGet('{"a":{"b":1}}', '.a.b') // "1"
 */
export function jsonGet(json: string, expr: string): string {
  try {
    const obj = JSON.parse(json) as unknown;
    const result = evalJqExpr(obj, expr);
    return result === null || result === undefined ? "" : String(result);
  } catch {
    return "";
  }
}

/**
 * JSON 文字列から値を抽出し、nullや未定義の場合はデフォルト値を返す。
 * utils.sh の json_get_or() に対応。
 */
export function jsonGetOr(json: string, expr: string, defaultVal: string): string {
  const result = jsonGet(json, expr);
  if (result === "" || result === "null") return defaultVal;
  return result;
}

/**
 * 簡易 jq 式評価（最小限の . アクセスのみサポート）。
 * 複雑な jq 式は不要なため、プロパティアクセスのみ実装。
 */
function evalJqExpr(obj: unknown, expr: string): unknown {
  // ".foo.bar" 形式のアクセスのみサポート
  const parts = expr.replace(/^\./, "").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (part === "") continue;
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part] ?? null;
  }
  return current;
}

// --- エラー出力 ---

/**
 * エラーを JSON 形式で stderr に出力して終了する。
 * utils.sh の die() に対応。
 * TS 版では例外をスロー（プロセス終了ではなく）。
 */
export function die(message: string): never {
  process.stderr.write(JSON.stringify({ error: message }) + "\n");
  throw new Error(message);
}

// --- 一時ファイル管理 ---

const _tempFiles: string[] = [];

/**
 * 一時ファイルを作成し、cleanup 対象に登録する。
 * utils.sh の make_temp() に対応。
 */
export function makeTemp(prefix = "poor-dev"): string {
  const tmpFile = `/tmp/poor-dev-${prefix}-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, "");
  _tempFiles.push(tmpFile);
  return tmpFile;
}

/**
 * 登録された一時ファイルを全て削除する。
 * utils.sh の cleanup_temp_files() に対応。
 */
export function cleanupTempFiles(): void {
  for (const f of _tempFiles) {
    try { fs.unlinkSync(f); } catch { /* no-op */ }
  }
  _tempFiles.length = 0;
}

// --- Config ---

/**
 * .poor-dev/config.json を読み込んで PoorDevConfig を返す。
 * utils.sh の read_config() に対応。
 * 存在しない場合は null を返す。
 */
export function readConfig(projectDir: string): PoorDevConfig | null {
  const configPath = path.join(projectDir, ".poor-dev/config.json");
  try {
    const content = fs.readFileSync(configPath, "utf8");
    return JSON.parse(content) as PoorDevConfig;
  } catch {
    return null;
  }
}

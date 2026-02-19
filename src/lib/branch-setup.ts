/**
 * branch-setup.ts
 *
 * branch-setup.sh の TypeScript 移植。
 * 連番ブランチと specs/ ディレクトリを作成する。
 *
 * 処理:
 *   1. git fetch --all --prune
 *   2. リモート/ローカルブランチと specs/ ディレクトリから最大連番を取得
 *   3. (N+1)-short-name のブランチと specs/ ディレクトリを作成
 *
 * branch-setup.sh 全体参照。
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// --- 型定義 ---

export interface BranchSetupResult {
  number: string;
  branch: string;
  featureDir: string;
}

// --- 連番取得 ---

const NUMBERED_BRANCH_RE = /(?:^|\/)\s*(\d+)-/;

/**
 * git branch 出力から連番の最大値を抽出する。
 */
function extractMaxN(lines: string[]): number {
  let maxN = 0;
  for (const line of lines) {
    const m = NUMBERED_BRANCH_RE.exec(line);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  return maxN;
}

/**
 * specs/ ディレクトリから連番の最大値を抽出する。
 */
function extractMaxNFromSpecs(projectDir: string): number {
  const specsDir = path.join(projectDir, "specs");
  if (!fs.existsSync(specsDir)) return 0;

  let maxN = 0;
  try {
    const entries = fs.readdirSync(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const m = /^(\d+)-/.exec(entry.name);
      if (m?.[1]) {
        const n = parseInt(m[1], 10);
        if (n > maxN) maxN = n;
      }
    }
  } catch { /* no-op */ }

  return maxN;
}

// --- メイン関数 ---

/**
 * 連番ブランチと specs/ ディレクトリを作成する。
 * branch-setup.sh のメインロジック全体に対応。
 *
 * @throws ブランチ作成に失敗した場合
 */
export function setupBranch(shortName: string, projectDir: string): BranchSetupResult {
  // 1. git fetch --all --prune
  try {
    execFileSync("git", ["-C", projectDir, "fetch", "--all", "--prune"], { stdio: "pipe" });
  } catch { /* no-op: fetch 失敗は続行 */ }

  // 2. 最大連番を取得
  let maxN = 0;

  // リモートブランチ
  try {
    const remoteBranches = execFileSync(
      "git", ["-C", projectDir, "branch", "-r"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).split("\n");
    const n = extractMaxN(remoteBranches);
    if (n > maxN) maxN = n;
  } catch { /* no-op */ }

  // ローカルブランチ
  try {
    const localBranches = execFileSync(
      "git", ["-C", projectDir, "branch"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).split("\n");
    const n = extractMaxN(localBranches);
    if (n > maxN) maxN = n;
  } catch { /* no-op */ }

  // specs/ ディレクトリ
  const specsN = extractMaxNFromSpecs(projectDir);
  if (specsN > maxN) maxN = specsN;

  // 3. 新しい連番を計算
  const newN = maxN + 1;
  const number = String(newN).padStart(3, "0");
  const branch = `${number}-${shortName}`;
  const featureDir = `specs/${branch}`;

  // 4. ブランチ重複チェック
  try {
    execFileSync(
      "git", ["-C", projectDir, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
      { stdio: "pipe" }
    );
    // show-ref が成功した場合はブランチが存在する
    throw new Error(`Branch '${branch}' already exists`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("already exists")) {
      throw err;
    }
    // show-ref が失敗した場合はブランチが存在しない → 続行
  }

  // 5. ブランチ作成
  execFileSync(
    "git", ["-C", projectDir, "checkout", "-b", branch],
    { stdio: ["pipe", "pipe", "pipe"] }
  );

  // 6. specs/ ディレクトリ作成
  const fdPath = path.join(projectDir, featureDir);
  fs.mkdirSync(fdPath, { recursive: true });

  return { number, branch, featureDir };
}

/**
 * Node.js 環境向けインターフェース実装
 *
 * テスト時はモックに置き換え、本番では本クラスを使用する。
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import type { GitOps, FileSystem } from "./interfaces.js";

// --- NodeGitOps ---

export class NodeGitOps implements GitOps {
  hasGitDir(dir: string): boolean {
    return fs.existsSync(path.join(dir, ".git"));
  }

  git(dir: string, args: string[]): string {
    if (!this.hasGitDir(dir)) {
      throw new Error(
        `git skipped: no .git in ${dir}`
      );
    }
    const result = execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
    });
    return result.trim();
  }

  diff(dir: string): string {
    return this.git(dir, ["diff", "--name-only", "HEAD"]);
  }
}

// --- NodeFileSystem ---

export class NodeFileSystem implements FileSystem {
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, "utf8");
  }

  writeFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  }

  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  removeFile(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ファイルが存在しない場合はノーオペレーション
    }
  }

  removeDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }

  readdir(dirPath: string): Array<{ name: string; isFile: boolean; isDirectory: boolean }> {
    try {
      return fs.readdirSync(dirPath, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isFile: e.isFile(),
        isDirectory: e.isDirectory(),
      }));
    } catch {
      return [];
    }
  }

  isDirectory(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isDirectory();
    } catch {
      return false;
    }
  }
}

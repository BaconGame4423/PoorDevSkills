/**
 * installer-e2e.test.ts
 *
 * インストーラーの dist コピー + poor-dev-next CLI 動作の統合テスト。
 * 一時ディレクトリを使って init/update/status の dist 関連動作を検証。
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtemp, rm, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PKG_ROOT = join(import.meta.dirname, "../..");
const BIN_PATH = join(PKG_ROOT, "bin/poor-dev.mjs");
const DIST_BIN = ".poor-dev/dist/bin/poor-dev-next.js";

let tmpDir: string;

beforeAll(async () => {
  // dist が存在することを前提（CI では npm run build 済み）
  await stat(join(PKG_ROOT, "dist/bin/poor-dev-next.js"));
});

describe("installer dist copy (init)", () => {
  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "pd-e2e-init-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    execSync(`node ${BIN_PATH} init ${tmpDir}`, { stdio: "pipe" });
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("poor-dev-next.js が .poor-dev/dist/bin/ にコピーされる", async () => {
    const s = await stat(join(tmpDir, DIST_BIN));
    expect(s.isFile()).toBe(true);
  });

  it("lib/ の .js ファイルがコピーされる", async () => {
    const s = await stat(join(tmpDir, ".poor-dev/dist/lib/team-state-machine.js"));
    expect(s.isFile()).toBe(true);
  });

  it("tests/ ディレクトリはコピーされない", async () => {
    await expect(stat(join(tmpDir, ".poor-dev/dist/tests"))).rejects.toThrow();
  });

  it(".d.ts / .map ファイルはコピーされない", async () => {
    await expect(stat(join(tmpDir, ".poor-dev/dist/bin/poor-dev-next.d.ts"))).rejects.toThrow();
    await expect(stat(join(tmpDir, ".poor-dev/dist/bin/poor-dev-next.js.map"))).rejects.toThrow();
  });

  it(".gitignore に .poor-dev/dist/ が追加される", async () => {
    const content = await readFile(join(tmpDir, ".gitignore"), "utf8");
    expect(content).toContain(".poor-dev/dist/");
  });

  it("poor-dev-next CLI が --init で JSON を返す", () => {
    const stateDir = join(tmpDir, "specs/001");
    execSync(`mkdir -p ${stateDir}`, { stdio: "pipe" });
    const output = execSync(
      `node ${join(tmpDir, DIST_BIN)} --init --flow feature --state-dir ${stateDir} --project-dir ${tmpDir}`,
      { encoding: "utf8" }
    );
    const json = JSON.parse(output.trim());
    expect(json.status).toBe("initialized");
    expect(json.flow).toBe("feature");
    expect(Array.isArray(json.steps)).toBe(true);
  });
});

describe("installer dist copy (update)", () => {
  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "pd-e2e-update-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    // 初回 init
    execSync(`node ${BIN_PATH} init ${tmpDir}`, { stdio: "pipe" });
    // dist の 1 ファイルを削除して update でリカバリされることを検証
    await rm(join(tmpDir, ".poor-dev/dist/lib/team-state-machine.js"));
    // update 実行
    execSync(`node ${BIN_PATH} update ${tmpDir}`, { stdio: "pipe" });
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("update で削除されたファイルが復元される", async () => {
    const s = await stat(join(tmpDir, ".poor-dev/dist/lib/team-state-machine.js"));
    expect(s.isFile()).toBe(true);
  });

  it("poor-dev-next CLI が update 後も動作する", () => {
    const stateDir = join(tmpDir, "specs/002");
    execSync(`mkdir -p ${stateDir}`, { stdio: "pipe" });
    const output = execSync(
      `node ${join(tmpDir, DIST_BIN)} --init --flow bugfix --state-dir ${stateDir} --project-dir ${tmpDir}`,
      { encoding: "utf8" }
    );
    const json = JSON.parse(output.trim());
    expect(json.status).toBe("initialized");
    expect(json.flow).toBe("bugfix");
  });
});

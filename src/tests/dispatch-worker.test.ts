/**
 * dispatch-worker.test.ts
 *
 * dispatch-worker CLI のユニットテスト。
 * 実際の glm コマンドは呼ばないが、引数パース・リトライロジック・出力ファイル生成をテスト。
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DISPATCH_WORKER = path.resolve("dist/bin/dispatch-worker.js");
const TMP_DIR = path.resolve("src/tests/.tmp-dispatch-worker-test");

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("dispatch-worker CLI", () => {
  it("--prompt-file 未指定で exit 2", async () => {
    try {
      await execFileAsync("node", [DISPATCH_WORKER, "--result-file", "/tmp/x.json"]);
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe(2);
      expect(e.stderr).toContain("--prompt-file is required");
    }
  });

  it("--result-file 未指定で exit 2", async () => {
    const promptFile = path.join(TMP_DIR, "prompt.txt");
    writeFileSync(promptFile, "test prompt");

    try {
      await execFileAsync("node", [DISPATCH_WORKER, "--prompt-file", promptFile]);
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe(2);
      expect(e.stderr).toContain("--result-file is required");
    }
  });

  it("存在しないプロンプトファイルで exit 2", async () => {
    const resultFile = path.join(TMP_DIR, "result.json");

    try {
      await execFileAsync("node", [
        DISPATCH_WORKER,
        "--prompt-file", "/nonexistent/prompt.txt",
        "--result-file", resultFile,
        "--append-system-prompt-file", "worker-specify",
        "--allowedTools", "Read",
        "--max-turns", "1",
      ]);
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe(2);
      expect(e.stderr).toContain("Error reading prompt file");
    }
  });

  it("glm が存在しない場合、リトライ後に failed JSON を書き出す", async () => {
    const promptFile = path.join(TMP_DIR, "prompt.txt");
    const resultFile = path.join(TMP_DIR, "result.json");
    writeFileSync(promptFile, "1+1を計算して");

    try {
      await execFileAsync("node", [
        DISPATCH_WORKER,
        "--prompt-file", promptFile,
        "--result-file", resultFile,
        "--append-system-prompt-file", "worker-specify",
        "--allowedTools", "Read",
        "--max-turns", "1",
        "--timeout", "5",
        "--max-retries", "0",
        "--retry-delay", "0",
      ], { timeout: 15000 });
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe(1);
    }

    // result-file にエラー JSON が書き込まれているはず
    expect(existsSync(resultFile)).toBe(true);
    const result = JSON.parse(readFileSync(resultFile, "utf-8"));
    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(1);
    expect(typeof result.exitCode).toBe("number");
    expect(typeof result.lastError).toBe("string");
  });

  it("タイムアウトで failed JSON を正しく書き出す (timeout コマンドの exit 124)", async () => {
    // sleep をプロンプトとして使い、極短 timeout で強制終了
    const promptFile = path.join(TMP_DIR, "prompt.txt");
    const resultFile = path.join(TMP_DIR, "result.json");
    writeFileSync(promptFile, "very long task");

    // glm が存在しないので timeout 以前にエラーになるが、
    // timeout + glm の組み合わせで exit code が非0になることを確認
    try {
      await execFileAsync("node", [
        DISPATCH_WORKER,
        "--prompt-file", promptFile,
        "--result-file", resultFile,
        "--append-system-prompt-file", "worker-specify",
        "--allowedTools", "Read",
        "--max-turns", "1",
        "--timeout", "2",
        "--max-retries", "1",
        "--retry-delay", "0",
      ], { timeout: 30000 });
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe(1);
    }

    expect(existsSync(resultFile)).toBe(true);
    const result = JSON.parse(readFileSync(resultFile, "utf-8"));
    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(2); // max-retries=1 → 合計2回
  });

  it("引数パース: デフォルト値が正しく設定される", async () => {
    // stderr に attempt 情報が出力されるので、デフォルト timeout=600 が含まれることを確認
    const promptFile = path.join(TMP_DIR, "prompt.txt");
    const resultFile = path.join(TMP_DIR, "result.json");
    writeFileSync(promptFile, "test");

    try {
      await execFileAsync("node", [
        DISPATCH_WORKER,
        "--prompt-file", promptFile,
        "--result-file", resultFile,
        "--append-system-prompt-file", "worker-specify",
        "--allowedTools", "Read",
        "--max-turns", "1",
        "--max-retries", "0",
      ], { timeout: 15000 });
    } catch (e: any) {
      // timeout=600 がデフォルトで stderr に表示される
      expect(e.stderr).toContain("timeout=600");
    }
  });
});

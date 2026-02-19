/**
 * extract-output.test.ts
 *
 * extractOutput() の単体テスト。
 * extract-output.ts (extract-output.sh TS 移植) のカバレッジ。
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { extractOutput } from "../lib/extract-output.js";

describe("extractOutput", () => {
  let tmpDir: string;
  let outputFile: string;
  let saveTo: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-extract-test-"));
    outputFile = path.join(tmpDir, "output.txt");
    saveTo = path.join(tmpDir, "spec.md");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- エラーケース ---

  it("output ファイルが存在しない → error", () => {
    const result = extractOutput("/nonexistent/output.txt", saveTo);
    expect(result.status).toBe("error");
    expect(result.error).toContain("not found");
  });

  it("空の output ファイル → error", () => {
    fs.writeFileSync(outputFile, "");
    const result = extractOutput(outputFile, saveTo);
    expect(result.status).toBe("error");
    expect(result.error).toContain("empty");
  });

  // --- plaintext フォーマット ---

  it("plaintext: そのまま saveTo に書き込む", () => {
    const content = "# Specification\n\nThis is the spec.\n";
    fs.writeFileSync(outputFile, content);

    const result = extractOutput(outputFile, saveTo);
    expect(result.status).toBe("ok");
    expect(result.format).toBe("plaintext");
    expect(fs.readFileSync(saveTo, "utf8")).toBe(content);
  });

  it("plaintext: [BRANCH: ...] 行を除去する", () => {
    const content = "[BRANCH: my-feature]\n# Spec content\n";
    fs.writeFileSync(outputFile, content);

    const result = extractOutput(outputFile, saveTo);
    expect(result.status).toBe("ok");
    const saved = fs.readFileSync(saveTo, "utf8");
    expect(saved).not.toContain("[BRANCH:");
    expect(saved).toContain("# Spec content");
  });

  // --- opencode JSON フォーマット ---

  it("opencode JSON: .part.text を抽出する", () => {
    const jsonLine = JSON.stringify({
      type: "text",
      part: { text: "# Hello from opencode" },
    });
    fs.writeFileSync(outputFile, jsonLine + "\n");

    const result = extractOutput(outputFile, saveTo);
    expect(result.status).toBe("ok");
    expect(result.format).toBe("opencode");
    expect(fs.readFileSync(saveTo, "utf8")).toContain("# Hello from opencode");
  });

  it("opencode JSON: 複数の text パートを結合する", () => {
    const lines = [
      JSON.stringify({ type: "text", part: { text: "Part 1" } }),
      JSON.stringify({ type: "other", something: "else" }),
      JSON.stringify({ type: "text", part: { text: "Part 2" } }),
    ].join("\n");
    fs.writeFileSync(outputFile, lines);

    const result = extractOutput(outputFile, saveTo);
    expect(result.status).toBe("ok");
    const saved = fs.readFileSync(saveTo, "utf8");
    expect(saved).toContain("Part 1");
    expect(saved).toContain("Part 2");
  });

  it("opencode JSON: [BRANCH: ...] 行を除去する", () => {
    const jsonLine = JSON.stringify({
      type: "text",
      part: { text: "[BRANCH: my-branch]\n# Content" },
    });
    fs.writeFileSync(outputFile, jsonLine);

    const result = extractOutput(outputFile, saveTo);
    expect(result.status).toBe("ok");
    const saved = fs.readFileSync(saveTo, "utf8");
    expect(saved).not.toContain("[BRANCH:");
    expect(saved).toContain("# Content");
  });

  // --- bytes カウント ---

  it("成功時に bytes を返す", () => {
    const content = "Hello world";
    fs.writeFileSync(outputFile, content);

    const result = extractOutput(outputFile, saveTo);
    expect(result.status).toBe("ok");
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.bytes).toBe(Buffer.byteLength(content, "utf8"));
  });

  // --- saveTo のディレクトリ自動作成 ---

  it("saveTo のディレクトリが存在しない場合に自動作成する", () => {
    const deepSaveTo = path.join(tmpDir, "nested", "dir", "output.md");
    fs.writeFileSync(outputFile, "# Content");

    const result = extractOutput(outputFile, deepSaveTo);
    expect(result.status).toBe("ok");
    expect(fs.existsSync(deepSaveTo)).toBe(true);
  });
});

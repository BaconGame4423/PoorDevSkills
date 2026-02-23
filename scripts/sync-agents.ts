#!/usr/bin/env npx tsx
/**
 * sync-agents.ts
 *
 * Worker エージェントファイルの SYNC:BEGIN/END ブロックを
 * 対応するコマンドファイルの内容で更新する。
 *
 * Usage:
 *   npx tsx scripts/sync-agents.ts           # 全ファイル同期
 *   npx tsx scripts/sync-agents.ts --check   # ドリフト検出（dry-run）
 */

import fs from "node:fs";
import path from "node:path";

const AGENTS_DIR = path.join(import.meta.dirname ?? ".", "..", "agents", "claude");
const COMMANDS_DIR = path.join(import.meta.dirname ?? ".", "..", "commands");

const SYNC_BEGIN_RE = /^<!-- SYNC:(?:BEGIN|INLINED) source=(.+?)(?:\s+date=\S+)? -->/;
const SYNC_END_RE = /^<!-- SYNC:END -->/;

interface SyncResult {
  file: string;
  source: string;
  status: "synced" | "drift" | "source-missing" | "no-sync-block";
}

function processAgentFile(agentFile: string, dryRun: boolean): SyncResult {
  const content = fs.readFileSync(agentFile, "utf8");
  const lines = content.split("\n");
  const result: SyncResult = {
    file: path.relative(process.cwd(), agentFile),
    source: "",
    status: "no-sync-block",
  };

  let syncStart = -1;
  let syncEnd = -1;
  let sourceFile = "";

  for (let i = 0; i < lines.length; i++) {
    const beginMatch = SYNC_BEGIN_RE.exec(lines[i]!);
    if (beginMatch) {
      syncStart = i;
      sourceFile = beginMatch[1]!;
      result.source = sourceFile;
    }
    if (SYNC_END_RE.test(lines[i]!) && syncStart >= 0) {
      syncEnd = i;
      break;
    }
  }

  if (syncStart < 0 || syncEnd < 0) return result;

  // ソースファイル解決
  const sourcePath = path.join(COMMANDS_DIR, path.basename(sourceFile));
  if (!fs.existsSync(sourcePath)) {
    result.status = "source-missing";
    return result;
  }

  // ソースファイル読み込み + フロントマター除去
  let sourceContent = fs.readFileSync(sourcePath, "utf8");
  sourceContent = removeFrontmatter(sourceContent);
  sourceContent = removeUnnecessarySections(sourceContent);

  // 現在の SYNC ブロック内容（BASH_DISPATCH コメント + Dashboard/Commit セクション除外して比較）
  const rawBlock = lines.slice(syncStart + 1, syncEnd)
    .filter((l) => !l.startsWith("<!-- BASH_DISPATCH:"))
    .join("\n").trim();
  const currentBlock = removeUnnecessarySections(rawBlock);
  const newBlock = sourceContent.trim();

  if (currentBlock === newBlock) {
    result.status = "synced";
    return result;
  }

  // BASH_DISPATCH コメントがある = 意図的にエージェント側を最適化済み → drift 扱いしない
  const hasBashDispatch = lines.slice(syncStart, syncEnd + 1).some((l) => l.includes("<!-- BASH_DISPATCH:"));
  if (hasBashDispatch) {
    result.status = "synced";
    return result;
  }

  result.status = "drift";

  if (!dryRun) {
    // SYNC ブロック内容を更新
    const newLines = [
      ...lines.slice(0, syncStart + 1),
      newBlock,
      ...lines.slice(syncEnd),
    ];
    fs.writeFileSync(agentFile, newLines.join("\n"), "utf8");
  }

  return result;
}

function removeFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const endIdx = content.indexOf("---", 3);
  if (endIdx < 0) return content;
  return content.slice(endIdx + 3).trim();
}

function removeUnnecessarySections(content: string): string {
  // Dashboard Update, Commit & Push, Git Operations セクションを除去
  // コマンドファイルは ### (3 hash) を使うため #{2,3} で両方対応
  const headingRe = /^#{2,3} (Dashboard Update|Commit & Push|Git Operations)/;
  const nextHeadingRe = /^#{2,3} /;
  const lines = content.split("\n");
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (headingRe.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && nextHeadingRe.test(line)) {
      skipping = false;
    }
    if (!skipping) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

// --- メイン ---

const dryRun = process.argv.includes("--check");

const agentFiles = fs
  .readdirSync(AGENTS_DIR)
  .filter((f) => f.startsWith("worker-") && f.endsWith(".md"))
  .map((f) => path.join(AGENTS_DIR, f));

let driftCount = 0;
let errorCount = 0;

for (const agentFile of agentFiles) {
  const result = processAgentFile(agentFile, dryRun);

  switch (result.status) {
    case "synced":
      console.log(`  ✓ ${result.file}`);
      break;
    case "drift":
      driftCount++;
      console.log(`  ✗ ${result.file} — ${dryRun ? "DRIFT DETECTED" : "UPDATED"} (source: ${result.source})`);
      break;
    case "source-missing":
      errorCount++;
      console.log(`  ! ${result.file} — source not found: ${result.source}`);
      break;
    case "no-sync-block":
      console.log(`  - ${result.file} — no SYNC block`);
      break;
  }
}

console.log(`\n${agentFiles.length} files checked. ${driftCount} ${dryRun ? "drifted" : "updated"}. ${errorCount} errors.`);

if (dryRun && driftCount > 0) {
  process.exit(1);
}

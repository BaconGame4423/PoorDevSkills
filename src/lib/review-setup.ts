/**
 * review-setup.ts
 *
 * review-setup.sh の TypeScript 移植。
 * レビューセッション初期化（ペルソナ解決・深度計算・ログ初期化）。
 *
 * 主な変更点:
 * - bash サブプロセス → 型付き関数呼び出し
 * - jq JSON 処理 → TypeScript オブジェクト操作
 * - config-resolver.sh → resolveCliModel() 関数（インライン化）
 *
 * review-runner.sh §4 setup フロー参照。
 */

import path from "node:path";
import fs from "node:fs";

import type { GitOps, FileSystem } from "./interfaces.js";
import type { PoorDevConfig } from "./types.js";

// --- 型定義 ---

export interface PersonaConfig {
  name: string;
  cli: string;
  model: string;
  agentName: string;
}

export interface ReviewSetupResult {
  depth: string;
  maxIterations: number;
  nextId: number;
  logPath: string;
  idPrefix: string;
  reviewType: string;
  personas: PersonaConfig[];
  fixer: { cli: string; model: string; agentName: string };
}

// --- ペルソナ定義 ---

export const PERSONA_MAP: Record<string, string[]> = {
  planreview: [
    "planreview-pm",
    "planreview-critical",
    "planreview-risk",
    "planreview-value",
  ],
  tasksreview: [
    "tasksreview-junior",
    "tasksreview-senior",
    "tasksreview-techlead",
    "tasksreview-devops",
  ],
  architecturereview: [
    "architecturereview-architect",
    "architecturereview-performance",
    "architecturereview-security",
    "architecturereview-sre",
  ],
  qualityreview: [
    "qualityreview-code",
    "qualityreview-qa",
    "qualityreview-security",
    "qualityreview-testdesign",
  ],
  phasereview: [
    "phasereview-qa",
    "phasereview-ux",
    "phasereview-regression",
    "phasereview-docs",
  ],
};

const ID_PREFIX_MAP: Record<string, string> = {
  planreview: "PR",
  tasksreview: "TR",
  architecturereview: "AR",
  qualityreview: "QR",
  phasereview: "PH",
};

/**
 * レビュータイプ → ペルソナ名配列。
 * review-setup.sh の get_personas() に対応。
 */
export function getPersonas(reviewType: string): string[] {
  return PERSONA_MAP[reviewType] ?? [];
}

/**
 * レビュータイプ → ID プレフィックス。
 * review-setup.sh L152-159 に対応。
 */
export function getIdPrefix(reviewType: string): string {
  return ID_PREFIX_MAP[reviewType] ?? "RV";
}

// --- config 解決 ---

/**
 * config-resolver.sh の 5段階解決チェーンを TS で実装。
 * config-resolver.sh L38-63 に対応。
 *
 * 解決順序（最初にマッチしたものが優先）:
 *   1. overrides.<step>
 *   2. overrides.<category> (step のハイフン末尾を除去)
 *   3. step_tiers.<step> → tiers[tier_name]
 *   4. default
 *   5. ハードコード: { cli: "claude", model: "sonnet" }
 */
export function resolveCliModel(
  step: string,
  config: PoorDevConfig | null
): { cli: string; model: string } {
  const hardcoded = { cli: "claude", model: "sonnet" };
  if (!config) return hardcoded;

  const cfg = config as unknown as Record<string, unknown>;

  // カテゴリ = step のハイフン末尾を除去
  const lastHyphen = step.lastIndexOf("-");
  const category = lastHyphen > 0 ? step.slice(0, lastHyphen) : step;

  const overrides = cfg["overrides"] as Record<string, { cli?: string; model?: string }> | undefined;
  const stepTiers = cfg["step_tiers"] as Record<string, string> | undefined;
  const tiers = cfg["tiers"] as Record<string, { cli?: string; model?: string }> | undefined;
  const defaultCfg = cfg["default"] as { cli?: string; model?: string } | undefined;

  // Level 1: overrides.<step>
  const overrideStep = overrides?.[step];
  if (overrideStep?.cli) {
    return { cli: overrideStep.cli, model: overrideStep.model ?? hardcoded.model };
  }

  // Level 2: overrides.<category>
  const overrideCat = overrides?.[category];
  if (overrideCat?.cli) {
    return { cli: overrideCat.cli, model: overrideCat.model ?? hardcoded.model };
  }

  // Level 3: step_tiers.<step> → tiers[tier]
  const tier = stepTiers?.[step];
  if (tier !== undefined) {
    const tierCfg = tiers?.[tier];
    if (tierCfg?.cli) {
      return { cli: tierCfg.cli, model: tierCfg.model ?? hardcoded.model };
    }
    // tier が未定義 → default に fallback
    if (defaultCfg?.cli) {
      return { cli: defaultCfg.cli, model: defaultCfg.model ?? hardcoded.model };
    }
    return hardcoded;
  }

  // Level 4: default
  if (defaultCfg?.cli) {
    return { cli: defaultCfg.cli, model: defaultCfg.model ?? hardcoded.model };
  }

  // Level 5: hardcoded
  return hardcoded;
}

// --- 深度計算 ---

const IMPL_EXTENSIONS_RE = /\.(html|js|ts|css|py)$/;

/**
 * 実装ファイルの行数とファイル数をカウントする（ディレクトリターゲット用）。
 */
function countImplFilesStats(targetDir: string): { lines: number; fileCount: number } {
  let lines = 0;
  let fileCount = 0;

  function walk(d: string, depth: number): void {
    if (depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "_runs") continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && IMPL_EXTENSIONS_RE.test(entry.name)) {
        fileCount++;
        try {
          const content = fs.readFileSync(full, "utf8");
          lines += content.split("\n").length;
        } catch { /* no-op */ }
      }
    }
  }

  walk(targetDir, 1);
  return { lines, fileCount };
}

/**
 * git diff --stat HEAD からファイル数・変更行数を解析する。
 */
function parseDiffStats(diffStatOutput: string): { filesChanged: number; totalChanges: number } {
  if (!diffStatOutput.trim()) return { filesChanged: 0, totalChanges: 0 };
  const lastLine = diffStatOutput.trim().split("\n").pop() ?? "";
  const filesMatch = lastLine.match(/(\d+)\s+file/);
  const insertMatch = lastLine.match(/(\d+)\s+insertion/);
  const deleteMatch = lastLine.match(/(\d+)\s+deletion/);
  const filesChanged = filesMatch ? parseInt(filesMatch[1]!, 10) : 0;
  const insertions = insertMatch ? parseInt(insertMatch[1]!, 10) : 0;
  const deletions = deleteMatch ? parseInt(deleteMatch[1]!, 10) : 0;
  return { filesChanged, totalChanges: insertions + deletions };
}

/**
 * レビュー深度を計算する。
 * review-setup.sh L100-138 に対応。
 *
 * deep: totalChanges > 500 または filesChanged > 20 → maxIterations=5
 * light: totalChanges < 50 かつ filesChanged < 5 → maxIterations=2
 * standard: それ以外 → maxIterations=3
 *
 * config.review_depth が "auto" 以外の場合は設定値を優先。
 */
export function calculateReviewDepth(
  targetFile: string,
  projectDir: string,
  gitOps: GitOps | null,
  config: PoorDevConfig | null
): { depth: string; maxIterations: number } {
  let totalChanges = 0;
  let filesChanged = 0;

  const isDir = fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory();
  if (isDir) {
    const stats = countImplFilesStats(targetFile);
    totalChanges = stats.lines;
    filesChanged = stats.fileCount;
  } else if (gitOps?.hasGitDir(projectDir)) {
    try {
      const diffStat = gitOps.git(projectDir, ["diff", "--stat", "HEAD"]);
      const parsed = parseDiffStats(diffStat);
      totalChanges = parsed.totalChanges;
      filesChanged = parsed.filesChanged;
    } catch { /* no-op */ }
  }

  let depth = "standard";
  let maxIterations = 3;

  if (totalChanges > 500 || filesChanged > 20) {
    depth = "deep";
    maxIterations = 5;
  } else if (totalChanges < 50 && filesChanged < 5) {
    depth = "light";
    maxIterations = 2;
  }

  // config 設定値で上書き（auto 以外の場合）
  const configDepth = config?.review_depth ?? "auto";
  if (configDepth !== "auto") {
    depth = configDepth;
    switch (depth) {
      case "deep":
        maxIterations = 5;
        break;
      case "standard":
        maxIterations = 3;
        break;
      case "light":
        maxIterations = 2;
        break;
    }
  }

  return { depth, maxIterations };
}

// --- review-log.yaml 管理 ---

/**
 * review-log.yaml から次の issue ID を計算する。
 * review-setup.sh L145-149 に対応。
 */
export function getNextId(logPath: string, fileSystem: Pick<FileSystem, "exists" | "readFile">): number {
  if (!fileSystem.exists(logPath)) return 1;
  try {
    const content = fileSystem.readFile(logPath);
    // "ID_PREFIX + 3桁数字" パターンをすべて抽出して最大値を取得
    const matches = content.match(/[A-Z]{2}\d+/g);
    if (!matches || matches.length === 0) return 1;
    const nums = matches.map((m) => parseInt(m.replace(/[A-Z]/g, ""), 10)).filter(Number.isFinite);
    if (nums.length === 0) return 1;
    return Math.max(...nums) + 1;
  } catch {
    return 1;
  }
}

// --- メイン関数 ---

export interface ReviewSetupOptions {
  reviewType: string;
  targetFile: string;
  featureDir: string;
  projectDir: string;
  gitOps?: GitOps | null;
  fileSystem: FileSystem;
  config: PoorDevConfig | null;
}

/**
 * レビューセッションを初期化し、ReviewSetupResult を返す。
 * review-setup.sh のメインロジック全体に対応。
 */
export function setupReview(opts: ReviewSetupOptions): ReviewSetupResult {
  const { reviewType, targetFile, featureDir, projectDir, gitOps, fileSystem, config } = opts;
  const fd = path.join(projectDir, featureDir);

  // ペルソナ解決
  const personaNames = getPersonas(reviewType);
  if (personaNames.length === 0) {
    throw new Error(`Unknown review type: ${reviewType}`);
  }

  const personas: PersonaConfig[] = personaNames.map((name) => {
    const { cli, model } = resolveCliModel(name, config);
    return { name, cli, model, agentName: name };
  });

  const fixerCliModel = resolveCliModel("fixer", config);
  const fixer = {
    cli: fixerCliModel.cli,
    model: fixerCliModel.model,
    agentName: "review-fixer",
  };

  // 深度計算
  const { depth, maxIterations } = calculateReviewDepth(
    targetFile,
    projectDir,
    gitOps ?? null,
    config
  );

  // review-log.yaml 管理
  const logPath = path.join(fd, `review-log-${reviewType}.yaml`);
  const nextId = getNextId(logPath, fileSystem);
  const idPrefix = getIdPrefix(reviewType);

  return {
    depth,
    maxIterations,
    nextId,
    logPath,
    idPrefix,
    reviewType,
    personas,
    fixer,
  };
}

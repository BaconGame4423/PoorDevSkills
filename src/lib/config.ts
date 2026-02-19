/**
 * config.ts
 *
 * config.sh の TypeScript 移植。
 * .poor-dev/config.json 管理 CLI。
 *
 * サブコマンド:
 *   show                                    — 設定テーブル表示
 *   default <cli> <model>                   — デフォルト cli/model 設定
 *   set <key> <cli> <model>                 — オーバーライド設定
 *   unset <key>                             — オーバーライド削除
 *   tier <name> <cli> <model>               — tier 定義設定
 *   tier-unset <name>                       — tier 削除
 *   step-tier <step> <tier>                 — ステップへの tier 割り当て
 *   step-tier-unset <step>                  — ステップ tier 割り当て削除
 *   depth <auto|deep|standard|light>        — レビュー深度設定
 *   speculation <on|off>                    — speculation 切り替え
 *   parallel <on|off|auto|same-branch|worktree|phase-split> — 並列戦略設定
 *   reset                                   — デフォルトにリセット
 *
 * config.sh 全体参照。
 */

import path from "node:path";
import fs from "node:fs";

// --- 型定義 ---

export interface ConfigEntry {
  cli: string;
  model: string;
}

export interface SpeculationConfig {
  enabled: boolean;
  pairs?: Record<string, string>;
}

export interface ParallelConfig {
  enabled: boolean;
  strategy?: string;
  max_concurrent?: number;
}

/** .poor-dev/config.json のスキーマ */
export interface PoorDevConfigFile {
  default: ConfigEntry;
  overrides?: Record<string, ConfigEntry>;
  tiers?: Record<string, ConfigEntry>;
  step_tiers?: Record<string, string>;
  review_depth?: string;
  speculation?: SpeculationConfig;
  parallel?: ParallelConfig;
}

export interface ResolveResult {
  cli: string;
  model: string;
  source: string;
}

export interface ConfigCmdResult {
  output: string;
  exitCode: number;
}

// --- 定数 ---

const VALID_CATEGORIES = [
  "planreview", "tasksreview", "architecturereview",
  "qualityreview", "phasereview", "fixer",
];

const VALID_AGENTS = [
  "planreview-pm", "planreview-risk", "planreview-value", "planreview-critical",
  "tasksreview-techlead", "tasksreview-senior", "tasksreview-devops", "tasksreview-junior",
  "architecturereview-architect", "architecturereview-security",
  "architecturereview-performance", "architecturereview-sre",
  "qualityreview-qa", "qualityreview-testdesign", "qualityreview-code", "qualityreview-security",
  "phasereview-qa", "phasereview-regression", "phasereview-docs", "phasereview-ux",
  "review-fixer",
];

const VALID_STEPS = [
  "specify", "suggest", "plan", "planreview", "tasks", "tasksreview",
  "implement", "architecturereview", "qualityreview", "phasereview",
];

const VALID_CLIS = ["claude", "opencode"];
const VALID_CLAUDE_MODELS = ["haiku", "sonnet", "opus"];
const VALID_DEPTHS = ["auto", "deep", "standard", "light"];

const DEFAULT_CONFIG: PoorDevConfigFile = {
  default: { cli: "opencode", model: "zai-coding-plan/glm-4.7" },
  overrides: {
    fixer: { cli: "claude", model: "sonnet" },
    phasereview: { cli: "claude", model: "haiku" },
  },
  tiers: {
    T1: { cli: "claude", model: "sonnet" },
    T2: { cli: "opencode", model: "minimax-m2.5" },
    T3: { cli: "opencode", model: "minimax-m2.5-lightning" },
  },
  step_tiers: {
    specify: "T2", suggest: "T3", plan: "T1",
    planreview: "T2", tasks: "T2", tasksreview: "T2",
    implement: "T2", architecturereview: "T2",
    qualityreview: "T2", phasereview: "T2",
  },
  review_depth: "auto",
  speculation: { enabled: true, pairs: { specify: "suggest" } },
  parallel: { enabled: true, strategy: "auto", max_concurrent: 3 },
};

// --- ファイル I/O ---

function getConfigPath(projectDir: string): { dir: string; file: string } {
  const dir = path.join(projectDir, ".poor-dev");
  const file = path.join(dir, "config.json");
  return { dir, file };
}

/**
 * .poor-dev/config.json を読み込む。存在しなければデフォルトを書き込んで返す。
 * config.sh read_config() に対応。
 */
export function readConfigFile(projectDir: string): PoorDevConfigFile {
  const { dir, file } = getConfigPath(projectDir);
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      return JSON.parse(raw) as PoorDevConfigFile;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  // 初回: デフォルトを書き込む
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8");
  return { ...DEFAULT_CONFIG };
}

/**
 * .poor-dev/config.json に書き込む。
 * config.sh write_config() に対応。
 */
export function writeConfigFile(projectDir: string, cfg: PoorDevConfigFile): void {
  const { dir, file } = getConfigPath(projectDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2), "utf8");
}

// --- バリデーション ---

function validateCli(cli: string): string | null {
  if (!VALID_CLIS.includes(cli)) {
    return `Invalid CLI '${cli}'. Valid: ${VALID_CLIS.join(", ")}`;
  }
  return null;
}

function validateModel(cli: string, model: string): string | null {
  if (cli === "claude" && !VALID_CLAUDE_MODELS.includes(model)) {
    return `Invalid Claude model '${model}'. Valid: ${VALID_CLAUDE_MODELS.join(", ")}`;
  }
  // opencode: any model accepted (dynamic)
  return null;
}

function validateKey(key: string): string | null {
  if (![...VALID_CATEGORIES, ...VALID_AGENTS].includes(key)) {
    return (
      `Invalid key '${key}'.\n` +
      `Valid categories: ${VALID_CATEGORIES.join(", ")}\n` +
      `Valid agents: ${VALID_AGENTS.join(", ")}`
    );
  }
  return null;
}

function validateStep(step: string): string | null {
  if (!VALID_STEPS.includes(step)) {
    return `Invalid step '${step}'. Valid: ${VALID_STEPS.join(", ")}`;
  }
  return null;
}

// --- resolve_one ---

/**
 * ステップ/キーを実効 cli/model + source に解決する。
 * config.sh resolve_one() に対応。
 */
export function resolveOne(cfg: PoorDevConfigFile, key: string): ResolveResult {
  const overrides = cfg.overrides ?? {};
  const tiers = cfg.tiers ?? {};
  const stepTiers = cfg.step_tiers ?? {};

  // カテゴリ（ハイフン前の部分）
  const cat = key.split("-")[0] ?? key;

  if (overrides[key]) {
    return { cli: overrides[key]!.cli, model: overrides[key]!.model, source: "override" };
  }
  if (overrides[cat] && cat !== key) {
    return { cli: overrides[cat]!.cli, model: overrides[cat]!.model, source: `override(${cat})` };
  }
  if (stepTiers[key]) {
    const tierName = stepTiers[key]!;
    if (tiers[tierName]) {
      return {
        cli: tiers[tierName]!.cli,
        model: tiers[tierName]!.model,
        source: `step_tier(${tierName})`,
      };
    }
    return {
      cli: cfg.default.cli,
      model: cfg.default.model,
      source: `default(tier ${tierName} undefined)`,
    };
  }
  return { cli: cfg.default.cli, model: cfg.default.model, source: "default" };
}

// --- サブコマンド ---

function cmdShow(projectDir: string): ConfigCmdResult {
  const cfg = readConfigFile(projectDir);
  const lines: string[] = [];

  // デフォルト
  lines.push(`Default: ${cfg.default.cli} / ${cfg.default.model}`);
  lines.push("");

  // Tiers
  lines.push("Tiers:");
  const tiers = cfg.tiers ?? {};
  for (const [name, entry] of Object.entries(tiers)) {
    lines.push(`  ${name}: ${entry.cli} / ${entry.model}`);
  }
  lines.push("");

  // ステップテーブル
  const stepTiers = cfg.step_tiers ?? {};
  const header = [
    "Step".padEnd(20),
    "Tier".padEnd(6),
    "CLI".padEnd(10),
    "Model".padEnd(30),
    "Source",
  ].join(" ");
  lines.push(header);
  lines.push("-".repeat(80));

  for (const step of VALID_STEPS) {
    const tier = stepTiers[step] ?? "—";
    const resolved = resolveOne(cfg, step);
    lines.push(
      [
        step.padEnd(20),
        tier.padEnd(6),
        resolved.cli.padEnd(10),
        resolved.model.padEnd(30),
        `(${resolved.source})`,
      ].join(" ")
    );
  }

  // 非ステップオーバーライド
  const overrides = cfg.overrides ?? {};
  const nonStepOverrides = Object.entries(overrides).filter(
    ([k]) => !VALID_STEPS.includes(k)
  );
  if (nonStepOverrides.length > 0) {
    lines.push("");
    lines.push("Overrides (non-step):");
    for (const [k, entry] of nonStepOverrides) {
      lines.push(`  ${k}: ${entry.cli} / ${entry.model}`);
    }
  }

  lines.push("");

  // レビュー深度
  lines.push(`Review depth: ${cfg.review_depth ?? "auto"}`);

  // Speculation
  const spec = cfg.speculation;
  if (spec?.enabled) {
    const pairs = Object.entries(spec.pairs ?? {})
      .map(([k, v]) => `${k} → ${v}`)
      .join(", ");
    lines.push(`Speculation: enabled (${pairs})`);
  } else {
    lines.push("Speculation: disabled");
  }

  // Parallel
  const par = cfg.parallel;
  if (par?.enabled) {
    lines.push(
      `Parallel: enabled (strategy: ${par.strategy ?? "auto"}, max: ${par.max_concurrent ?? 3})`
    );
  } else {
    lines.push("Parallel: disabled");
  }

  lines.push("");
  lines.push(`Available models (Claude Code): ${VALID_CLAUDE_MODELS.join(", ")}`);

  return { output: lines.join("\n"), exitCode: 0 };
}

function cmdDefault(projectDir: string, args: string[]): ConfigCmdResult {
  const [cli, model] = args;
  if (!cli || !model) {
    return { output: "Usage: config default <cli> <model>", exitCode: 1 };
  }
  const cliErr = validateCli(cli);
  if (cliErr) return { output: cliErr, exitCode: 1 };
  const modelErr = validateModel(cli, model);
  if (modelErr) return { output: modelErr, exitCode: 1 };

  const cfg = readConfigFile(projectDir);
  cfg.default = { cli, model };
  writeConfigFile(projectDir, cfg);
  return { output: `Default set: ${cli} / ${model}`, exitCode: 0 };
}

function cmdSet(projectDir: string, args: string[]): ConfigCmdResult {
  const [key, cli, model] = args;
  if (!key || !cli || !model) {
    return { output: "Usage: config set <key> <cli> <model>", exitCode: 1 };
  }
  const keyErr = validateKey(key);
  if (keyErr) return { output: keyErr, exitCode: 1 };
  const cliErr = validateCli(cli);
  if (cliErr) return { output: cliErr, exitCode: 1 };
  const modelErr = validateModel(cli, model);
  if (modelErr) return { output: modelErr, exitCode: 1 };

  const cfg = readConfigFile(projectDir);
  cfg.overrides = cfg.overrides ?? {};
  cfg.overrides[key] = { cli, model };
  writeConfigFile(projectDir, cfg);
  return { output: `Override set: ${key} → ${cli} / ${model}`, exitCode: 0 };
}

function cmdUnset(projectDir: string, args: string[]): ConfigCmdResult {
  const [key] = args;
  if (!key) {
    return { output: "Usage: config unset <key>", exitCode: 1 };
  }
  const cfg = readConfigFile(projectDir);
  const overrides = cfg.overrides ?? {};
  if (!overrides[key]) {
    return { output: `Override '${key}' not found.`, exitCode: 1 };
  }
  delete overrides[key];
  cfg.overrides = overrides;
  writeConfigFile(projectDir, cfg);

  const resolved = resolveOne(cfg, key);
  return {
    output: `Override removed: ${key} (now resolves to: ${resolved.cli} / ${resolved.model} via ${resolved.source})`,
    exitCode: 0,
  };
}

function cmdTier(projectDir: string, args: string[]): ConfigCmdResult {
  const [name, cli, model] = args;
  if (!name || !cli || !model) {
    return { output: "Usage: config tier <name> <cli> <model>", exitCode: 1 };
  }
  const cliErr = validateCli(cli);
  if (cliErr) return { output: cliErr, exitCode: 1 };
  const modelErr = validateModel(cli, model);
  if (modelErr) return { output: modelErr, exitCode: 1 };

  const cfg = readConfigFile(projectDir);
  cfg.tiers = cfg.tiers ?? {};
  cfg.tiers[name] = { cli, model };
  writeConfigFile(projectDir, cfg);

  // この tier を使用するステップを表示
  const stepTiers = cfg.step_tiers ?? {};
  const stepsUsing = Object.entries(stepTiers)
    .filter(([, t]) => t === name)
    .map(([s]) => s)
    .join(", ");
  const output = [`Tier set: ${name} → ${cli} / ${model}`];
  if (stepsUsing) output.push(`Steps using ${name}: ${stepsUsing}`);
  return { output: output.join("\n"), exitCode: 0 };
}

function cmdTierUnset(projectDir: string, args: string[]): ConfigCmdResult {
  const [name] = args;
  if (!name) {
    return { output: "Usage: config tier-unset <name>", exitCode: 1 };
  }
  const cfg = readConfigFile(projectDir);
  const tiers = cfg.tiers ?? {};
  if (!tiers[name]) {
    return { output: `Tier '${name}' not found.`, exitCode: 1 };
  }

  // 参照ステップを警告
  const stepTiers = cfg.step_tiers ?? {};
  const refs = Object.entries(stepTiers)
    .filter(([, t]) => t === name)
    .map(([s]) => s)
    .join(", ");

  delete tiers[name];
  cfg.tiers = tiers;
  writeConfigFile(projectDir, cfg);

  const output = [`Tier removed: ${name}`];
  if (refs) output.push(`Warning: These steps still reference tier '${name}': ${refs}`);
  return { output: output.join("\n"), exitCode: 0 };
}

function cmdStepTier(projectDir: string, args: string[]): ConfigCmdResult {
  const [step, tier] = args;
  if (!step || !tier) {
    return { output: "Usage: config step-tier <step> <tier>", exitCode: 1 };
  }
  const stepErr = validateStep(step);
  if (stepErr) return { output: stepErr, exitCode: 1 };

  const cfg = readConfigFile(projectDir);
  const tiers = cfg.tiers ?? {};
  if (!tiers[tier]) {
    const available = Object.keys(tiers).join(", ");
    return {
      output: `Tier '${tier}' not found. Available: ${available}`,
      exitCode: 1,
    };
  }

  cfg.step_tiers = cfg.step_tiers ?? {};
  cfg.step_tiers[step] = tier;
  writeConfigFile(projectDir, cfg);

  const resolved = resolveOne(cfg, step);
  return {
    output: `Step tier set: ${step} → ${tier} (${resolved.cli} / ${resolved.model})`,
    exitCode: 0,
  };
}

function cmdStepTierUnset(projectDir: string, args: string[]): ConfigCmdResult {
  const [step] = args;
  if (!step) {
    return { output: "Usage: config step-tier-unset <step>", exitCode: 1 };
  }
  const stepErr = validateStep(step);
  if (stepErr) return { output: stepErr, exitCode: 1 };

  const cfg = readConfigFile(projectDir);
  const stepTiers = cfg.step_tiers ?? {};
  if (!stepTiers[step]) {
    return { output: `Step tier for '${step}' not found.`, exitCode: 1 };
  }

  delete stepTiers[step];
  cfg.step_tiers = stepTiers;
  writeConfigFile(projectDir, cfg);

  const resolved = resolveOne(cfg, step);
  return {
    output: `Step tier removed: ${step} (now resolves to: ${resolved.cli} / ${resolved.model} via ${resolved.source})`,
    exitCode: 0,
  };
}

function cmdDepth(projectDir: string, args: string[]): ConfigCmdResult {
  const [value] = args;
  if (!value) {
    return { output: "Usage: config depth <auto|deep|standard|light>", exitCode: 1 };
  }
  if (!VALID_DEPTHS.includes(value)) {
    return { output: `Invalid depth '${value}'. Valid: ${VALID_DEPTHS.join(", ")}`, exitCode: 1 };
  }
  const cfg = readConfigFile(projectDir);
  cfg.review_depth = value;
  writeConfigFile(projectDir, cfg);
  return { output: `Review depth set: ${value}`, exitCode: 0 };
}

function cmdSpeculation(projectDir: string, args: string[]): ConfigCmdResult {
  const [value] = args;
  if (!value) {
    return { output: "Usage: config speculation <on|off>", exitCode: 1 };
  }
  let enabled: boolean;
  if (value === "on") {
    enabled = true;
  } else if (value === "off") {
    enabled = false;
  } else {
    return { output: `Invalid value '${value}'. Use 'on' or 'off'.`, exitCode: 1 };
  }

  const cfg = readConfigFile(projectDir);
  cfg.speculation = cfg.speculation ?? { enabled: false };
  cfg.speculation.enabled = enabled;
  writeConfigFile(projectDir, cfg);

  if (enabled) {
    const pairs = Object.entries(cfg.speculation.pairs ?? {})
      .map(([k, v]) => `${k} → ${v}`)
      .join(", ");
    return { output: `Speculation: enabled (${pairs})`, exitCode: 0 };
  }
  return { output: "Speculation: disabled", exitCode: 0 };
}

function cmdParallel(projectDir: string, args: string[]): ConfigCmdResult {
  const [value] = args;
  if (!value) {
    return {
      output: "Usage: config parallel <on|off|auto|same-branch|worktree|phase-split>",
      exitCode: 1,
    };
  }

  const cfg = readConfigFile(projectDir);
  cfg.parallel = cfg.parallel ?? { enabled: false };

  switch (value) {
    case "on":
      cfg.parallel.enabled = true;
      cfg.parallel.strategy = "auto";
      break;
    case "off":
      cfg.parallel.enabled = false;
      break;
    case "auto":
    case "same-branch":
    case "worktree":
    case "phase-split":
      cfg.parallel.enabled = true;
      cfg.parallel.strategy = value;
      break;
    default:
      return {
        output: `Invalid value '${value}'. Valid: on, off, auto, same-branch, worktree, phase-split`,
        exitCode: 1,
      };
  }

  writeConfigFile(projectDir, cfg);

  if (cfg.parallel.enabled) {
    return {
      output: `Parallel: enabled (strategy: ${cfg.parallel.strategy ?? "auto"})`,
      exitCode: 0,
    };
  }
  return { output: "Parallel: disabled", exitCode: 0 };
}

function cmdReset(projectDir: string): ConfigCmdResult {
  writeConfigFile(projectDir, { ...DEFAULT_CONFIG });
  return { output: "Config reset to defaults.", exitCode: 0 };
}

function cmdHelp(): ConfigCmdResult {
  const help = [
    "Usage: config <subcommand> [args...]",
    "",
    "Subcommands:",
    "  show                                     Display current configuration",
    "  default <cli> <model>                    Set default CLI/model",
    "  set <key> <cli> <model>                  Set override for category/agent",
    "  unset <key>                              Remove override",
    "  tier <name> <cli> <model>                Define a tier",
    "  tier-unset <name>                        Remove a tier",
    "  step-tier <step> <tier>                  Assign tier to step",
    "  step-tier-unset <step>                   Remove step tier assignment",
    "  depth <auto|deep|standard|light>         Set review depth",
    "  speculation <on|off>                     Toggle speculation",
    "  parallel <on|off|auto|same-branch|...>   Set parallel strategy",
    "  reset                                    Reset to default config",
  ].join("\n");
  return { output: help, exitCode: 0 };
}

// --- メイン関数 ---

/**
 * config サブコマンドをディスパッチする。
 * config.sh main に対応。
 */
export function configCmd(projectDir: string, args: string[]): ConfigCmdResult {
  const [subcmd = "show", ...rest] = args;

  switch (subcmd) {
    case "show":          return cmdShow(projectDir);
    case "default":       return cmdDefault(projectDir, rest);
    case "set":           return cmdSet(projectDir, rest);
    case "unset":         return cmdUnset(projectDir, rest);
    case "tier":          return cmdTier(projectDir, rest);
    case "tier-unset":    return cmdTierUnset(projectDir, rest);
    case "step-tier":     return cmdStepTier(projectDir, rest);
    case "step-tier-unset": return cmdStepTierUnset(projectDir, rest);
    case "depth":         return cmdDepth(projectDir, rest);
    case "speculation":   return cmdSpeculation(projectDir, rest);
    case "parallel":      return cmdParallel(projectDir, rest);
    case "reset":         return cmdReset(projectDir);
    case "help":
    case "--help":
    case "-h":            return cmdHelp();
    default:
      return {
        output: `Unknown subcommand: ${subcmd}\n\n${cmdHelp().output}`,
        exitCode: 1,
      };
  }
}

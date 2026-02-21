/**
 * config-resolver.ts
 *
 * config-resolver.sh の TypeScript 移植。
 * 5段階 CLI/model 解決チェーン。
 */

import type { PoorDevConfig } from "./types.js";

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

/**
 * flow-loader.ts
 *
 * .poor-dev/flows.json からカスタムフロー定義を読み込み、
 * バリデーション + ビルトインフローとのマージを行う。
 */

import path from "node:path";

import type { FlowDefinition } from "./flow-types.js";
import { BUILTIN_FLOWS } from "./flow-definitions.js";
import type { FileSystem } from "./interfaces.js";

// --- バリデーション ---

/** FlowDefinition の最小バリデーション。steps が非空配列であること。 */
export function validateFlowDefinition(
  name: string,
  def: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof def !== "object" || def === null) {
    errors.push(`Flow "${name}": definition must be an object`);
    return { valid: false, errors };
  }

  const obj = def as Record<string, unknown>;

  // steps: 必須、非空文字列配列
  if (!Array.isArray(obj["steps"])) {
    errors.push(`Flow "${name}": "steps" must be an array`);
  } else if (obj["steps"].length === 0) {
    errors.push(`Flow "${name}": "steps" must not be empty`);
  } else {
    for (let i = 0; i < obj["steps"].length; i++) {
      if (typeof obj["steps"][i] !== "string") {
        errors.push(`Flow "${name}": steps[${i}] must be a string`);
      }
    }
  }

  // reviews: 任意、文字列配列
  if (obj["reviews"] !== undefined && obj["reviews"] !== null) {
    if (!Array.isArray(obj["reviews"])) {
      errors.push(`Flow "${name}": "reviews" must be an array`);
    }
  }

  // conditionals: 任意、文字列配列
  if (obj["conditionals"] !== undefined && obj["conditionals"] !== null) {
    if (!Array.isArray(obj["conditionals"])) {
      errors.push(`Flow "${name}": "conditionals" must be an array`);
    }
  }

  // context: 任意、Record<string, Record<string, string>>
  if (obj["context"] !== undefined && obj["context"] !== null) {
    if (typeof obj["context"] !== "object") {
      errors.push(`Flow "${name}": "context" must be an object`);
    }
  }

  // prerequisites: 任意、Record<string, string[]>
  if (obj["prerequisites"] !== undefined && obj["prerequisites"] !== null) {
    if (typeof obj["prerequisites"] !== "object") {
      errors.push(`Flow "${name}": "prerequisites" must be an object`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// --- ローダー ---

/**
 * .poor-dev/flows.json を読み込み、バリデーション後に返す。
 * ファイルが存在しない場合は空オブジェクトを返す。
 */
export function loadCustomFlows(
  projectDir: string,
  fileSystem: Pick<FileSystem, "exists" | "readFile">
): { flows: Record<string, FlowDefinition>; errors: string[] } {
  const flowsFile = path.join(projectDir, ".poor-dev", "flows.json");

  if (!fileSystem.exists(flowsFile)) {
    return { flows: {}, errors: [] };
  }

  let raw: unknown;
  try {
    const content = fileSystem.readFile(flowsFile);
    raw = JSON.parse(content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { flows: {}, errors: [`Failed to parse .poor-dev/flows.json: ${msg}`] };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { flows: {}, errors: [".poor-dev/flows.json must be a JSON object"] };
  }

  const allErrors: string[] = [];
  const flows: Record<string, FlowDefinition> = {};

  for (const [name, def] of Object.entries(raw as Record<string, unknown>)) {
    const { valid, errors } = validateFlowDefinition(name, def);
    if (valid) {
      flows[name] = def as FlowDefinition;
    } else {
      allErrors.push(...errors);
    }
  }

  return { flows, errors: allErrors };
}

/**
 * ビルトイン + カスタムフローをマージして返す。
 * カスタムフローがビルトインと同名の場合はカスタムが優先。
 */
export function mergeFlows(
  projectDir: string,
  fileSystem: Pick<FileSystem, "exists" | "readFile">
): { flows: Record<string, FlowDefinition>; errors: string[] } {
  const { flows: custom, errors } = loadCustomFlows(projectDir, fileSystem);

  const merged: Record<string, FlowDefinition> = { ...BUILTIN_FLOWS, ...custom };

  return { flows: merged, errors };
}

/**
 * フロー名からフロー定義を解決する。
 * ビルトイン → カスタム の順で検索。カスタム優先。
 */
export function resolveFlow(
  flowName: string,
  projectDir: string,
  fileSystem: Pick<FileSystem, "exists" | "readFile">
): FlowDefinition | null {
  const { flows } = mergeFlows(projectDir, fileSystem);
  return flows[flowName] ?? null;
}

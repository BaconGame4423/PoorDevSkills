/**
 * token-report.ts
 *
 * Bash dispatch の glm -p 結果 JSON + Orchestrator JSONL を集約して
 * .bench-token-usage.json を生成する。
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

// --- 型 ---

interface GlmResult {
  type: string;
  subtype: string;
  duration_ms: number;
  num_turns: number;
  session_id: string;
  total_cost_usd: number;
  modelUsage?: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
  }>;
}

interface WorkerEntry {
  step: string;
  role: string;
  model: string;
  turns: number;
  duration_ms: number;
  session_id: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
}

interface TokenReport {
  orchestrator: {
    model: string;
    source: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_create_tokens: number;
    estimated_cost_usd: number;
  };
  workers: WorkerEntry[];
  summary: {
    total_orchestrator_cost_usd: number;
    total_worker_cost_usd: number;
    total_worker_turns: number;
    total_duration_ms: number;
  };
}

// --- Opus 4.6 pricing ---

const OPUS_PRICING = {
  input: 5 / 1_000_000,
  output: 25 / 1_000_000,
  cache_create: 6.25 / 1_000_000,
  cache_read: 0.50 / 1_000_000,
};

// --- メイン ---

/**
 * dispatchDir 内の *-result.json を集約し、
 * オプションで JSONL を分析して TokenReport を生成する。
 */
export function generateTokenReport(dispatchDir: string): TokenReport {
  const workers: WorkerEntry[] = [];
  let totalWorkerDuration = 0;
  let totalWorkerTurns = 0;
  let totalWorkerCost = 0;

  if (existsSync(dispatchDir)) {
    const files = readdirSync(dispatchDir).filter((f) => f.endsWith("-result.json"));
    for (const file of files) {
      try {
        const raw = readFileSync(path.join(dispatchDir, file), "utf-8");
        const result = JSON.parse(raw) as GlmResult;
        const stepMatch = file.match(/^(.+?)-(worker|reviewer|fixer)-result\.json$/);
        const step = stepMatch?.[1] ?? file.replace("-result.json", "");
        const role = stepMatch?.[2] ?? "worker";

        // modelUsage からモデル名とトークン数を抽出
        const modelEntries = result.modelUsage ? Object.entries(result.modelUsage) : [];
        const modelName = modelEntries[0]?.[0] ?? "unknown";
        const usage = modelEntries[0]?.[1];

        workers.push({
          step,
          role,
          model: modelName,
          turns: result.num_turns ?? 0,
          duration_ms: result.duration_ms ?? 0,
          session_id: result.session_id ?? "",
          cost_usd: result.total_cost_usd ?? 0,
          input_tokens: usage?.inputTokens ?? 0,
          output_tokens: usage?.outputTokens ?? 0,
        });

        totalWorkerDuration += result.duration_ms ?? 0;
        totalWorkerTurns += result.num_turns ?? 0;
        totalWorkerCost += result.total_cost_usd ?? 0;
      } catch {
        // skip malformed files
      }
    }
  }

  return {
    orchestrator: {
      model: "opus",
      source: "jsonl_post_analysis",
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_create_tokens: 0,
      estimated_cost_usd: 0,
    },
    workers,
    summary: {
      total_orchestrator_cost_usd: 0,
      total_worker_cost_usd: totalWorkerCost,
      total_worker_turns: totalWorkerTurns,
      total_duration_ms: totalWorkerDuration,
    },
  };
}

/**
 * JSONL ファイルからオーケストレーターのトークン使用量を分析する。
 */
export function analyzeOrchestratorJsonl(jsonlPath: string): TokenReport["orchestrator"] {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreateTokens = 0;

  if (!existsSync(jsonlPath)) {
    return {
      model: "opus",
      source: "jsonl_post_analysis",
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_create_tokens: 0,
      estimated_cost_usd: 0,
    };
  }

  const lines = readFileSync(jsonlPath, "utf-8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        message?: {
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        };
      };
      if (entry.type === "assistant" && entry.message?.usage) {
        const u = entry.message.usage;
        inputTokens += u.input_tokens ?? 0;
        outputTokens += u.output_tokens ?? 0;
        cacheReadTokens += u.cache_read_input_tokens ?? 0;
        cacheCreateTokens += u.cache_creation_input_tokens ?? 0;
      }
    } catch {
      // skip malformed lines
    }
  }

  const cost =
    inputTokens * OPUS_PRICING.input +
    outputTokens * OPUS_PRICING.output +
    cacheReadTokens * OPUS_PRICING.cache_read +
    cacheCreateTokens * OPUS_PRICING.cache_create;

  return {
    model: "opus",
    source: "jsonl_post_analysis",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_create_tokens: cacheCreateTokens,
    estimated_cost_usd: Math.round(cost * 100) / 100,
  };
}

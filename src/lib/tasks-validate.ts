/**
 * tasks-validate.ts
 *
 * tasks-validate.sh の TypeScript 移植。
 * tasks.md フォーマット・依存関係検証。
 *
 * 検証内容:
 *   1. チェックリスト構文 (- [ ] [TXXX] パターン)
 *   2. depends 参照の存在チェック
 *   3. 並列グループ内の files glob 重複検出
 *
 * tasks-validate.sh 全体参照。
 */

// --- 型定義 ---

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    tasks: number;
    bad_format: number;
    phases: number;
  };
}

// --- 正規表現 ---

// - [ ] [TXXX] または - [X] [TXXX]
const TASK_LINE_RE = /^\s*-\s*\[[ Xx]\]\s*\[([A-Z][0-9]+)\]/;
// タスク ID なしのタスク行（- [ ] ... but no [TXXX]）
const TASK_LINE_NO_ID_RE = /^\s*-\s*\[[ Xx]\]\s+/;
// [P] または [P:group] マーカー
const PARALLEL_MARKER_RE = /\[P(:[a-z][a-z0-9-]*)?\]/;
// - files: ...
const FILES_META_RE = /^\s+-\s+files:\s*(.*)/;
// - depends: [T001, T002]
const DEPENDS_RE = /^\s+-\s+depends:\s*\[(.*)\]/;
// ## Phase N: Title
const PHASE_RE = /^## Phase /;

// --- メイン関数 ---

/**
 * tasks.md を検証する。
 * tasks-validate.sh のメインロジック全体に対応。
 *
 * @returns ValidationResult (exit code 0=valid, 0=warnings-only, 1=invalid に対応)
 */
export function validateTasks(content: string): ValidationResult {
  const lines = content.split("\n");
  const errors: string[] = [];
  const warnings: string[] = [];

  const taskIds = new Set<string>();
  const taskFiles = new Map<string, string>();
  const taskParallel = new Map<string, string>(); // taskId → group

  let taskCount = 0;
  let badFormatCount = 0;
  let currentTaskId = "";

  // --- パス 1: タスク ID・メタデータ収集 ---

  for (const line of lines) {
    const taskMatch = TASK_LINE_RE.exec(line);
    if (taskMatch?.[1]) {
      currentTaskId = taskMatch[1];
      taskIds.add(currentTaskId);
      taskCount++;

      // [P] または [P:group] マーカーを確認
      const parallelMatch = PARALLEL_MARKER_RE.exec(line);
      if (parallelMatch) {
        const groupSuffix = parallelMatch[1] ?? ":default";
        const group = groupSuffix.slice(1); // コロンを除去
        taskParallel.set(currentTaskId, group);
      }
    } else if (TASK_LINE_NO_ID_RE.test(line) && !/\[[A-Z][0-9]+\]/.test(line)) {
      // タスク ID のないタスク行
      badFormatCount++;
      errors.push(`Missing task ID in line: ${line.slice(0, 80)}`);
    }

    // files メタデータ収集
    const filesMatch = FILES_META_RE.exec(line);
    if (filesMatch?.[1] && currentTaskId) {
      taskFiles.set(currentTaskId, filesMatch[1]);
    }
  }

  // --- パス 2: depends 参照チェック ---

  for (const line of lines) {
    const dependsMatch = DEPENDS_RE.exec(line);
    if (dependsMatch?.[1]) {
      const deps = dependsMatch[1].split(",").map((d) => d.trim()).filter(Boolean);
      for (const dep of deps) {
        if (!taskIds.has(dep)) {
          errors.push(`depends reference to non-existent task: ${dep}`);
        }
      }
    }
  }

  // --- 並列グループ内の files 重複検出 ---

  // group → [{ taskId, files }] マップを構築
  const groupEntries = new Map<string, Array<{ taskId: string; files: string }>>();

  for (const [taskId, group] of taskParallel.entries()) {
    const files = taskFiles.get(taskId) ?? "";
    if (!files) {
      warnings.push(`Task ${taskId} has [P] marker but no files: metadata`);
    } else {
      const entries = groupEntries.get(group) ?? [];
      entries.push({ taskId, files });
      groupEntries.set(group, entries);
    }
  }

  // glob 重複チェック
  for (const [group, entries] of groupEntries.entries()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const entryI = entries[i]!;
        const entryJ = entries[j]!;
        const globsI = entryI.files.split(",").map((g) => g.trim());
        const globsJ = entryJ.files.split(",").map((g) => g.trim());

        for (const gi of globsI) {
          for (const gj of globsJ) {
            if (
              gi === gj ||
              (gi.endsWith("/**") && gj.endsWith("/**") &&
                gi.slice(0, -3) === gj.slice(0, -3))
            ) {
              warnings.push(
                `Potential file overlap in parallel group '${group}': ${entryI.taskId} (${gi}) vs ${entryJ.taskId} (${gj})`
              );
            }
          }
        }
      }
    }
  }

  // --- フェーズ数カウント ---

  const phaseCount = lines.filter((l) => PHASE_RE.test(l)).length;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: { tasks: taskCount, bad_format: badFormatCount, phases: phaseCount },
  };
}

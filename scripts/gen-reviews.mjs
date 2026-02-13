#!/usr/bin/env node
/**
 * gen-reviews.mjs — Generate 5 review orchestrator commands from a single template.
 *
 * Eliminates ~90% duplication across planreview, tasksreview, architecturereview,
 * qualityreview, phasereview commands. Each command previously contained ~100 lines
 * of identical Config Resolution, Execution Routing, and Review Loop logic.
 *
 * Usage:
 *   node scripts/gen-reviews.mjs           # Generate all 5 review commands
 *   node scripts/gen-reviews.mjs --check   # Check if generated files are up-to-date
 *   node scripts/gen-reviews.mjs --diff    # Show diff between template and current files
 *
 * Token savings: ~5,000 tokens total across 5 commands by referencing shared
 * routing-protocol.md instead of inlining the dispatch pseudocode.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COMMANDS_DIR = join(ROOT, 'commands');

// ─── Review type definitions ─────────────────────────────────────────────────

const REVIEWS = [
  {
    type: 'plan',
    command: 'planreview',
    description: 'Run 4-persona plan review with auto-fix loop until zero issues',
    personas: ['planreview-pm', 'planreview-risk', 'planreview-value', 'planreview-critical'],
    personaShort: ['PM', 'RISK', 'VAL', 'CRIT'],
    instruction: 'Review `$ARGUMENTS`. Output compact English YAML.',
    handoffs: [
      { label: 'タスク分解', agent: 'poor-dev.tasks', prompt: 'プランレビューをクリアしました。タスクを分解してください', send: true },
      { label: '計画修正', agent: 'poor-dev.plan', prompt: 'レビュー指摘に基づいて計画を修正してください' },
    ],
    step2Extra: '',
    outputExample: `\`\`\`yaml
# Iteration example:
type: plan
target: $ARGUMENTS
n: 3
i: {M: ["competitive analysis insufficient (CRIT)"], L: ["minor naming inconsistency (PM)"]}
ps: {PM: GO, RISK: GO, VAL: GO, CRIT: CONDITIONAL}
act: FIX

# Final (0 issues):
type: plan
target: $ARGUMENTS
v: GO
n: 7
log:
  - {n: 1, issues: 6, fixed: "auth strategy, metrics"}
  - {n: 7, issues: 0}
next: /poor-dev.tasks
\`\`\``,
    postLoop: '',
  },
  {
    type: 'tasks',
    command: 'tasksreview',
    description: 'Run 4-persona tasks review with auto-fix loop until zero issues',
    personas: ['tasksreview-techlead', 'tasksreview-senior', 'tasksreview-devops', 'tasksreview-junior'],
    personaShort: ['TECHLEAD', 'SENIOR', 'DEVOPS', 'JUNIOR'],
    instruction: 'Review `$ARGUMENTS`. Output compact English YAML.',
    handoffs: [
      { label: '実装開始', agent: 'poor-dev.implement', prompt: 'タスクレビューをクリアしました。実装を開始してください', send: true },
      { label: 'タスク再調整', agent: 'poor-dev.tasks', prompt: 'レビュー指摘に基づいてタスクを修正してください' },
    ],
    step2Extra: '\n  Additionally check: no circular dependencies, critical path identified, parallelization opportunities noted, user story coverage complete.',
    outputExample: `\`\`\`yaml
# Iteration example:
type: tasks
target: $ARGUMENTS
n: 2
i: {H: ["circular dependency between task 3 and 5 (TECHLEAD)"], M: ["missing monitoring task (DEVOPS)"]}
ps: {TECHLEAD: CONDITIONAL, SENIOR: GO, DEVOPS: CONDITIONAL, JUNIOR: GO}
act: FIX

# Final (0 issues):
type: tasks
target: $ARGUMENTS
v: GO
n: 5
log:
  - {n: 1, issues: 8, fixed: "dependency graph, task sizing"}
  - {n: 5, issues: 0}
next: /poor-dev.implement
\`\`\``,
    postLoop: '',
  },
  {
    type: 'architecture',
    command: 'architecturereview',
    description: 'Run 4-persona architecture review with auto-fix loop until zero issues',
    personas: ['architecturereview-architect', 'architecturereview-security', 'architecturereview-performance', 'architecturereview-sre'],
    personaShort: ['ARCH', 'SEC', 'PERF', 'SRE'],
    instruction: 'Review `$ARGUMENTS`. Output compact English YAML.',
    handoffs: [
      { label: '実装開始', agent: 'poor-dev.implement', prompt: 'アーキテクチャレビューをクリアしました。実装を開始してください', send: true },
      { label: '設計修正', agent: 'poor-dev.plan', prompt: 'レビュー指摘に基づいてアーキテクチャを修正してください' },
    ],
    step2Extra: '',
    outputExample: `\`\`\`yaml
# Iteration example:
type: architecture
target: $ARGUMENTS
n: 2
i: {C: ["no input validation on user endpoints (SEC)"], H: ["missing caching strategy (PERF)"]}
ps: {ARCH: GO, SEC: NO-GO, PERF: CONDITIONAL, SRE: GO}
act: FIX

# Final (0 issues):
type: architecture
target: $ARGUMENTS
v: GO
n: 6
log:
  - {n: 1, issues: 7, fixed: "SOLID violations, auth gaps"}
  - {n: 6, issues: 0}
next: /poor-dev.implement
\`\`\``,
    postLoop: '',
  },
  {
    type: 'quality',
    command: 'qualityreview',
    description: 'Run quality gates + 4-persona review + adversarial review with auto-fix loop',
    personas: ['qualityreview-qa', 'qualityreview-testdesign', 'qualityreview-code', 'qualityreview-security'],
    personaShort: ['QA', 'TESTDESIGN', 'CODE', 'SEC'],
    instruction: 'Review `$ARGUMENTS`. Output compact English YAML.',
    handoffs: [
      { label: '修正実装', agent: 'poor-dev.implement', prompt: '品質レビューの指摘に基づいて修正を適用してください', send: true },
      { label: 'フェーズ完了レビュー', agent: 'poor-dev.phasereview', prompt: 'フェーズ完了レビューを実行してください', send: true },
    ],
    step2Extra: '',
    hasGates: true,
    hasAdversarial: true,
    outputExample: `\`\`\`yaml
# Iteration example:
type: quality
target: $ARGUMENTS
n: 2
gates: {typecheck: pass, lint: pass, format: pass, test: pass}
i:
  H:
    - missing edge case test for null input (QA)
    - XSS vulnerability in render function (SEC)
  M:
    - function too complex, cyclomatic complexity 15 (CODE)
adversarial: NEEDS_CHANGES
strikes: 1
ps: {QA: CONDITIONAL, TESTDESIGN: GO, CODE: CONDITIONAL, SEC: NO-GO}
act: FIX
\`\`\`

### Final Output (0 issues)

\`\`\`yaml
type: quality
target: $ARGUMENTS
v: GO
n: 5
gates: {typecheck: pass, lint: pass, format: pass, test: pass}
adversarial: APPROVED
strikes: 1
log:
  - {n: 1, issues: 9, fixed: "gate failures, coverage"}
  - {n: 2, issues: 5, fixed: "XSS, null handling"}
  - {n: 3, issues: 3, fixed: "complexity, naming"}
  - {n: 4, issues: 1, fixed: "edge case test"}
  - {n: 5, issues: 0}
next: /poor-dev.phasereview
\`\`\``,
    postLoop: `
## Bugfix Postmortem (conditional)

Execute ONLY after loop completes with GO verdict. Skip if \`FEATURE_DIR/bug-report.md\` does not exist.

Determine FEATURE_DIR from \`$ARGUMENTS\` path.

### Postmortem Generation

1. Read \`bug-report.md\`, \`investigation.md\`, \`fix-plan.md\` from FEATURE_DIR.
2. Get diff: \`git diff main...HEAD\`
3. Generate \`$FEATURE_DIR/postmortem.md\`:

\`\`\`markdown
# Postmortem: [BUG SHORT NAME]

**Date**: [DATE] | **Branch**: [BRANCH] | **Severity**: [C/H/M/L]
**Category**: [Logic Bug / Dependency / Environment / Regression / Concurrency / Data / Configuration]
**Resolution Time**: [intake → qualityreview completion]

## Summary
[1-2 line summary]

## Root Cause
[from investigation.md]

## 5 Whys
[from investigation.md]

## Fix Applied
- Changed files: [list]
- Change type: [logic fix / config change / dependency update / etc.]

## Impact
- Scope: [affected area]
- Duration: [when to when]

## Detection
- Found via: [user report / test failure / monitoring / etc.]

## Prevention
- [ ] [concrete prevention action 1]
- [ ] [concrete prevention action 2]

## Lessons Learned
- [lesson 1]
- [lesson 2]
\`\`\`

### Update Bug Pattern Database

1. Read \`bug-patterns.md\`, determine next ID (BP-NNN).
2. Add row to Pattern Index + new pattern entry with: Category, Cause Pattern, Symptoms, Detection, Prevention, Past Occurrences.
3. Report postmortem path, root cause summary, prevention actions, new pattern ID.`,
  },
  {
    type: 'phase',
    command: 'phasereview',
    description: 'Run 4-persona phase completion review with auto-fix loop until zero issues',
    personas: ['phasereview-qa', 'phasereview-regression', 'phasereview-docs', 'phasereview-ux'],
    personaShort: ['QA', 'REGRESSION', 'DOCS', 'UX'],
    instruction: 'Review phase `$ARGUMENTS`. Check all phase artifacts including code, tests, docs. Output compact English YAML.',
    handoffs: [
      { label: '次のフェーズ', agent: 'poor-dev.implement', prompt: 'フェーズ完了レビューをクリアしました。次のフェーズに進んでください', send: true },
      { label: '修正実装', agent: 'poor-dev.implement', prompt: 'レビュー指摘に基づいて修正を適用してください' },
    ],
    step2Extra: '\n  Additionally verify Definition of Done: all tasks completed, quality gates passed, all tests passing, code review done, adversarial review passed, docs updated, no regressions, security reviewed.',
    hasDoD: true,
    outputExample: `\`\`\`yaml
# Iteration example:
type: phase
target: $ARGUMENTS
n: 3
i: {H: ["README not updated with new API endpoints (DOCS)"], M: ["accessibility not tested (UX)", "CHANGELOG missing entry (DOCS)"]}
ps: {QA: GO, REGRESSION: GO, DOCS: CONDITIONAL, UX: CONDITIONAL}
act: FIX

# Final (0 issues):
type: phase
target: $ARGUMENTS
v: GO
n: 4
dod: {tasks: pass, gates: pass, tests: pass, review: pass, adversarial: pass, docs: pass, regression: pass, security: pass}
log:
  - {n: 1, issues: 6, fixed: "DoD gaps, test coverage"}
  - {n: 4, issues: 0}
next: /poor-dev.implement (next phase)
\`\`\``,
    postLoop: `
### Branch Merge & Cleanup

GO verdict（v: GO）を出力し、かつ全タスクが完了している場合にのみ実行する。

**判定ロジック**:
1. \`BRANCH=$(git rev-parse --abbrev-ref HEAD)\` — 現在のブランチ取得
2. \`$BRANCH\` が \`main\` または \`master\` → **スキップ**（マージ不要）
3. \`$FEATURE_DIR/tasks.md\` を読み、未完了タスク（\`- [ ]\`）の有無を確認
   - 未完了タスクあり → **スキップ**（次フェーズの実装が残っている）
   - 全タスク完了（\`- [ ]\` が 0 件） → 以下を実行

**マージ手順**:
1. 未コミットの変更を確認: \`git status --porcelain\`
   - 変更あり → \`git add -A && git commit -m "chore: レビュー完了時の最終調整"\`
2. \`git checkout main\`
3. \`git pull origin main --ff-only\` — リモートと同期（失敗時はユーザーに報告して中断）
4. \`git merge $BRANCH --no-edit\` — マージ（コンフリクト時はユーザーに報告して中断）
5. \`git push origin main\`
6. \`git branch -d $BRANCH\`
7. リモートブランチ存在確認: \`git ls-remote --heads origin $BRANCH\`
   - 存在する → \`git push origin --delete $BRANCH\`
8. 出力: \`"✅ ブランチ '$BRANCH' を main にマージし、削除しました。"\``,
  },
];

// ─── Template rendering ──────────────────────────────────────────────────────

function renderHandoffs(handoffs) {
  return handoffs.map(h => {
    let entry = `  - label: ${h.label}\n    agent: ${h.agent}\n    prompt: ${h.prompt}`;
    if (h.send) entry += '\n    send: true';
    return entry;
  }).join('\n');
}

function renderCommand(review) {
  const personaList = review.personas.map(p => `\`${p}\``).join(', ');
  const psExample = review.personaShort.map(p => `${p}: GO`).join(', ');

  let content = `---
description: ${review.description}
handoffs:
${renderHandoffs(review.handoffs)}
---

## User Input

\`\`\`text
$ARGUMENTS
\`\`\`

## STEP 0: Config Resolution

1. Read \`.poor-dev/config.json\` (Bash: \`cat .poor-dev/config.json 2>/dev/null\`). If missing, use built-in defaults: \`{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }\`.
2. For each persona (${personaList}) and for \`review-fixer\`, resolve config with priority: \`overrides.<agent>\` → \`overrides.${review.command}\` → \`default\`.
3. Determine execution mode per persona: if resolved \`cli\` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.
`;

  // Quality review has gates
  if (review.hasGates) {
    content += `
### STAGE 0: Quality Gates

Run automated quality gates before persona review:

\`\`\`bash
# Detect project language and run appropriate commands:
# TypeScript/JavaScript: tsc --noEmit && eslint . --max-warnings 0 && prettier --check && npm test -- --coverage
# Python: mypy . && ruff lint && black --check . && pytest --cov
# Rust: cargo check && cargo clippy -- -D warnings && cargo fmt --check && cargo test
# Go: go vet ./... && golangci-lint run && gofmt -l . && go test ./... -cover
\`\`\`

If gates fail, record failures as C or H severity and proceed to fix loop.

After running gates, output a progress marker on its own line:
  \`[REVIEW-PROGRESS: ${review.command} [gates]: \${PASS}/\${TOTAL} passed]\`
This marker MUST be output in all execution modes (interactive and Non-Interactive).
`;
  }

  content += `
## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: ${personaList}.
  Instruction: "${review.instruction}"

  **Execution routing** — follow \`templates/review-routing-protocol.md\`. Replace \`<AGENT>\` with each persona name and \`<INSTRUCTION>\` with the review instruction above.

  Run all 4 personas in parallel. Wait for all to complete.

**STEP 2**: Aggregate ${review.hasAdversarial ? 'all' : '4 YAML'} results. Count issues by severity (C/H/M/L).${review.step2Extra}`;

  if (review.hasAdversarial) {
    content += `
  Adversarial judgments: APPROVED | NEEDS_CHANGES (add to issues) | HALLUCINATING (ignore).
  **3-strike rule**: Track adversarial rejections. After 3 strikes → abort and report failure.`;
  }

  content += `

**STEP 2.5 Progress Report**:
After aggregation, output a structured progress marker on its own line:
  \`[REVIEW-PROGRESS: ${review.command} #\${N}: \${ISSUE_COUNT} issues (C:\${c} H:\${h} M:\${m} L:\${l}) → \${ACTION}]\``;

  if (review.hasAdversarial) {
    content += `
  \`[REVIEW-PROGRESS: ${review.command} #\${N}: adversarial \${JUDGMENT} (strike \${S}/3)]\``;
  }

  if (review.hasDoD) {
    content += `
  \`[REVIEW-PROGRESS: ${review.command} #\${N}: DoD \${DONE}/\${TOTAL}]\``;
  }

  content += `
Where N = iteration number, ACTION = "fixing..." (issues > 0) or "GO" (issues == 0).
This marker MUST be output in all execution modes (interactive and Non-Interactive).

**STEP 3**: Issues remain → STEP 4. Zero issues${review.hasAdversarial ? ' AND adversarial APPROVED/HALLUCINATING → done. 3 strikes → abort.' : ' → done, output final result.'}

**STEP 4**: Spawn \`review-fixer\` sub-agent with aggregated issues (priority C→H→M→L) using resolved config for \`review-fixer\` (same routing logic). After fix → back to STEP 1.

Track issue count per iteration; verify decreasing trend.

## Output Format

${review.outputExample}
`;

  // Post-loop content (bugfix postmortem, branch merge, etc.)
  if (review.postLoop) {
    content += review.postLoop + '\n';
  }

  // Dashboard Update — now just a script call
  content += `
### Dashboard Update

Run: \`node scripts/update-dashboard.mjs --command ${review.command}\`
`;

  return content;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const isCheck = process.argv.includes('--check');
  const isDiff = process.argv.includes('--diff');
  let allUpToDate = true;

  for (const review of REVIEWS) {
    const filePath = join(COMMANDS_DIR, `poor-dev.${review.command}.md`);
    const generated = renderCommand(review);

    if (isCheck || isDiff) {
      try {
        const current = await readFile(filePath, 'utf8');
        if (current !== generated) {
          allUpToDate = false;
          console.log(`OUT OF DATE: ${filePath}`);
          if (isDiff) {
            // Simple line-by-line diff
            const currentLines = current.split('\n');
            const genLines = generated.split('\n');
            const maxLen = Math.max(currentLines.length, genLines.length);
            for (let i = 0; i < maxLen; i++) {
              if (currentLines[i] !== genLines[i]) {
                console.log(`  L${i + 1}:`);
                if (currentLines[i] !== undefined) console.log(`    - ${currentLines[i]}`);
                if (genLines[i] !== undefined) console.log(`    + ${genLines[i]}`);
              }
            }
          }
        } else {
          console.log(`UP TO DATE: ${filePath}`);
        }
      } catch {
        allUpToDate = false;
        console.log(`MISSING: ${filePath}`);
      }
    } else {
      await writeFile(filePath, generated);
      console.log(`Generated: ${filePath}`);
    }
  }

  if (isCheck && !allUpToDate) {
    console.log('\nRun "node scripts/gen-reviews.mjs" to regenerate.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Generation failed:', e.message);
  process.exit(1);
});

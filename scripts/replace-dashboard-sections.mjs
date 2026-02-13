#!/usr/bin/env node
/**
 * replace-dashboard-sections.mjs — One-time migration script.
 *
 * Replaces the verbose "Dashboard Update" sections in all non-review command
 * files with a single script invocation line.
 *
 * The 5 review commands (planreview, tasksreview, architecturereview,
 * qualityreview, phasereview) are handled by gen-reviews.mjs and skipped here.
 *
 * Usage:
 *   node scripts/replace-dashboard-sections.mjs           # Dry-run (show changes)
 *   node scripts/replace-dashboard-sections.mjs --apply   # Apply changes
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = join(__dirname, '..', 'commands');

// Skip review commands (handled by gen-reviews.mjs)
const SKIP = new Set([
  'poor-dev.planreview.md',
  'poor-dev.tasksreview.md',
  'poor-dev.architecturereview.md',
  'poor-dev.qualityreview.md',
  'poor-dev.phasereview.md',
]);

const DASHBOARD_HEADER = '### Dashboard Update';

// The full verbose Dashboard Update block (normalized)
const VERBOSE_BLOCK = `Update living documents in \`docs/\`:

1. \`mkdir -p docs\`
2. Scan all \`specs/*/\` directories. For each feature dir, check artifact existence:
   - discovery-memo.md, learnings.md, spec.md, plan.md, tasks.md, bug-report.md
   - concept.md, goals.md, milestones.md, roadmap.md (roadmap flow)
3. Determine each feature's phase from latest artifact:
   Discovery → Specification → Planning → Tasks → Implementation → Review → Complete
4. Write \`docs/progress.md\`:
   - Header with timestamp and triggering command name
   - Per-feature section: branch, phase, artifact checklist (✅/⏳/—), last activity
5. Write \`docs/roadmap.md\`:
   - Header with timestamp
   - Active features table (feature, phase, status, branch)
   - Completed features table
   - Upcoming section (from concept.md/goals.md/milestones.md if present)`;

async function main() {
  const apply = process.argv.includes('--apply');
  const files = (await readdir(COMMANDS_DIR)).filter(f => f.endsWith('.md') && !SKIP.has(f));

  let changed = 0;
  for (const file of files) {
    const filePath = join(COMMANDS_DIR, file);
    const content = await readFile(filePath, 'utf8');

    if (!content.includes(DASHBOARD_HEADER)) continue;

    // Find the Dashboard Update section and replace just the body
    const headerIdx = content.indexOf(DASHBOARD_HEADER);
    if (headerIdx === -1) continue;

    // Check if it contains the verbose block
    if (!content.includes('Scan all `specs/*/` directories')) continue;

    // Extract command name from filename
    const cmdName = file.replace('.md', '').replace('poor-dev.', '').replace('poor-dev', 'intake');

    // Find the section boundaries
    const sectionStart = headerIdx;
    const afterHeader = content.indexOf('\n', sectionStart);

    // Find where the verbose block ends (look for the last line of the block)
    const blockEndMarker = 'Upcoming section (from concept.md/goals.md/milestones.md if present)';
    const blockEndIdx = content.indexOf(blockEndMarker);
    if (blockEndIdx === -1) continue;

    // Find the end of that line
    let blockEnd = content.indexOf('\n', blockEndIdx);
    if (blockEnd === -1) blockEnd = content.length;

    // Build replacement
    const replacement = `${DASHBOARD_HEADER}\n\nRun: \`node scripts/update-dashboard.mjs --command ${cmdName}\``;

    const newContent = content.substring(0, sectionStart) + replacement + content.substring(blockEnd);

    if (apply) {
      await writeFile(filePath, newContent);
      console.log(`UPDATED: ${file}`);
    } else {
      console.log(`WOULD UPDATE: ${file} (${content.length} → ${newContent.length} bytes, saved ${content.length - newContent.length})`);
    }
    changed++;
  }

  console.log(`\n${changed} files ${apply ? 'updated' : 'would be updated'}.`);
  if (!apply && changed > 0) {
    console.log('Run with --apply to make changes.');
  }
}

main().catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});

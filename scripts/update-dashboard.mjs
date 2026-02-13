#!/usr/bin/env node
/**
 * update-dashboard.mjs — Deterministic dashboard updater.
 *
 * Replaces the LLM-interpreted "Dashboard Update" sections that were
 * copy-pasted across 8+ command files (~400 tokens each).
 *
 * Usage:
 *   node scripts/update-dashboard.mjs [--command <command-name>]
 *
 * Scans specs/*/ directories, determines each feature's phase,
 * and writes docs/progress.md + docs/roadmap.md.
 */

import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SPECS_DIR = 'specs';
const DOCS_DIR = 'docs';

// Artifact → phase mapping (order matters: later = more advanced)
const PHASE_ARTIFACTS = [
  { file: 'discovery-memo.md', phase: 'Discovery' },
  { file: 'learnings.md', phase: 'Discovery' },
  { file: 'spec.md', phase: 'Specification' },
  { file: 'plan.md', phase: 'Planning' },
  { file: 'tasks.md', phase: 'Tasks' },
];

// Roadmap-specific artifacts
const ROADMAP_ARTIFACTS = ['concept.md', 'goals.md', 'milestones.md', 'roadmap.md'];

// All tracked artifacts
const ALL_ARTIFACTS = [
  'discovery-memo.md', 'learnings.md', 'spec.md', 'plan.md',
  'tasks.md', 'bug-report.md',
  ...ROADMAP_ARTIFACTS,
];

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function getFeatureDirs() {
  if (!await exists(SPECS_DIR)) return [];
  const entries = await readdir(SPECS_DIR, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
}

function determinePhase(artifactMap) {
  // Check for completion indicators
  if (artifactMap['tasks.md']) {
    // If tasks.md exists, check if all tasks are done
    // For now, having tasks.md means at least "Tasks" phase
  }

  let phase = 'Discovery';
  for (const { file, phase: p } of PHASE_ARTIFACTS) {
    if (artifactMap[file]) phase = p;
  }

  // Heuristic: if bug-report.md exists, it's a bugfix flow
  if (artifactMap['bug-report.md'] && phase === 'Discovery') {
    phase = 'Investigation';
  }

  return phase;
}

function artifactStatus(present) {
  return present ? '✅' : '—';
}

async function getLastModified(dir) {
  try {
    const entries = await readdir(dir);
    let latest = 0;
    for (const f of entries) {
      const s = await stat(join(dir, f));
      if (s.mtimeMs > latest) latest = s.mtimeMs;
    }
    return latest > 0 ? new Date(latest).toISOString().split('T')[0] : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getBranchForFeature(featureName) {
  // Feature dirs are typically named NNN-feature-name, matching branch names
  return featureName;
}

async function main() {
  const commandName = process.argv.includes('--command')
    ? process.argv[process.argv.indexOf('--command') + 1]
    : 'update-dashboard';

  await mkdir(DOCS_DIR, { recursive: true });

  const featureDirs = await getFeatureDirs();
  const features = [];

  for (const dir of featureDirs) {
    const featurePath = join(SPECS_DIR, dir);
    const artifactMap = {};

    for (const artifact of ALL_ARTIFACTS) {
      artifactMap[artifact] = await exists(join(featurePath, artifact));
    }

    const phase = determinePhase(artifactMap);
    const lastActivity = await getLastModified(featurePath);
    const branch = await getBranchForFeature(dir);

    features.push({ dir, branch, phase, artifactMap, lastActivity });
  }

  // --- Write docs/progress.md ---
  const now = new Date().toISOString();
  let progress = `# Progress Dashboard\n\n`;
  progress += `**Updated**: ${now}  \n`;
  progress += `**Triggered by**: ${commandName}\n\n`;

  if (features.length === 0) {
    progress += `No features found in \`${SPECS_DIR}/\`.\n`;
  } else {
    for (const f of features) {
      progress += `## ${f.dir}\n\n`;
      progress += `- **Branch**: \`${f.branch}\`\n`;
      progress += `- **Phase**: ${f.phase}\n`;
      progress += `- **Last Activity**: ${f.lastActivity}\n`;
      progress += `- **Artifacts**:`;

      const checks = [
        'discovery-memo.md', 'learnings.md', 'spec.md',
        'plan.md', 'tasks.md', 'bug-report.md',
      ];
      progress += ` ${checks.map(a => `${artifactStatus(f.artifactMap[a])} ${a.replace('.md', '')}`).join(' | ')}\n`;

      // Roadmap artifacts if any present
      const hasRoadmap = ROADMAP_ARTIFACTS.some(a => f.artifactMap[a]);
      if (hasRoadmap) {
        progress += `- **Roadmap**: ${ROADMAP_ARTIFACTS.map(a => `${artifactStatus(f.artifactMap[a])} ${a.replace('.md', '')}`).join(' | ')}\n`;
      }
      progress += '\n';
    }
  }

  await writeFile(join(DOCS_DIR, 'progress.md'), progress);

  // --- Write docs/roadmap.md ---
  let roadmap = `# Roadmap\n\n`;
  roadmap += `**Updated**: ${now}\n\n`;

  const active = features.filter(f => f.phase !== 'Complete');
  const completed = features.filter(f => f.phase === 'Complete');
  const upcoming = features.filter(f =>
    ROADMAP_ARTIFACTS.some(a => f.artifactMap[a])
  );

  roadmap += `## Active Features\n\n`;
  if (active.length === 0) {
    roadmap += `No active features.\n\n`;
  } else {
    roadmap += `| Feature | Phase | Branch | Last Activity |\n`;
    roadmap += `|---------|-------|--------|---------------|\n`;
    for (const f of active) {
      roadmap += `| ${f.dir} | ${f.phase} | \`${f.branch}\` | ${f.lastActivity} |\n`;
    }
    roadmap += '\n';
  }

  roadmap += `## Completed Features\n\n`;
  if (completed.length === 0) {
    roadmap += `No completed features.\n\n`;
  } else {
    roadmap += `| Feature | Branch |\n`;
    roadmap += `|---------|--------|\n`;
    for (const f of completed) {
      roadmap += `| ${f.dir} | \`${f.branch}\` |\n`;
    }
    roadmap += '\n';
  }

  if (upcoming.length > 0) {
    roadmap += `## Upcoming (from roadmap artifacts)\n\n`;
    for (const f of upcoming) {
      const present = ROADMAP_ARTIFACTS.filter(a => f.artifactMap[a]).map(a => a.replace('.md', ''));
      roadmap += `- **${f.dir}**: ${present.join(', ')}\n`;
    }
    roadmap += '\n';
  }

  await writeFile(join(DOCS_DIR, 'roadmap.md'), roadmap);

  console.log(`Dashboard updated: docs/progress.md, docs/roadmap.md (${features.length} features)`);
}

main().catch(e => {
  console.error('Dashboard update failed:', e.message);
  process.exit(1);
});

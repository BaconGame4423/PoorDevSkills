import { readdir, readFile, writeFile, mkdir, copyFile, symlink, unlink, lstat, readlink, stat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');

function pkgVersion() {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function listMdFiles(dir) {
  const entries = await readdir(dir);
  return entries.filter(f => f.endsWith('.md'));
}

async function listMjsFiles(dir) {
  const entries = await readdir(dir);
  return entries.filter(f => f.endsWith('.mjs'));
}

async function copyMjsFiles(srcDir, destDir) {
  const files = await listMjsFiles(srcDir);
  await ensureDir(destDir);
  for (const f of files) {
    await copyFile(join(srcDir, f), join(destDir, f));
  }
  return files.length;
}

async function copyFiles(srcDir, destDir, prefix) {
  const files = await listMdFiles(srcDir);
  const filtered = prefix ? files.filter(f => f.startsWith(prefix)) : files;
  await ensureDir(destDir);
  for (const f of filtered) {
    await copyFile(join(srcDir, f), join(destDir, f));
  }
  return filtered.length;
}

async function removeMatchingFiles(dir, prefix) {
  try {
    const entries = await readdir(dir);
    const targets = prefix ? entries.filter(f => f.startsWith(prefix)) : entries.filter(f => f.endsWith('.md'));
    for (const f of targets) {
      await unlink(join(dir, f));
    }
    return targets.length;
  } catch {
    return 0;
  }
}

async function createSymlinks(sourceDir, linkDir, relativeTarget) {
  const files = await listMdFiles(sourceDir);
  await ensureDir(linkDir);
  for (const f of files) {
    const linkPath = join(linkDir, f);
    try { await unlink(linkPath); } catch { /* ignore */ }
    await symlink(join(relativeTarget, f), linkPath);
  }
  return files.length;
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(dir, ext = '.md') {
  try {
    const entries = await readdir(dir);
    return entries.filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

async function countBrokenLinks(dir) {
  let broken = 0;
  try {
    const entries = await readdir(dir);
    for (const f of entries) {
      const p = join(dir, f);
      try {
        const s = await lstat(p);
        if (s.isSymbolicLink()) {
          try { await stat(p); } catch { broken++; }
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return broken;
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

export async function init(targetDir) {
  targetDir = resolve(targetDir);
  const version = pkgVersion();

  console.log(`poor-dev v${version} - Installing...`);
  console.log(`Target: ${targetDir}\n`);

  // 1. Create directories
  const dirs = [
    '.opencode/command',
    '.opencode/agents',
    '.claude/commands',
    '.claude/agents',
  ];
  for (const d of dirs) {
    await ensureDir(join(targetDir, d));
  }

  // 2. Copy command files to .opencode/command/
  //    Remove old poor-dev.* files first, then copy new ones
  await removeMatchingFiles(join(targetDir, '.opencode/command'), 'poor-dev.');
  const cmdCount = await copyFiles(
    join(PKG_ROOT, 'commands'),
    join(targetDir, '.opencode/command'),
    'poor-dev.'
  );
  console.log(`  Commands: ${cmdCount} files installed`);

  // 3. Copy agent files
  await removeMatchingFiles(join(targetDir, '.opencode/agents'), null);
  const ocAgentCount = await copyFiles(
    join(PKG_ROOT, 'agents/opencode'),
    join(targetDir, '.opencode/agents'),
    null
  );
  console.log(`  OpenCode agents: ${ocAgentCount} files installed`);

  await removeMatchingFiles(join(targetDir, '.claude/agents'), null);
  const clAgentCount = await copyFiles(
    join(PKG_ROOT, 'agents/claude'),
    join(targetDir, '.claude/agents'),
    null
  );
  console.log(`  Claude agents: ${clAgentCount} files installed`);

  // 4. Create symlinks: .claude/commands/ → .opencode/command/
  await removeMatchingFiles(join(targetDir, '.claude/commands'), 'poor-dev.');
  const linkCount = await createSymlinks(
    join(targetDir, '.opencode/command'),
    join(targetDir, '.claude/commands'),
    '../../.opencode/command'
  );
  console.log(`  Claude command symlinks: ${linkCount} created`);

  // 4b. Copy scripts/ to target
  const scriptCount = await copyMjsFiles(
    join(PKG_ROOT, 'scripts'),
    join(targetDir, 'scripts')
  );
  console.log(`  Scripts: ${scriptCount} files installed`);

  // 4c. Copy templates/ to target (routing protocol etc.)
  const tplCount = await copyFiles(
    join(PKG_ROOT, 'templates'),
    join(targetDir, 'templates'),
    null
  );
  console.log(`  Templates: ${tplCount} files installed`);

  // 5. .opencode/package.json management
  const ocPkgPath = join(targetDir, '.opencode/package.json');
  if (await fileExists(ocPkgPath)) {
    try {
      const existing = JSON.parse(await readFile(ocPkgPath, 'utf8'));
      if (!existing.dependencies) existing.dependencies = {};
      if (!existing.dependencies['@opencode-ai/plugin']) {
        existing.dependencies['@opencode-ai/plugin'] = '1.1.53';
        await writeFile(ocPkgPath, JSON.stringify(existing, null, 2) + '\n');
        console.log('  .opencode/package.json: added @opencode-ai/plugin');
      } else {
        console.log('  .opencode/package.json: @opencode-ai/plugin already present');
      }
    } catch (e) {
      console.warn(`  .opencode/package.json: parse error, skipping (${e.message})`);
    }
  } else {
    await writeFile(ocPkgPath, JSON.stringify({
      dependencies: { '@opencode-ai/plugin': '1.1.53' }
    }, null, 2) + '\n');
    console.log('  .opencode/package.json: created');
  }

  // 6. npm install in .opencode/
  try {
    console.log('  Running npm install in .opencode/...');
    execSync('npm install', {
      cwd: join(targetDir, '.opencode'),
      stdio: 'pipe',
      timeout: 60000,
    });
    console.log('  npm install: done');
  } catch (e) {
    console.warn(`  npm install: failed (${e.message?.split('\n')[0] || 'unknown error'})`);
    console.warn('  (This is OK if you only use Claude Code)');
  }

  // 7. Template: constitution.md
  const constitutionDest = join(targetDir, 'constitution.md');
  if (await fileExists(constitutionDest)) {
    console.log('  constitution.md: existing file preserved');
  } else {
    await copyFile(join(PKG_ROOT, 'templates/constitution.md'), constitutionDest);
    console.log('  constitution.md: template installed');
  }

  // 8. Version file
  await writeFile(join(targetDir, '.poor-dev-version'), version + '\n');

  // 9. .gitignore update
  const gitignorePath = join(targetDir, '.gitignore');
  const ignoreEntry = '.opencode/node_modules/';
  try {
    const content = await readFile(gitignorePath, 'utf8');
    if (!content.includes(ignoreEntry)) {
      await writeFile(gitignorePath, content.trimEnd() + '\n' + ignoreEntry + '\n');
      console.log('  .gitignore: added .opencode/node_modules/');
    }
  } catch {
    await writeFile(gitignorePath, ignoreEntry + '\n');
    console.log('  .gitignore: created with .opencode/node_modules/');
  }

  // Summary
  console.log(`
Installation complete!
  Version:  ${version}
  Commands: ${cmdCount}
  Agents:   ${ocAgentCount} (OpenCode) + ${clAgentCount} (Claude Code)

Get started with: /poor-dev`);
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export async function update(targetDir) {
  targetDir = resolve(targetDir);
  const versionFile = join(targetDir, '.poor-dev-version');

  if (!await fileExists(versionFile)) {
    console.error('Error: poor-dev is not installed in this directory.');
    console.error('Run "npx github:BaconGame4423/PoorDevSkills init" first.');
    process.exit(1);
  }

  const oldVersion = (await readFile(versionFile, 'utf8')).trim();
  const newVersion = pkgVersion();

  console.log(`poor-dev update: v${oldVersion} → v${newVersion}`);
  console.log(`Target: ${targetDir}\n`);

  // Update command files
  await removeMatchingFiles(join(targetDir, '.opencode/command'), 'poor-dev.');
  const cmdCount = await copyFiles(
    join(PKG_ROOT, 'commands'),
    join(targetDir, '.opencode/command'),
    'poor-dev.'
  );
  console.log(`  Commands: ${cmdCount} files updated`);

  // Update agent files
  await removeMatchingFiles(join(targetDir, '.opencode/agents'), null);
  const ocAgentCount = await copyFiles(
    join(PKG_ROOT, 'agents/opencode'),
    join(targetDir, '.opencode/agents'),
    null
  );
  console.log(`  OpenCode agents: ${ocAgentCount} files updated`);

  await removeMatchingFiles(join(targetDir, '.claude/agents'), null);
  const clAgentCount = await copyFiles(
    join(PKG_ROOT, 'agents/claude'),
    join(targetDir, '.claude/agents'),
    null
  );
  console.log(`  Claude agents: ${clAgentCount} files updated`);

  // Recreate symlinks
  await removeMatchingFiles(join(targetDir, '.claude/commands'), 'poor-dev.');
  const linkCount = await createSymlinks(
    join(targetDir, '.opencode/command'),
    join(targetDir, '.claude/commands'),
    '../../.opencode/command'
  );
  console.log(`  Claude command symlinks: ${linkCount} recreated`);

  // Update scripts
  const scriptCount = await copyMjsFiles(
    join(PKG_ROOT, 'scripts'),
    join(targetDir, 'scripts')
  );
  console.log(`  Scripts: ${scriptCount} files updated`);

  // Update templates (routing protocol etc.)
  const tplCount = await copyFiles(
    join(PKG_ROOT, 'templates'),
    join(targetDir, 'templates'),
    null
  );
  console.log(`  Templates: ${tplCount} files updated`);

  // constitution.md is NOT overwritten
  console.log('  constitution.md: not modified (user customization preserved)');

  // Update version file
  await writeFile(versionFile, newVersion + '\n');

  console.log(`
Update complete: v${oldVersion} → v${newVersion}
  Commands: ${cmdCount}
  Agents:   ${ocAgentCount} (OpenCode) + ${clAgentCount} (Claude Code)
  Scripts:  ${scriptCount}`);
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

export async function status(targetDir) {
  targetDir = resolve(targetDir);
  const versionFile = join(targetDir, '.poor-dev-version');

  let version = '(not installed)';
  try {
    version = (await readFile(versionFile, 'utf8')).trim();
  } catch { /* not installed */ }

  const ocCmdCount = await countFiles(join(targetDir, '.opencode/command'));
  const clCmdCount = await countFiles(join(targetDir, '.claude/commands'));
  const clCmdBroken = await countBrokenLinks(join(targetDir, '.claude/commands'));
  const ocAgentCount = await countFiles(join(targetDir, '.opencode/agents'));
  const clAgentCount = await countFiles(join(targetDir, '.claude/agents'));
  const clAgentBroken = await countBrokenLinks(join(targetDir, '.claude/agents'));
  const hasConstitution = await fileExists(join(targetDir, 'constitution.md'));

  const latestVersion = pkgVersion();

  console.log(`poor-dev status
  Directory:        ${targetDir}
  Installed version: ${version}
  Package version:   ${latestVersion}
  ${version !== latestVersion && version !== '(not installed)' ? '⚠ Update available!' : ''}
  OpenCode commands: ${ocCmdCount}
  Claude commands:   ${clCmdCount}${clCmdBroken ? ` (${clCmdBroken} broken links!)` : ''}
  OpenCode agents:   ${ocAgentCount}
  Claude agents:     ${clAgentCount}${clAgentBroken ? ` (${clAgentBroken} broken links!)` : ''}
  constitution.md:   ${hasConstitution ? 'present' : 'missing'}`);
}

#!/usr/bin/env node

import { init, update, status } from '../lib/installer.mjs';
import { setup as benchSetup, update as benchUpdate, metrics as benchMetrics, compare as benchCompare, run as benchRun } from '../lib/benchmark.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HELP = `
poor-dev - AI-powered development workflow slash commands

Usage:
  poor-dev init   [dir]    Install commands & agents into a project
  poor-dev update [dir]    Update to the latest version
  poor-dev status [dir]    Show installation status
  poor-dev config [subcmd] [args...]  Manage CLI/model configuration

  poor-dev benchmark setup       Set up benchmark directories
  poor-dev benchmark update      Update benchmark skill files
  poor-dev benchmark metrics <dir>  Collect metrics for a directory
  poor-dev benchmark compare     Generate COMPARISON.md
  poor-dev benchmark run <combo> [version]  Run a benchmark end-to-end

Options:
  dir    Target directory (defaults to current directory)

Examples:
  npx github:BaconGame4423/PoorDevSkills init
  npx github:BaconGame4423/PoorDevSkills update
  npx github:BaconGame4423/PoorDevSkills status
  npx github:BaconGame4423/PoorDevSkills config show
  npx github:BaconGame4423/PoorDevSkills benchmark setup
`.trim();

const [subcommand, targetArg] = process.argv.slice(2);
const targetDir = targetArg || process.cwd();

switch (subcommand) {
  case 'init':
    await init(targetDir);
    break;
  case 'update':
    await update(targetDir);
    break;
  case 'status':
    await status(targetDir);
    break;
  case 'config': {
    // TS 版 config コマンドを呼び出す
    // dist/ にビルド済みの場合はそちらを使用、なければ tsx 経由でソースを直接実行
    const configArgs = process.argv.slice(3);
    const configDir = process.argv[3] && !process.argv[3].startsWith('-') && process.argv[3] !== 'show'
      ? process.argv[3]
      : process.cwd();
    const configSubArgs = process.argv[3] && !process.argv[3].startsWith('-') && process.argv[3] !== 'show'
      ? process.argv.slice(4)
      : configArgs;

    try {
      // ESM 動的インポートで TS コンパイル済みモジュールを読み込む
      const distPath = path.join(__dirname, '../dist/lib/config.js');
      const srcPath = path.join(__dirname, '../src/lib/config.ts');
      const { configCmd } = await import(distPath).catch(() =>
        // dist がない場合は tsx 経由でソースを読み込む（開発環境）
        import(srcPath)
      );
      const result = configCmd(configDir, configSubArgs);
      if (result.output) console.log(result.output);
      process.exit(result.exitCode);
    } catch {
      // フォールバック: config.sh を呼び出す
      const { execFileSync } = await import('node:child_process');
      const configScript = path.join(__dirname, '../lib/config.sh');
      try {
        execFileSync('bash', [configScript, ...configArgs], { stdio: 'inherit', cwd: configDir });
      } catch (e) {
        process.exit(e?.status ?? 1);
      }
    }
    break;
  }
  case 'benchmark': {
    const action = process.argv[3];
    switch (action) {
      case 'setup':   benchSetup(); break;
      case 'update':  benchUpdate(); break;
      case 'metrics': benchMetrics(process.argv[4]); break;
      case 'compare': benchCompare(); break;
      case 'run':     benchRun(process.argv[4], process.argv[5]); break;
      default:
        console.error(`Unknown benchmark action: ${action || '(none)'}`);
        console.log('Available: setup, update, metrics <dir>, compare, run <combo> [version]');
        process.exit(1);
    }
    break;
  }
  default:
    console.log(HELP);
    process.exit(subcommand ? 1 : 0);
}

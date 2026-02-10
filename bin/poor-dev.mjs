#!/usr/bin/env node

import { init, update, status } from '../lib/installer.mjs';

const HELP = `
poor-dev - AI-powered development workflow slash commands

Usage:
  poor-dev init   [dir]    Install commands & agents into a project
  poor-dev update [dir]    Update to the latest version
  poor-dev status [dir]    Show installation status

Options:
  dir    Target directory (defaults to current directory)

Examples:
  npx github:BaconGame4423/PoorDevSkills init
  npx github:BaconGame4423/PoorDevSkills update
  npx github:BaconGame4423/PoorDevSkills status
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
  default:
    console.log(HELP);
    process.exit(subcommand ? 1 : 0);
}

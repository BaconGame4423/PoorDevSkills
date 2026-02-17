import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const BENCH_DIR = join(PKG_ROOT, 'benchmarks');

function checkJq() {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
  } catch {
    console.error('ERROR: jq is required but not found. Install it first.');
    process.exit(1);
  }
}

function runScript(scriptPath, args = []) {
  execSync(['bash', scriptPath, ...args].map(a => `'${a}'`).join(' '), {
    stdio: 'inherit',
    cwd: BENCH_DIR,
  });
}

export function setup() {
  checkJq();
  runScript(join(BENCH_DIR, 'setup-benchmarks.sh'), ['--no-git']);
}

export function update() {
  checkJq();
  runScript(join(BENCH_DIR, 'setup-benchmarks.sh'), ['--update', '--no-git']);
}

export function metrics(dirName) {
  if (!dirName) {
    console.error('Usage: poor-dev benchmark metrics <directory_name>');
    process.exit(1);
  }
  checkJq();
  runScript(join(BENCH_DIR, 'reviews', 'collect-metrics.sh'), [dirName]);
}

export function compare() {
  checkJq();
  runScript(join(BENCH_DIR, 'generate-comparison.sh'));
}

export function run(combo, version) {
  checkJq();
  const args = [combo];
  if (version) args.push(version);
  runScript(join(BENCH_DIR, 'run-benchmark.sh'), args);
}

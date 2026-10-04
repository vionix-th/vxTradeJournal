import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseCLI } from 'vitest/node';
import { getProfile } from './profiles.js';

const profile = getProfile('auto');
const selected = process.argv[2] ?? 'all';
const forwarded = process.argv.slice(3);
const commands = {
  all: [['vitest', '--project', 'integration'], ['playwright']],
  unit: [['vitest', '--project', 'unit']],
  integration: [['vitest', '--project', 'integration']],
  cli: [['vitest', '--project', 'integration', 'tests/integration/cli.test.js']],
  e2e: [['playwright']],
};
const children = new Set();
let stopping = false;
function stop(signal = 'SIGTERM') {
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}
function interrupt(signal) {
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  stop(signal);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => interrupt(signal));

function launch(program, args, env = {}) {
  const child = spawn(program, args, { stdio: 'inherit', env: { ...process.env, VXJ_PROFILE: 'auto', ...env } });
  children.add(child);
  const handle = { child, finished: false, error: null };
  child.once('error', error => { handle.error = error; });
  handle.done = new Promise(resolve => child.once('close', (code, signal) => {
    children.delete(child);
    handle.finished = true;
    resolve({ code: code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1), error: handle.error });
  }));
  return handle;
}

async function waitForService(emulator, url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (stopping) throw new Error('Test run interrupted.');
    if (emulator.error) throw emulator.error;
    if (emulator.finished) throw new Error('Emulators exited before becoming ready.');
    try { await fetch(url, { signal: AbortSignal.timeout(1000) }); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function validateSelection() {
  if (!commands[selected]) throw new Error('Usage: node scripts/test.js all|unit|integration|cli|e2e');
  if (selected === 'all' && forwarded.length) throw new Error('Complete tests do not accept selectors; use test:unit, test:integration, test:cli or test:e2e.');
  if (selected === 'e2e') {
    if (forwarded.some(arg => /^(--(?:config|list|help|version)(?:=|$)|-[chV])/.test(arg))) throw new Error('E2E verification must execute tests with the repository config.');
    return null;
  }
  const parsed = parseCLI(['vitest', 'run', ...forwarded]);
  for (const option of ['config', 'root', 'project', 'projects', 'watch', 'help', 'version']) {
    if (parsed.options[option] !== undefined && parsed.options[option] !== false) throw new Error(`Test selection cannot override --${option}.`);
  }
  if (parsed.options.run === false) throw new Error('Test selection must execute tests once.');
  if (['integration', 'cli'].includes(selected) && (parsed.options.fileParallelism === true || parsed.options.sequence?.concurrent === true)) {
    throw new Error('Integration verification must remain sequential because its fixtures reset shared Firestore data.');
  }
  if (selected === 'cli' && parsed.filter.some(path => resolve(path.split(':')[0]) !== resolve('tests/integration/cli.test.js'))) {
    throw new Error('test:cli accepts only its CLI integration file and native options such as -t; use test:integration for other files.');
  }
  return parsed;
}

async function main() {
  const parsed = validateSelection();
  const temporary = await mkdtemp(join(tmpdir(), 'vxj-test-reports-'));
  let emulator;
  let runIndex = 0;
  async function run([program, ...args], filters = []) {
    if (stopping) return process.exitCode || 1;
    const reportPath = join(temporary, `${++runIndex}-${program}.json`);
    let runnerArgs, env = {};
    if (program === 'vitest') {
      const reporters = filters.length && parsed?.options.reporters?.length ? [] : ['--reporter=default'];
      runnerArgs = ['run', '--config', 'vitest.config.js', ...args, ...filters, ...reporters, '--reporter=json', `--outputFile.json=${reportPath}`];
    } else {
      const remaining = [...filters];
      let reporter = 'list';
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === '--reporter') { reporter = remaining[i + 1]; remaining.splice(i, 2); i--; }
        else if (remaining[i].startsWith('--reporter=')) { reporter = remaining[i].slice('--reporter='.length); remaining.splice(i, 1); i--; }
      }
      if (!reporter) throw new Error('--reporter requires a value.');
      runnerArgs = ['test', '--config', 'playwright.config.js', ...args, ...remaining, `--reporter=${[...new Set([...reporter.split(','), 'json'])].join(',')}`];
      env = { PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath };
    }
    const result = await launch(`node_modules/.bin/${program}`, runnerArgs, env).done;
    if (result.error) throw result.error;
    if (result.code !== 0) return result.code;
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const executed = program === 'vitest' ? report.numPassedTests + report.numFailedTests : report.stats?.expected + report.stats?.unexpected + report.stats?.flaky;
    if (!Number.isInteger(executed) || executed <= 0) throw new Error(`${program}: no executed tests; selection is unsuccessful verification.`);
    return 0;
  }
  try {
    if (selected === 'all' || selected === 'unit') {
      const code = await run(['vitest', '--project', 'unit'], selected === 'unit' ? forwarded : []);
      if (code !== 0) { process.exitCode ||= code; return; }
      if (selected === 'unit') return;
    }
    if (stopping) return;
    emulator = launch(process.execPath, ['scripts/emulators.js', '--profile', 'auto']);
    await waitForService(emulator, `http://127.0.0.1:${profile.auth}`);
    await waitForService(emulator, `http://127.0.0.1:${profile.firestore}`);
    for (const command of commands[selected]) {
      const code = await run(command, forwarded);
      if (code !== 0) { process.exitCode ||= code; break; }
    }
  } finally {
    stop();
    if (emulator) await emulator.done;
    await rm(temporary, { recursive: true, force: true });
  }
}

try { await main(); }
catch (error) { console.error(error.message); process.exitCode ||= 1; }

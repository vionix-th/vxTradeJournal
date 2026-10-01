import { spawn } from 'node:child_process';
import { getProfile } from './profiles.js';

const profile = getProfile('auto');
const selected = process.argv[2] ?? 'all';
const commands = {
  all: [['vitest', 'run', '--config', 'vitest.config.js', '--project', 'integration'], ['playwright', 'test', '--config', 'playwright.config.js']],
  integration: [['vitest', 'run', '--config', 'vitest.config.js', '--project', 'integration']],
  e2e: [['playwright', 'test', '--config', 'playwright.config.js']],
};
if (!commands[selected]) throw new Error('Usage: node scripts/test.js all|integration|e2e');
const emulator = spawn('node', ['scripts/emulators.js', '--profile', 'auto'], { stdio: 'inherit', env: { ...process.env, VXJ_PROFILE: 'auto' } });
let stopping = false;
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  if (emulator.exitCode === null) emulator.kill(signal);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(signal));

async function waitForService(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (emulator.exitCode !== null) throw new Error('Emulators exited before becoming ready.');
    try { await fetch(url); return; } catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  await waitForService(`http://127.0.0.1:${profile.auth}`);
  await waitForService(`http://127.0.0.1:${profile.firestore}`);
  if (selected === 'all') {
    const result = await new Promise((resolve) => {
      const child = spawn('node_modules/.bin/vitest', ['run', '--config', 'vitest.config.js', '--project', 'unit'], { stdio: 'inherit', env: { ...process.env, VXJ_PROFILE: 'auto' } });
      child.once('exit', (code) => resolve(code ?? 1));
    });
    if (result !== 0) { process.exitCode = result; throw new Error('Unit tests failed.'); }
  }
  for (const args of commands[selected]) {
    const forwardedArgs = selected === 'e2e' ? process.argv.slice(3) : [];
    const result = await new Promise((resolve) => {
      const child = spawn('node_modules/.bin/' + args[0], [...args.slice(1), ...forwardedArgs], { stdio: 'inherit', env: { ...process.env, VXJ_PROFILE: 'auto' } });
      child.once('exit', (code) => resolve(code ?? 1));
    });
    if (result !== 0) process.exitCode = result;
    if (result !== 0) break;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stop();
  if (emulator.exitCode === null) await new Promise((resolve) => emulator.once('exit', resolve));
}

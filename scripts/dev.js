import { spawn } from 'node:child_process';
import { getProfile, parseProfileArg } from './profiles.js';

const profile = getProfile(parseProfileArg());
const env = { ...process.env, VXJ_PROFILE: profile.name };
const children = [
  spawn('node', ['scripts/emulators.js', '--profile', profile.name], { detached: true, stdio: 'inherit', env }),
  spawn('vite', ['--host', '127.0.0.1'], { detached: true, stdio: 'inherit', env }),
];
let stopping = false;
let exitCode = 0;
let resolveShutdown;
const shutdownComplete = new Promise((resolve) => { resolveShutdown = resolve; });
const exits = children.map((child) => new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal }))));
function stop(signal = 'SIGTERM', failedCode = 0) {
  if (stopping) return;
  stopping = true;
  exitCode ||= failedCode;
  for (const child of children) if (child.exitCode === null) child.kill(signal);
  Promise.all(exits).then(() => {
    process.exitCode = exitCode;
    resolveShutdown();
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
for (const child of children) child.once('exit', (code, signal) => {
  if (!stopping) stop('SIGTERM', code ?? (signal ? 1 : 0));
});
await shutdownComplete;

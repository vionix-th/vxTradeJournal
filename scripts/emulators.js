import { initializeEmptyDatabase } from './database/initialize.js';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { getProfile, parseProfileArg } from './profiles.js';

const profile = getProfile(parseProfileArg());
const args = [
  'emulators:start', '--only', 'auth,firestore', '--project', profile.id,
  '--config', profile.config,
];
if (profile.dataDir) {
  mkdirSync(profile.dataDir, { recursive: true });
  args.push(`--import=${profile.dataDir}`, `--export-on-exit=${profile.dataDir}`);
}
const child = spawn('firebase', args, { detached: true, stdio: 'inherit', env: { ...process.env, VXJ_PROFILE: profile.name } });
let stopping = false;
let exited = false;
let failureCode = 0;
const completion = new Promise(resolve => {
  child.once('error', error => {
    console.error(error.message);
    failureCode = 1;
  });
  child.once('close', (code, signal) => {
    exited = true;
    resolve(failureCode || code || (signal && !stopping ? 1 : 0));
  });
});
const stop = signal => {
  if (stopping) return;
  stopping = true;
  if (!exited && !child.killed) child.kill(signal);
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

// Retained databases stay available to operator tooling, but journal clients remain
// blocked by their missing metadata until an explicit, snapshot-backed baseline.
try {
  for (let attempt = 0; !stopping && !exited && attempt < 180; attempt++) {
    try {
      await fetch(`http://127.0.0.1:${profile.firestore}`, { signal: AbortSignal.timeout(500) });
    } catch (error) {
      if (attempt === 179) throw error;
      await new Promise(done => setTimeout(done, 500));
      continue;
    }
    if (stopping || exited) break;
    try {
      await initializeEmptyDatabase(profile.name);
    } catch (error) {
      if (error.code === 'DATABASE_BASELINE_REQUIRED') {
        console.error(`${error.message}\nServices remain running; journal access is blocked. In another terminal, run:\nnpm run database:initialize -- --profile ${profile.name} --bootstrap-schema 1`);
        break;
      }
      // Firestore can accept HTTP requests before its admin transport is ready.
      if (error.code !== 14 || attempt === 179) throw error;
      await new Promise(done => setTimeout(done, 500));
      continue;
    }
    break;
  }
} catch (error) {
  console.error(error.message);
  failureCode = 1;
  stop('SIGTERM');
}
process.exitCode = await completion;

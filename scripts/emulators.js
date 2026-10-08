import { ensureDevelopmentDatabase } from './database/development.js';
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
let preparing = false;
let stopSignal;
const preparation = new AbortController();
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
const finishShutdown = () => {
  if (stopping && !preparing && !exited && !child.killed) child.kill(stopSignal);
};
const stop = signal => {
  if (stopping) return;
  stopping = true;
  stopSignal = signal;
  preparation.abort();
  finishShutdown();
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

// Startup preserves retained records and handles schema evolution automatically.
// Journal clients stay guarded until validation and adjacent migrations complete.
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
      preparing = true;
      await ensureDevelopmentDatabase(profile.name, { signal: preparation.signal });
    } catch (error) {
      if (stopping && error.name === 'AbortError') break;
      // Firestore can accept HTTP requests before its admin transport is ready.
      if (![14, 'DATABASE_PREFLIGHT_CHANGED'].includes(error.code) || attempt === 179) throw error;
      await new Promise(done => setTimeout(done, 500));
      continue;
    } finally {
      preparing = false;
      finishShutdown();
    }
    break;
  }
} catch (error) {
  console.error(error.message);
  failureCode = 1;
  stop('SIGTERM');
}
process.exitCode = await completion;

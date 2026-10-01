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

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

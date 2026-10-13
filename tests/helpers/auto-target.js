import { getProfile } from '../../scripts/profiles.js';

/** Test administration may never inherit a development or production endpoint. */
export function autoTarget(env = process.env) {
  const profile = getProfile('auto');
  const endpoints = { FIRESTORE_EMULATOR_HOST: `127.0.0.1:${profile.firestore}`, FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${profile.auth}` };
  for (const [name, expected] of Object.entries(endpoints)) {
    if (env[name] && env[name] !== expected) throw new Error(`Test fixture rejects ${name} outside auto profile.`);
  }
  if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== profile.id) throw new Error('Test fixture rejects foreign project.');
  return { ...profile, endpoints };
}

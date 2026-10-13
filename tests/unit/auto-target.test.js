import { it, expect } from 'vitest';
import { autoTarget } from '../helpers/auto-target.js';

it('restricts fixture administration to explicit automated endpoints and project', () => {
  expect(autoTarget({})).toMatchObject({ id: 'demo-vxjournal-auto', firestore: 8280, auth: 9299 });
  for (const env of [{ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }, { GCLOUD_PROJECT: 'vionixtradejournal' }]) {
    expect(() => autoTarget(env)).toThrow(/rejects/);
  }
});

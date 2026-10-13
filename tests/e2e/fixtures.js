import { test as base, expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeAccount } from '../../src/domain/journal.js';
import { autoTarget } from '../helpers/auto-target.js';

export { expect };
const owned = new WeakMap();
export async function cleanupFixture(page) {
  const fixture = owned.get(page);
  if (!fixture) return;
  owned.delete(page);
  const outcomes = await Promise.allSettled([
    fixture.db.recursiveDelete(fixture.db.doc(`users/${fixture.uid}`)), fixture.auth.deleteUser(fixture.uid),
  ]);
  await deleteApp(fixture.app);
  const errors = outcomes.filter((outcome) => outcome.status === 'rejected').map((outcome) => outcome.reason);
  if (errors.length) throw new AggregateError(errors, 'Synthetic fixture cleanup failed.');
}
export async function trackRegisteredUser(page) {
  const target = autoTarget(); Object.assign(process.env, target.endpoints);
  const app = initializeApp({ projectId: target.id }, `registration-${crypto.randomUUID()}`);
  const uid = await page.evaluate(async () => (await import('/src/persistence/firebase.js')).auth.currentUser.uid);
  owned.set(page, { app, auth: getAuth(app), db: getFirestore(app), uid });
}
export const test = base.extend({
  page: async ({ page }, use) => {
    try { await use(page); }
    finally {
      await cleanupFixture(page);
    }
  },
});

/** Ordinary scenarios start with a verified user and independently owned records. */
export async function setup(page, _request) {
  const target = autoTarget();
  Object.assign(process.env, target.endpoints);
  const app = initializeApp({ projectId: target.id }, `browser-${crypto.randomUUID()}`);
  const auth = getAuth(app), db = getFirestore(app);
  const email = `browser-${crypto.randomUUID()}@example.test`, password = 'Synthetic-password-123';
  const user = await auth.createUser({ email, password, emailVerified: true });
  owned.set(page, { app, auth, db, uid: user.uid });
  const now = new Date().toISOString();
  const account = { ...normalizeAccount({ id: 'main', name: 'Main', currency: 'USD' }), uid: user.uid, schemaVersion: 2, revision: 1, createdAt: now, updatedAt: now };
  await db.doc(`users/${user.uid}/accounts/main`).set(account);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.evaluate(async ({ email, password }) => {
    const { signIn } = await import('/tests/e2e/sign-in.js');
    await signIn(email, password);
  }, { email, password });
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
}

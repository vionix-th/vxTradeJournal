import { test, expect } from './fixtures.js';
import { registrationSetup } from './registration-fixture.js';

test('registration, email verification, first account and subsequent sign-in use real UI', async ({ page, request }) => {
  await registrationSetup(page, request);
  const email = await page.evaluate(async () => (await import('/src/persistence/firebase.js')).auth.currentUser.email);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
});

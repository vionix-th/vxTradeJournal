import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { setup } from './fixtures.js';
import { connectAdmin } from '../../scripts/database/admin.js';

async function settings(page) {
  const target = page.getByRole('button', { name: 'Settings', exact: true });
  if (!await target.isVisible()) await page.getByRole('button', { name: 'More', exact: true }).click();
  await target.click();
}
for (const width of [375, 800, 1280]) test(`replacement preview, backup and interrupted recovery at ${width}px`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 900 }); await setup(page, request);
  await settings(page);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const file = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(file.formatVersion).toBe(1);
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'New account', exact: true }).click();
  await page.getByLabel('Account name', { exact: true }).fill('Destination-only');
  await page.getByRole('button', { name: 'Save account', exact: true }).click();
  await settings(page); await page.getByRole('button', { name: 'Import journal and recovery', exact: true }).click();
  await page.getByLabel('Journal JSON file', { exact: true }).setInputFiles({ name: 'journal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.getByLabel('Import mode', { exact: true }).selectOption('replace');
  await page.getByRole('button', { name: 'Preview import', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Import preview', exact: true })).toBeVisible();
  await expect(page.getByText(/1 document deletions/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `test-results/import-preview-${width}.png`, fullPage: true });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Apply import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await expect(page.getByText('Destination-only', { exact: true })).toHaveCount(0);
  await settings(page); await page.getByRole('button', { name: 'Import journal and recovery', exact: true }).click();
  const recoveryDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download recovery JSON', exact: true }).click();
  const backup = JSON.parse(await readFile(await (await recoveryDownload).path(), 'utf8'));
  expect(backup.accounts.some((a) => a.name === 'Destination-only')).toBe(true);
  page.once('dialog', (dialog) => dialog.accept()); await page.getByRole('button', { name: 'Delete recovery backup', exact: true }).click();
  await expect(page.getByText('No retained recovery backups.', { exact: true })).toBeVisible();
  const uid = await page.evaluate(async (file) => {
    const { auth, db } = await import('/src/persistence/firebase.js');
    const { Repository } = await import('/src/persistence/repository.js');
    const { JournalTransfer } = await import('/src/persistence/transfer.js');
    const transfer = new JournalTransfer(new Repository(db, auth.currentUser.uid));
    const preview = await transfer.preview(file, { mode: 'replace' });
    transfer.onCheckpoint = () => { throw new Error('Synthetic interruption'); };
    try { await transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'browser-interruption' }); } catch (error) { if (error.message !== 'Synthetic interruption') throw error; }
    return auth.currentUser.uid;
  }, file);
  const admin = connectAdmin('auto');
  try { await admin.db.doc(`users/${uid}/_journal/control`).update({ expiresAt: new Date(0) }); }
  finally { await admin.close(); }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Journal operation incomplete', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Import recovery', exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/import-recovery-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Resume import', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
});

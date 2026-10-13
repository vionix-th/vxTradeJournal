import { test, expect, setup } from './fixtures.js';
import { connectAdmin } from '../../scripts/database/admin.js';

test('completed deletion with failed cleanup remains recoverable after reload', async ({ page, request }) => {
  await page.setViewportSize({ width: 838, height: 924 });
  await setup(page, request);
  await page.evaluate(async () => {
    const { auth, db } = await import('/src/persistence/firebase.js');
    const { Repository } = await import('/src/persistence/repository.js');
    await new Repository(db, auth.currentUser.uid).saveEntity('accounts', { id: 'cleanup-target', name: 'Cleanup target', currency: 'USD', archived: true });
  });
  await page.reload();
  // Install failure after reload, which resets the module instance.
  await page.evaluate(async () => {
    const { JournalTransfer } = await import('/src/persistence/transfer.js');
    const cleanup = JournalTransfer.prototype.cleanup;
    JournalTransfer.prototype.cleanup = async function (...args) { if (args[2] === 'accountDeletion') throw new Error('Synthetic cleanup interruption'); return cleanup.apply(this, args); };
  });
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByRole('tab', { name: 'Archived (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByRole('button', { name: 'Permanently delete account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account deletion recovery', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish deletion cleanup', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel deletion and restore records', exact: true })).toBeHidden();
  const uid = await page.evaluate(async () => (await import('/src/persistence/firebase.js')).auth.currentUser.uid);
  const admin = connectAdmin('auto');
  try { await admin.db.doc(`users/${uid}/_journal/control`).update({ expiresAt: new Date(0) }); }
  finally { await admin.close(); }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Journal operation incomplete', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account deletion recovery', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finish deletion cleanup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
});

for (const width of [838]) {
  test(`archive excludes history; management restores and permanently deletes at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 924 });
    await setup(page, request);
    await page.evaluate(async () => {
      const { auth, db } = await import('/src/persistence/firebase.js');
      const { Repository } = await import('/src/persistence/repository.js');
      const { createTrade, PRESETS } = await import('/src/domain/journal.js');
      const repo = new Repository(db, auth.currentUser.uid);
      const main = (await repo.load()).accounts[0];
      const archive = await repo.saveEntity('accounts', { id: 'archive-target', name: 'Archived account with a long descriptive name', currency: 'USD' });
      const { label: _label, ...preset } = PRESETS.equity;
      const instrument = await repo.saveEntity('instruments', { ...preset, id: 'account-share', name: 'Account share', symbol: 'ACS', preset: 'equity', currency: 'USD' });
      for (const [id, account, exit] of [['active-trade', main, '110'], ['archived-trade', archive, '500']]) {
        const trade = createTrade({ id, account, instruments: [{ instrument, direction: 'long' }] });
        trade.tags = account.id === archive.id ? ['archive-only-tag'] : ['active-tag'];
        trade.executions = ['entry', 'exit'].map((kind, index) => ({ id: `${id}-${kind}`, legId: trade.legs[0].id, kind, quantity: '1', price: index ? exit : '100', fees: '0', feeCurrency: 'USD', timestamp: `2026-01-0${index + 1}T00:00:00Z` }));
        await repo.saveTrade(trade, `${id}-operation`);
      }
      await repo.saveEntity('settings', { ...await repo.getSettings(), defaultAccount: archive.id });
      await repo.saveEntity('accounts', { ...await repo.getEntity('accounts', archive.id), archived: true });
    });
    await page.reload();
    await expect(page.locator('.overview-card').first().locator('.overview-value')).toHaveText('+10.00 USD');
    await expect(page.getByLabel('Filter account', { exact: true }).locator('option')).toHaveCount(2);
    const tag = page.getByLabel('Filter tag', { exact: true });
    await tag.focus();
    await expect(page.getByRole('option', { name: 'archive-only-tag', exact: true })).toHaveCount(0);
    await tag.press('Escape');
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Active (1)', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Archived account with a long descriptive name', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Active (1)', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Archived (1)', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Restore account', exact: true })).toBeVisible();
    await expect(page.getByText('Complete realized net', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Delete account', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Permanently delete account', exact: true })).toBeFocused();
    await expect(page.locator('.account-delete-confirmation')).toContainText('1 trade');
    await page.getByRole('button', { name: 'Cancel deletion', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete account', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Restore account', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Active (2)', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Journal', exact: true }).click();
    await expect(page.locator('.overview-card').first().locator('.overview-value')).toHaveText('+410.00 USD');
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    const card = page.locator('.record-panel').filter({ has: page.getByRole('heading', { name: 'Archived account with a long descriptive name', exact: true }) });
    page.once('dialog', (dialog) => dialog.accept());
    await card.getByRole('button', { name: 'Archive account', exact: true }).click();
    await page.getByRole('tab', { name: 'Archived (1)', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`test-results/accounts-archived-${width}.png`.split("/").pop()), fullPage: true });
    await page.getByRole('button', { name: 'Delete account', exact: true }).click();
    await page.getByRole('button', { name: 'Permanently delete account', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Archived (0)', exact: true })).toHaveAttribute('aria-selected', 'true');
    const remaining = await page.evaluate(async () => {
      const { auth, db } = await import('/src/persistence/firebase.js');
      const { Repository } = await import('/src/persistence/repository.js');
      const repo = new Repository(db, auth.currentUser.uid);
      return { account: await repo.getEntity('accounts', 'archive-target'), trade: await repo.getTrade('archived-trade'), defaultAccount: (await repo.getSettings()).defaultAccount };
    });
    expect(remaining).toEqual({ account: null, trade: null, defaultAccount: null });
  });
}

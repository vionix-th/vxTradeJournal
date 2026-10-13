import { test, expect, setup } from './fixtures.js';



async function settings(page) {
  const control = page.getByRole('button', { name: 'Settings', exact: true });
  if (!await control.isVisible()) await page.getByRole('button', { name: 'More', exact: true }).click();
  await control.click();
}

for (const width of [800]) {
  test(`export progress, duplicate prevention and draft preservation at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, request);
    await settings(page);
    const timezone = page.getByLabel('Display timezone', { exact: true });
    await timezone.fill('Europe/Paris');
    await page.evaluate(async () => {
      const { JournalTransfer } = await import('/src/persistence/transfer.js');
      const original = JournalTransfer.prototype.export;
      window.exportRequests = 0;
      JournalTransfer.prototype.export = async function () {
        window.exportRequests++;
        await new Promise((resolve) => { window.releaseExport = resolve; });
        return original.call(this);
      };
    });
    const exportButton = page.getByRole('button', { name: 'Export JSON', exact: true });
    await exportButton.click();
    await expect(page.getByRole('status').filter({ hasText: 'Preparing export…' })).toBeVisible();
    await expect(exportButton).toBeDisabled();
    await expect(timezone).toBeDisabled();
    await exportButton.evaluate((node) => { node.click(); node.click(); });
    expect(await page.evaluate(() => window.exportRequests)).toBe(1);
    await page.evaluate(() => history.back());
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.evaluate(() => window.releaseExport());
    await download;
    await expect(page.getByText('Export file prepared. Download requested.', { exact: true })).toBeVisible();
    await expect(exportButton).toBeEnabled();
    await expect(timezone).toHaveValue('Europe/Paris');
    await expect(timezone).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`test-results/export-feedback-${width}.png`.split("/").pop()), fullPage: true });
  });
}

test('busy export shows read-only checking and enables explicit retry without automatic download', async ({ page, request }) => {
  await setup(page, request); await settings(page);
  await page.evaluate(async () => {
    const { JournalTransfer } = await import('/src/persistence/transfer.js');
    const { ImportError } = await import('/src/application/portable.js');
    window.exportRequests = 0;
    JournalTransfer.prototype.export = async () => {
      window.exportRequests++;
      throw new ImportError('IMPORT_BUSY', 'Another journal transfer owns this journal.', { transfer: { reason: 'active_export', operationId: 'other-export', phase: 'preparing', expiresAt: '2026-10-13T01:00:00Z', observedClientTime: '2026-10-13T00:59:00Z', actions: ['check_status'] } });
    };
    JournalTransfer.prototype.inspect = async () => ({ reason: 'expired_export', actions: ['retry_export', 'check_status'] });
  });
  const exportButton = page.getByRole('button', { name: 'Export JSON', exact: true });
  await exportButton.click();
  await expect(page.getByText('An export is running in another session. Check again before retrying.', { exact: true })).toBeVisible();
  await expect(exportButton).toBeDisabled();
  await expect(page.locator('.form-errors')).not.toContainText('transfer');
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await expect(page.getByText('The previous export is no longer active. Export can be retried.', { exact: true })).toBeVisible();
  await expect(exportButton).toBeEnabled();
  expect(await page.evaluate(() => window.exportRequests)).toBe(1);
});

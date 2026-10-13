import { test, expect } from '@playwright/test';
import { setup } from './fixtures.js';

test('resuming an ongoing rollback announces restoration rather than import completion', async ({ page }) => {
  await page.goto('/');
  const id = await page.evaluate(async () => {
    const { recoveryPanel } = await import('/src/ui/import-editor.js');
    const panel = recoveryPanel({ transfer: {
      inspect: async () => ({ reason: 'interrupted_import', phase: 'rollingBack', operationId: 'restoration', actions: ['resume_import', 'rollback_import', 'check_status'] }),
      resume: async () => ({ status: 'rolledBack' }),
    }, operationId: 'restoration', complete: async () => {} });
    panel.id = 'restoration-feedback-fixture'; document.body.append(panel);
    return panel.id;
  });
  const panel = page.locator(`#${id}`);
  await panel.getByRole('button', { name: 'Resume import', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Original journal restored.');
});

async function settings(page) {
  const control = page.getByRole('button', { name: 'Settings', exact: true });
  if (!await control.isVisible()) await page.getByRole('button', { name: 'More', exact: true }).click();
  await control.click();
}

for (const width of [375, 800, 1280]) {
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
    await page.screenshot({ path: `test-results/export-feedback-${width}.png`, fullPage: true });
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

test('feedback retains primary error, separates inspection failure and ignores detached completion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await page.evaluate(async () => {
    const { transferFeedback } = await import('/src/ui/transfer-feedback.js');
    window.feedbackUpdates = 0;
    const feedback = transferFeedback({ transfer: { inspect: async () => { throw new Error('Status service unavailable'); } }, onState: () => window.feedbackUpdates++ });
    document.body.append(feedback.host);
    window.feedback = feedback;
    await feedback.execute(async () => { throw new Error('Original export failure: ' + 'long-unbroken-diagnostic'.repeat(16)); });
  });
  await expect(page.getByRole('alert').filter({ hasText: 'Original export failure' })).toBeVisible();
  await page.getByText('Details', { exact: true }).focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByText(/Additional inspection failure/)).toContainText('Status service unavailable');
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Original export failure' })).toBeVisible();
  await page.evaluate(async () => {
    const pending = window.feedback.execute(() => new Promise((resolve) => { window.finishFeedback = resolve; }));
    window.feedback.host.remove();
    window.updatesBeforeDetachedCompletion = window.feedbackUpdates;
    window.finishFeedback({});
    await pending;
  });
  expect(await page.evaluate(() => window.feedbackUpdates)).toBe(await page.evaluate(() => window.updatesBeforeDetachedCompletion));
});

test('recovery actions reflect inspected session and disappear after terminal status', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { recoveryPanel } = await import('/src/ui/import-editor.js');
    window.recoveryChecks = 0;
    const transfer = { inspect: async () => ++window.recoveryChecks === 1
      ? { reason: 'interrupted_import', operationId: 'operation', phase: 'applying', committedRecords: 7, actions: ['resume_import', 'rollback_import', 'check_status'] }
      : { reason: 'ready', operationId: 'operation', importStatus: 'complete', actions: ['retry_export', 'check_status'] } };
    document.body.append(recoveryPanel({ transfer, operationId: 'operation', complete: () => {} }));
  });
  await expect(page.getByRole('button', { name: 'Resume import', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll back import', exact: true })).toBeVisible();
  await expect(page.getByText(/7 records committed/)).toBeVisible();
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume import', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Roll back import', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Return to journal', exact: true })).toBeVisible();
});

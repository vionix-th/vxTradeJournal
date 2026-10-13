import { test, expect } from './fixtures.js';
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
  await expect(page.locator('.transfer-details p').filter({ hasText: 'Additional inspection failure' }).first()).toContainText('Status service unavailable');
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

for (const terminalStatus of ['complete', 'rejected']) test(`recovery actions reflect inspected session and disappear after ${terminalStatus} status`, async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async (terminalStatus) => {
    const { recoveryPanel } = await import('/src/ui/import-editor.js');
    window.recoveryChecks = 0;
    const transfer = { inspect: async () => ++window.recoveryChecks === 1
      ? { reason: 'interrupted_import', operationId: 'operation', phase: 'applying', committedRecords: 7, actions: ['resume_import', 'rollback_import', 'check_status'] }
      : { reason: 'ready', operationId: 'operation', importStatus: terminalStatus, actions: ['retry_export', 'check_status'] } };
    document.body.append(recoveryPanel({ transfer, operationId: 'operation', complete: () => {} }));
  }, terminalStatus);
  await expect(page.getByRole('button', { name: 'Resume import', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll back import', exact: true })).toBeVisible();
  await expect(page.getByText(/7 records committed/)).toBeVisible();
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume import', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Roll back import', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Return to journal', exact: true })).toBeVisible();
});

test('detached request cannot overwrite newer feedback; new requests clear prior failures', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { transferFeedback } = await import('/src/ui/transfer-feedback.js');
    const transfer = { inspect: async () => ({ reason: 'status_unavailable', actions: ['check_status'] }) };
    const old = transferFeedback({ transfer }); document.body.append(old.host);
    window.oldRequest = old.execute(() => new Promise((resolve) => { window.finishOldRequest = resolve; }), { success: 'Stale completion' });
    old.host.remove();
    window.currentUpdates = 0;
    const current = transferFeedback({ transfer, onState: () => window.currentUpdates++ });
    current.host.id = 'current-transfer-feedback'; document.body.append(current.host);
    const failure = new Error('Original transfer failure');
    failure.details = { secondaryErrors: [{ stage: 'cleanup', message: 'Secondary cleanup unavailable' }] };
    await current.execute(async () => { throw failure; });
    window.currentFeedback = current;
  });
  const current = page.locator('#current-transfer-feedback');
  await expect(current.getByRole('alert')).toContainText('Original transfer failure');
  await expect(current).toContainText('Transfer status could not be established');
  await current.getByText('Details', { exact: true }).click();
  await expect(current).toContainText('Additional cleanup failure: FAILED: Secondary cleanup unavailable');
  await expect(current).not.toContainText('unchanged');
  await page.evaluate(async () => {
    await window.currentFeedback.execute(async () => ({}), { success: 'Latest request completed' });
    window.updatesBeforeOldCompletion = window.currentUpdates;
    window.finishOldRequest({}); await window.oldRequest;
  });
  await expect(current.getByRole('status')).toHaveText('Latest request completed');
  await expect(current.getByRole('alert')).toBeHidden();
  await expect(current.getByText('Details', { exact: true })).toBeHidden();
  expect(await page.evaluate(() => window.currentUpdates)).toBe(await page.evaluate(() => window.updatesBeforeOldCompletion));
  await expect(page.getByText('Stale completion', { exact: true })).toHaveCount(0);
});

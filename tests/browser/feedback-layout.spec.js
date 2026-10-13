import { test, expect } from './fixtures.js';

for (const width of [320, 838, 1440]) test(`long transfer failures and recovery actions wrap at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 700 }); await page.goto('/');
  await page.evaluate(async () => {
    const { transferFeedback } = await import('/src/ui/transfer-feedback.js');
    const feedback = transferFeedback({ transfer: { inspect: async () => ({ reason: 'status_unavailable', actions: ['check_status'] }) } });
    document.querySelector('main').append(feedback.host);
    await feedback.execute(async () => { throw new Error('Long-diagnostic-'.repeat(35)); });
  });
  await expect(page.getByRole('alert')).toContainText('Long-diagnostic-');
  await page.getByText('Details', { exact: true }).click();
  const check = page.getByRole('button', { name: 'Check status', exact: true });
  await expect(check).toBeVisible(); expect((await check.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await check.focus(); await expect(check).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('transfer-error.png'), fullPage: true });
});

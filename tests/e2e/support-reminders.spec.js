import { test, expect } from '@playwright/test';
import { setup } from './fixtures.js';
async function eligible(page) {
  await page.evaluate(() => {
    localStorage.setItem('vxTradeJournal.support-reminders', JSON.stringify({ version: 1,
      firstUsedAt: Date.now() - 72 * 3600000, activeDays: ['2026-01-01', '2026-01-02', '2026-01-03'],
      count: 10, cooldownUntil: 0, disabled: false }));
    window.dispatchEvent(new Event('support-reminder-change'));
  });
}
for (const width of [320, 390, 768, 1440]) {
  test(`secondary support reminder at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, request);
    let requests = 0;
    await page.route('https://ko-fi.com/**', (route) => { requests++; return route.fulfill({ body: '<button>Monthly</button>' }); });
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, width === 768 ? 'dark' : 'light');
    await eligible(page);
    const card = page.getByRole('status', { name: 'Support reminder' });
    await expect(card).toBeVisible();
    await page.waitForTimeout(6500);
    await expect(card).toBeVisible();
    expect(requests).toBe(0);
    const url = page.url();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/trade-reminder-${width}.png` });
    await card.getByRole('button', { name: 'Support', exact: true }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole('dialog', { name: 'Support vxTradeJournal' }).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(width <= 700 ? page.getByRole('button', { name: 'More', exact: true }) : page.locator('.sidebar .support-trigger')).toBeFocused();
    expect(page.url()).toBe(url);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
    await expect(card).toHaveCount(0);
  });
}
test('clean editor defers; cancel resumes; opt-out preserves manual Support', async ({ page, request }) => {
  await setup(page, request); await eligible(page);
  const card = page.locator('.support-reminder');
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'New trade', exact: true }).click();
  await expect(card).toBeHidden();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Don’t remind me' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.route('https://ko-fi.com/**', (route) => route.fulfill({ body: 'Fixture' }));
  await page.locator('.sidebar .support-trigger').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vxTradeJournal.support-reminders')).disabled)).toBe(true);
});
test('Not now refreshes cooldown; sign-in never presents automatically', async ({ page, request }) => {
  await page.goto('/'); await eligible(page);
  await expect(page.locator('.support-reminder')).toHaveCount(0);
  await setup(page, request);
  const card = page.locator('.support-reminder');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Not now' }).click();
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vxTradeJournal.support-reminders')).count)).toBe(0);
});
test('200% text scaling retains accessible actions', async ({ page, request }) => {
  await setup(page, request); await page.setViewportSize({ width: 390, height: 900 }); await eligible(page);
  await page.locator('html').evaluate((node) => { node.style.fontSize = '200%'; });
  const card = page.locator('.support-reminder'); await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.getByRole('button', { name: 'Don’t remind me' }).click();
});

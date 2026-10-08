import { test, expect } from '@playwright/test';
import { setup } from './fixtures.js';

async function mockPanel(page) {
  const calls = [];
  await page.route('https://ko-fi.com/**', async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<button>One-time</button><button>Monthly</button>' });
  });
  return calls;
}

async function checkSupport(page, area, width) {
  await page.setViewportSize({ width, height: 900 });
  const url = page.url();
  const trigger = area.getByRole('button', { name: 'Support this project', exact: true }).first();
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Support vxTradeJournal' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await expect(dialog.locator('iframe')).toHaveAttribute('src', 'https://ko-fi.com/vionixconsulting/?hidefeed=true&widget=true&embed=true&preview=true');
  await expect(dialog.locator('iframe')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(dialog.getByRole('link', { name: 'Open Ko-fi in new tab' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/vionix-support-trade-${width}.png` });
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(page.url()).toBe(url);
  await trigger.click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
}

test('support preserves sign-in input', async ({ page }) => {
  const calls = await mockPanel(page);
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('support-smoke@example.test');
  expect(calls).toHaveLength(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await checkSupport(page, page.locator('.auth-shell'), width);
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('support-smoke@example.test');
  }
});

test('support preserves an unsaved trade in light and dark themes', async ({ page, request }) => {
  const calls = await mockPanel(page);
  await setup(page, request);
  await page.getByRole('button', { name: 'New trade', exact: true }).click();
  await page.getByLabel('Entry rationale', { exact: true }).fill('Support must preserve this unsaved rationale.');
  expect(calls).toHaveLength(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, width === 768 ? 'dark' : 'light');
    await checkSupport(page, page.locator('.sidebar'), width);
    await expect(page.getByLabel('Entry rationale', { exact: true })).toHaveValue('Support must preserve this unsaved rationale.');
  }
});

test('About support action and delayed loading keep an external fallback', async ({ page }) => {
  await page.clock.install();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('https://ko-fi.com/**', async (route) => {
    await held;
    await route.fulfill({ contentType: 'text/html', body: '<p>Payment fixture</p>' }).catch(() => {});
  });
  try {
    await page.goto('/');
    const about = page.locator('.project-information');
    await about.locator('summary').click();
    const trigger = about.getByRole('button', { name: 'Support this project', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Support vxTradeJournal' });
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(dialog.getByRole('status')).toHaveText('Loading Ko-fi…');
    await page.clock.fastForward(10_000);
    await expect(dialog.getByRole('status')).toContainText('Taking longer than expected');
    await expect(dialog.getByRole('link', { name: 'Open Ko-fi in new tab' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(page.locator('iframe')).toHaveCount(0);
  } finally { release(); }
});

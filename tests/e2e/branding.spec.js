import { test, expect } from '@playwright/test';
import { setup } from './fixtures.js';

async function checkAttribution(page, area) {
  const publisher = area.getByRole('link', { name: /By Vionix Consulting/ });
  await expect(publisher).toBeVisible();
  await expect(publisher).toHaveAttribute('href', 'https://vionix.cloud');
  await expect(publisher).toHaveAttribute('rel', 'noopener noreferrer');
  const summary = area.locator('summary').filter({ hasText: 'About vxTradeJournal' });
  await summary.focus();
  await page.keyboard.press('Enter');
  const about = area.locator('.project-information');
  await expect(about).toHaveAttribute('open', '');
  await expect(about.getByRole('link', { name: 'Project on GitHub' })).toHaveAttribute('href', 'https://github.com/vionix-th/vxTradeJournal');
  await expect(about.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', 'https://github.com/vionix-th/vxTradeJournal/issues');
  await expect(about).toContainText('App v0.2.0');
  await page.screenshot({ path: `/tmp/vionix-attribution-trade-${page.viewportSize().width}-${await page.locator('.sidebar').count() ? 'workspace' : 'signin'}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Space');
  await expect(about).not.toHaveAttribute('open', '');
}

test('publisher and project links work before sign-in', async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await checkAttribution(page, page.locator('.auth-shell'));
  }
});

test('workspace attribution stays available in light and dark themes', async ({ page, request }) => {
  await setup(page, request);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, width === 768 ? 'dark' : 'light');
    const route = page.url();
    await checkAttribution(page, page.locator('.sidebar'));
    expect(page.url()).toBe(route);
    await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  }
});

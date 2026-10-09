import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setup } from './fixtures.js';
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

async function checkAttribution(page, area) {
  const publisher = area.locator('a.brand');
  await expect(publisher).toBeVisible();
  await expect(publisher).toHaveAttribute('href', 'https://vionix.cloud');
  await expect(publisher).toHaveAttribute('rel', 'noopener noreferrer');
  const summary = area.getByRole('button', { name: 'About vxTradeJournal', exact: true });
  const more = area.getByRole('button', { name: 'More', exact: true, includeHidden: true });
  const compact = page.viewportSize().width <= 700 && await more.count() > 0;
  if (await more.count()) {
    if (compact) await expect(more).toBeVisible();
    else await expect(more).toBeHidden();
  }
  if (compact) await more.click();
  await summary.focus();
  await page.keyboard.press('Enter');
  const about = page.getByRole('dialog', { name: 'About vxTradeJournal' });
  await expect(about).toBeVisible();
  await expect(area.locator('details.project-information')).toHaveCount(0);
  await expect(publisher.locator('img')).toHaveAttribute('src', /vionix-logo\.png$/);
  await expect.poll(() => publisher.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => about.locator('.brand-logo').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(publisher.locator('strong')).toHaveText('vxTradeJournal');
  const logo = await publisher.locator('img').boundingBox();
  const copy = await publisher.locator('.brand-copy').boundingBox();
  expect(Math.abs(logo.y + logo.height / 2 - copy.y - copy.height / 2)).toBeLessThanOrEqual(2);
  await expect(area.locator('.project-actions > button svg')).toHaveCount(2);
  await expect(about.locator('.project-resource')).toHaveCount(3);
  await expect(about.locator('.about-footer')).toContainText(`App v${version}`);
  await expect(about.getByRole('link', { name: 'Project on GitHub' })).toHaveAttribute('href', 'https://github.com/vionix-th/vxTradeJournal');
  await expect(about.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', 'https://github.com/vionix-th/vxTradeJournal/issues');
  await expect(about).toContainText(`App v${version}`);
  await page.screenshot({ path: `/tmp/vionix-attribution-trade-${page.viewportSize().width}-${await page.locator('.sidebar').count() ? 'workspace' : 'signin'}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
  await expect(compact ? more : summary).toBeFocused();
}

test('publisher and project links work before sign-in', async ({ page }) => {
  for (const width of [320, 390, 768, 949, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await checkAttribution(page, page.locator('.auth-shell'));
  }
});

test('workspace attribution stays available in light and dark themes', async ({ page, request }) => {
  await setup(page, request);
  for (const width of [320, 390, 768, 949, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, width === 768 ? 'dark' : 'light');
    const route = page.url();
    await checkAttribution(page, page.locator('.sidebar'));
    expect(page.url()).toBe(route);
    await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  }
});

import { test, expect, setup } from './fixtures.js';

const key = 'vxTradeJournal.sidebar-collapsed';
const collapse = (page) => page.getByRole('button', { name: 'Collapse sidebar', exact: true });
const expand = (page) => page.getByRole('button', { name: 'Expand sidebar', exact: true });



test('collapse preserves live draft, remembers preference and exposes keyboard tooltips', async ({ page, request }) => {
  await setup(page, request);
  await page.getByRole('button', { name: 'New trade', exact: true }).click();
  const rationale = page.getByLabel('Entry rationale', { exact: true });
  await rationale.fill('Keep this unsaved draft');
  const route = page.url();
  await collapse(page).click();
  await expect(expand(page)).toBeFocused();
  await expect(rationale).toHaveValue('Keep this unsaved draft');
  expect(page.url()).toBe(route);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe('true');
  const journal = page.locator('.sidebar').getByRole('button', { name: 'Journal', exact: true });
  await journal.focus();
  const tip = page.getByRole('tooltip', { name: 'Journal', exact: true });
  await expect(tip).toBeVisible();
  const bounds = await tip.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await journal.hover();
  await expect(tip).toBeVisible();
  await page.locator('#main').evaluate((node) => node.dispatchEvent(new Event('scroll')));
  await expect(tip).toBeHidden();
  await expand(page).click();
  await expect(rationale).toHaveValue('Keep this unsaved draft');
  await collapse(page).click();
  // Explicitly discard the synthetic draft before reloading to test preference independently.
  page.once('dialog', (dialog) => dialog.accept());
  await journal.click();
  await page.reload();
  await expect(expand(page)).toBeVisible();
});

test('breakpoint transfers content scroll and restores visible focus without losing preference', async ({ page, request }) => {
  await page.setViewportSize({ width: 768, height: 954 });
  await setup(page, request);
  await collapse(page).click();
  await page.locator('.page-content').evaluate((node) => { node.style.minHeight = '2400px'; });
  await page.locator('#main').evaluate((node) => { node.scrollTop = 300; });
  await expect.poll(() => page.locator('#main').evaluate((node) => node.scrollTop)).toBe(300);
  await expand(page).evaluate((control) => control.focus({ preventScroll: true }));
  await expect(expand(page)).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(expand(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeFocused();
  await expect.poll(() => page.locator('#main').evaluate((node) => Math.round(-node.getBoundingClientRect().top))).toBe(300);
  await page.setViewportSize({ width: 768, height: 954 });
  await expect(expand(page)).toBeVisible();
  await expect.poll(() => page.locator('#main').evaluate((node) => Math.round(node.scrollTop))).toBe(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('unavailable local storage leaves collapse functional', async ({ page, request }) => {
  await page.addInitScript((storageKey) => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (name) {
      if (name === storageKey) throw new DOMException('Blocked', 'SecurityError');
      return get.call(this, name);
    };
    Storage.prototype.setItem = function (name, value) {
      if (name === storageKey) throw new DOMException('Blocked', 'SecurityError');
      return set.call(this, name, value);
    };
  }, key);
  await setup(page, request);
  await collapse(page).click();
  await expect(expand(page)).toBeVisible();
  await expand(page).click();
  await expect(collapse(page)).toBeVisible();
});

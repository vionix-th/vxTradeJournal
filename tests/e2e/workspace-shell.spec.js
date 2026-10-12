import { test, expect } from '@playwright/test';
import { setup } from './fixtures.js';

const key = 'vxTradeJournal.sidebar-collapsed';
const collapse = (page) => page.getByRole('button', { name: 'Collapse sidebar', exact: true });
const expand = (page) => page.getByRole('button', { name: 'Expand sidebar', exact: true });

for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 910, height: 480 }, { width: 1280, height: 800 }]) {
  test(`viewport shell and reachable footer at ${viewport.width}x${viewport.height}`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    await setup(page, request);
    await expect(page.locator(".workspace-bar").getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
    expect((await page.locator(".workspace-bar").boundingBox()).height).toBe(70);
    await expect(page.locator(".sidebar > .brand")).toBeVisible();
    await expect(page.locator(".sidebar .sidebar-toggle")).toHaveCount(0);
    await expect(collapse(page)).toHaveAttribute('aria-expanded', 'true');
    // Deliberately long content isolates the shell contract from journal row counts.
    await page.locator('.page-content').evaluate((node) => { node.style.minHeight = '2400px'; });
    const sidebarBefore = await page.locator('.sidebar').boundingBox();
    await page.locator('#main').evaluate((node) => { node.scrollTop = 300; });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.locator('#main').evaluate((node) => node.scrollTop)).toBe(300);
    expect(await page.locator('.sidebar').boundingBox()).toEqual(sidebarBefore);
    expect((await page.locator('.shell').boundingBox()).height).toBe(viewport.height);
    // The header scrolls with main; invoke directly to isolate scroll preservation.
    await collapse(page).evaluate((control) => control.click());
    await expect(expand(page)).toHaveAttribute('aria-expanded', 'false');
    expect((await page.locator('.sidebar').boundingBox()).width).toBe(64);
    expect(await page.locator('#main').evaluate((node) => node.scrollTop)).toBe(300);
    await page.locator('.session-profile p').evaluate((node) => { node.textContent = 'long-workspace-identity-for-layout@example.test'; });
    for (const name of ['Journal', 'Instruments', 'Strategies', 'Accounts', 'Settings', 'Reload records', 'Sign out', 'Download agent skill (ZIP)', 'About vxTradeJournal', 'Support this project']) {
      const control = page.locator('.sidebar').getByRole(name === 'Download agent skill (ZIP)' ? 'link' : 'button', { name, exact: true });
      await control.focus();
      const bounds = await control.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    expect(await page.locator('#main').evaluate((node) => node.scrollTop)).toBe(0);
    await page.screenshot({ path: `test-results/workspace-collapsed-${viewport.width}-${viewport.height}.png` });
  });
}

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

import { test, expect, setup } from './fixtures.js';

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
    await page.screenshot({ path: test.info().outputPath(`test-results/workspace-collapsed-${viewport.width}-${viewport.height}.png`.split("/").pop()) });
  });
}

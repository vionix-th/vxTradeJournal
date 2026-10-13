import { test, expect, setup } from './fixtures.js';

for (const viewport of [{ width: 838, height: 480 }, { width: 1024, height: 768 }]) {
  test(`expanded sidebar keeps its 224px contract and reachable footer at ${viewport.width}x${viewport.height}`, async ({ page, request }) => {
    await page.setViewportSize(viewport); await setup(page, request);
    await expect(page.getByRole('button', { name: 'Collapse sidebar', exact: true })).toBeVisible();
    expect((await page.locator('.sidebar').boundingBox()).width).toBe(224);
    await page.locator('.session-profile p').evaluate((node) => { node.textContent = 'long-workspace-identity-for-expanded-sidebar@example.test'; });
    for (const name of ['Reload records', 'Sign out', 'Download agent skill (ZIP)', 'About vxTradeJournal', 'Support this project']) {
      const control = page.locator('.sidebar').getByRole(name === 'Download agent skill (ZIP)' ? 'link' : 'button', { name, exact: true });
      await control.focus();
      const bounds = await control.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    if (viewport.height === 480) expect(await page.locator('.sidebar').evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath(`test-results/workspace-expanded-${viewport.width}-${viewport.height}.png`.split("/").pop()) });
  });
}

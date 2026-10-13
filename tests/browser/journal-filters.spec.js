import { test, expect, setup } from './fixtures.js';
async function journal(page) {
  await setup(page);
  await page.evaluate(() => {
    const ui = window.fixtureUI;
    ui.data.accounts.push({ ...ui.data.accounts[0], id: 'stablecoin', currency: 'USDC' });
    ui.go('journal');
  });
}
for (const width of [320, 838, 1024, 1440]) {
  test(`permanent search/filter bands fit ${width}px with both sidebar states`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 924 });
    await journal(page, request);
    const toolbar = page.getByRole('form', { name: 'Journal search and filters', exact: true });
    for (const collapsed of width > 700 ? [false, true] : [false]) {
      if (collapsed) await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      await expect(page.getByText('More filters', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Apply filters', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toBeHidden();
      for (const name of ['Search instruments', 'Filter account', 'Filter status', 'Filter market', 'Filter strategy', 'Filter tag', 'Date basis', 'From', 'To']) {
        const control = toolbar.getByLabel(name, { exact: true });
        await expect(control).toBeVisible();
        const bounds = await control.boundingBox();
        const band = await toolbar.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(band.x);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(band.x + band.width + 1);
      }
      const search = await toolbar.locator('.search-field').boundingBox();
      const filters = await toolbar.locator('.journal-filter-band').boundingBox();
      expect(filters.y).toBeGreaterThanOrEqual(search.y + search.height + 11);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`test-results/journal-filters-${width}-${collapsed ? 'collapsed' : 'expanded'}.png`.split("/").pop()), fullPage: true });
    }
  });
}

import { test, expect } from '@playwright/test';
import { setup } from './fixtures.js';
import { savedTrade } from './audit-editor-fixtures.js';

async function journal(page, request, count = 1) {
  await setup(page, request); await savedTrade(page);
  await page.evaluate(async (count) => {
    const { auth, db } = await import('/src/persistence/firebase.js');
    const { Repository } = await import('/src/persistence/repository.js');
    const { createTrade } = await import('/src/domain/journal.js');
    const repo = new Repository(db, auth.currentUser.uid, () => auth.currentUser.emailVerified);
    const data = await repo.load();
    const account = await repo.saveEntity('accounts', { ...data.accounts[0], name: 'Long account name used for responsive journal controls' });
    const strategy = await repo.saveEntity('strategies', { id: 'filter-strategy', name: 'Long strategy name used for responsive journal controls' });
    for (let index = 1; index < count; index++) {
      const trade = createTrade({ id: `journal-filter-${index}`, account, instruments: [{ instrument: data.instruments[0], direction: 'long' }], strategy });
      trade.tags = [index % 2 ? 'blue' : 'red'];
      await repo.saveTrade(trade, `journal-filter-operation-${index}`);
    }
  }, count);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
}
const history = (page) => page.getByRole('region', { name: 'Trades', exact: true });
const countBadge = (page) => history(page).locator('.count-badge');

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
      await page.screenshot({ path: `test-results/journal-filters-${width}-${collapsed ? 'collapsed' : 'expanded'}.png`, fullPage: true });
    }
  });
}

test('live filtering keeps controls, typing focus, selection and available scroll position', async ({ page, request }) => {
  await page.setViewportSize({ width: 838, height: 924 });
  await journal(page, request, 25);
  const search = page.getByLabel('Search instruments', { exact: true });
  await page.evaluate(() => { window.journalSearchNode = document.querySelector('[name="search"]'); });
  await search.fill('AUDIT');
  await expect(countBadge(page)).toHaveText('25');
  await search.press('Enter');
  await expect(search).toBeFocused();
  expect(await search.evaluate((node) => node === window.journalSearchNode)).toBe(true);
  expect(await search.evaluate((node) => [node.selectionStart, node.selectionEnd])).toEqual([5, 5]);
  await page.locator('#main').evaluate((node) => { node.scrollTop = 80; });
  await page.getByLabel('Filter tag', { exact: true }).fill('blue');
  await expect(countBadge(page)).toHaveText('12');
  expect(await page.locator('#main').evaluate((node) => node.scrollTop)).toBe(80);
  await expect(page.getByLabel('Filter tag', { exact: true })).toBeFocused();
  expect(await search.evaluate((node) => node === window.journalSearchNode)).toBe(true);
  await page.getByLabel('Filter strategy', { exact: true }).selectOption('filter-strategy');
  await expect(countBadge(page)).toHaveText('12');
  await page.getByLabel('Filter account', { exact: true }).selectOption({ index: 1 });
  await expect(countBadge(page)).toHaveText('12');
  await page.getByLabel('Filter status', { exact: true }).selectOption('closed');
  await expect(countBadge(page)).toHaveText('0');
  await expect(page.locator('.overview-card').nth(1).locator('.overview-value')).toHaveText('25');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(countBadge(page)).toHaveText('25');
  await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toBeHidden();
});

test('invalid date draft keeps last valid range while status changes still apply', async ({ page, request }) => {
  await journal(page, request);
  const from = page.getByLabel('From', { exact: true });
  const to = page.getByLabel('To', { exact: true });
  await from.fill('2000-01-01'); await to.fill('2099-12-31');
  await expect(countBadge(page)).toHaveText('1');
  await to.fill('1999-12-31');
  await expect(to).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('End date must be on or after start date. Results still use the previous valid date range (Opened: 2000-01-01 to 2099-12-31).', { exact: true })).toBeVisible();
  await expect(countBadge(page)).toHaveText('1');
  const description = await to.getAttribute('aria-describedby');
  expect(description).toMatch(/-error/);
  await page.getByLabel('Filter status', { exact: true }).selectOption('closed');
  await expect(countBadge(page)).toHaveText('0');
  await to.fill('2099-12-31');
  await expect(to).not.toHaveAttribute('aria-invalid');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(from).toHaveValue(''); await expect(to).toHaveValue('');
  await expect(countBadge(page)).toHaveText('1');
});

test('pagination preserves equivalent filters and restores focus when Next becomes disabled', async ({ page, request }) => {
  await journal(page, request, 25);
  const search = page.getByLabel('Search instruments', { exact: true });
  await search.fill('AUDIT'); await search.press('Enter');
  await history(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(history(page)).toContainText('page 2 of 3');
  await expect(history(page).getByRole('button', { name: 'Next', exact: true })).toBeFocused();
  await search.fill(' audit '); await search.press('Enter');
  await expect(history(page)).toContainText('page 2 of 3');
  await history(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(history(page)).toContainText('page 3 of 3');
  await expect(history(page).getByRole('heading', { name: 'Trades', exact: false })).toBeFocused();
  await page.getByLabel('Filter tag', { exact: true }).fill('blue');
  await expect(history(page)).toContainText('page 1 of 1');
});

test('departure cancels pending updates and returning restores latest filter draft', async ({ page, request }) => {
  await journal(page, request);
  await page.evaluate(() => {
    const search = document.querySelector('[name="search"]');
    search.value = 'DOES_NOT_MATCH'; search.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-route="accounts"]').click();
  });
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  // Wait past the specified debounce to prove it cannot replace the destination screen.
  await page.waitForTimeout(300);
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(page.getByLabel('Search instruments', { exact: true })).toHaveValue('DOES_NOT_MATCH');
  await expect(countBadge(page)).toHaveText('0');
});

test('tag suggestions use all journal tags and keyboard selection preserves exact values', async ({ page, request }) => {
  await journal(page, request, 25);
  const tag = page.getByRole('combobox', { name: 'Filter tag', exact: true });
  await tag.focus();
  const list = page.getByRole('listbox', { name: 'Tag suggestions', exact: true });
  await expect(list.getByRole('option')).toHaveText(['blue', 'red']);
  await tag.fill('BL');
  await expect(list.getByRole('option')).toHaveText(['blue']);
  await tag.press('ArrowDown');
  const active = await tag.getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${active}"]`)).toHaveText('blue');
  await tag.press('Enter');
  await expect(tag).toHaveValue('blue');
  await expect(tag).toBeFocused();
  await expect(tag).toHaveAttribute('aria-expanded', 'false');
  await expect(countBadge(page)).toHaveText('12');
  await page.getByLabel('Filter status', { exact: true }).selectOption('closed');
  await expect(countBadge(page)).toHaveText('0');
  await tag.fill('');
  await expect(list.getByRole('option')).toHaveText(['blue', 'red']);
  await tag.press('Escape');
  await expect(tag).toHaveAttribute('aria-expanded', 'false');
  await expect(tag).toBeFocused();
  await tag.click();
  await expect(list).toBeVisible();
  await page.getByLabel('Filter account', { exact: true }).focus();
  await expect(tag).toHaveAttribute('aria-expanded', 'false');
});

test('empty/unmatched tag suggestions dismiss without committing and navigation disposes popup', async ({ page, request }) => {
  await journal(page, request);
  const tag = page.getByRole('combobox', { name: 'Filter tag', exact: true });
  await tag.focus();
  await expect(page.getByText('No tags available', { exact: true })).toBeVisible();
  await tag.press('Tab');
  await expect(tag).toHaveAttribute('aria-expanded', 'false');
  await tag.fill('missing'); await tag.press('Enter');
  await expect(tag).toHaveValue('missing');
  await expect(countBadge(page)).toHaveText('0');
  await tag.click();
  await expect(tag).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await expect(page.locator('.tag-suggestions:popover-open')).toHaveCount(0);
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Filter tag', exact: true })).toHaveValue('missing');
});

test('long tag suggestion list stays inside viewport and scrolls to virtual focus', async ({ page }) => {
  await page.setViewportSize({ width: 838, height: 924 });
  await page.goto('/');
  await page.evaluate(async () => {
    const { field } = await import('/src/ui/components.js');
    const { tagAutocomplete } = await import('/src/ui/tag-autocomplete.js');
    const tag = field('Test tag', 'test-tag', '');
    tag.node.style.cssText = 'position:fixed;left:200px;bottom:16px;width:180px;';
    document.body.append(tag.node);
    window.syntheticTag = tagAutocomplete(tag, [{ tags: Array.from({ length: 30 }, (_, index) => `Tag ${String(index).padStart(2, '0')} ${'long-unbroken-label'.repeat(6)}`) }], () => {});
    tag.control.focus();
  });
  const tag = page.getByRole('combobox', { name: 'Test tag', exact: true });
  const menu = page.locator('.tag-suggestions:popover-open');
  const bounds = await menu.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(838);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(924);
  await expect(menu.getByRole('option')).toHaveCount(30);
  await tag.fill('not-present');
  await expect(page.getByText('No matching tags', { exact: true })).toBeVisible();
  await tag.fill('');
  for (let index = 0; index < 30; index++) await tag.press('ArrowDown');
  const row = page.locator(`[id="${await tag.getAttribute('aria-activedescendant')}"]`);
  const rowBounds = await row.boundingBox(), menuBounds = await menu.boundingBox();
  expect(rowBounds.y).toBeGreaterThanOrEqual(menuBounds.y);
  expect(rowBounds.y + rowBounds.height).toBeLessThanOrEqual(menuBounds.y + menuBounds.height);
  await page.screenshot({ path: 'test-results/journal-tag-long-suggestions.png' });
});

test.describe('touch tag selection', () => {
  test.use({ hasTouch: true });
  test('tapping suggestion selects once and keeps input focus', async ({ page, request }) => {
    await page.setViewportSize({ width: 838, height: 924 });
    await journal(page, request, 25);
    const tag = page.getByRole('combobox', { name: 'Filter tag', exact: true });
    await tag.tap();
    const row = page.getByRole('listbox', { name: 'Tag suggestions', exact: true }).getByRole('option', { name: 'red', exact: true });
    expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await row.tap();
    await expect(tag).toHaveValue('red');
    await expect(tag).toBeFocused();
    await expect(tag).toHaveAttribute('aria-expanded', 'false');
    await expect(countBadge(page)).toHaveText('12');
  });
});

async function addOverviewResults(page, addEuro = false) {
  await page.evaluate(async (addEuro) => {
    const { auth, db } = await import('/src/persistence/firebase.js');
    const { Repository } = await import('/src/persistence/repository.js');
    const { createTrade, PRESETS } = await import('/src/domain/journal.js');
    const repo = new Repository(db, auth.currentUser.uid, () => auth.currentUser.emailVerified);
    const data = await repo.load();
    const { label: _label, ...preset } = PRESETS.equity;
    async function closed(id, account, instrument, exitPrice) {
      const value = createTrade({ id, account, instruments: [{ instrument, direction: 'long' }] });
      value.executions = [
        { id: `${id}-entry`, legId: value.legs[0].id, kind: 'entry', quantity: '1', price: '100', fees: '0', feeCurrency: instrument.currency, timestamp: '2026-01-01T00:00:00Z' },
        { id: `${id}-exit`, legId: value.legs[0].id, kind: 'exit', quantity: '1', price: exitPrice, fees: '0', feeCurrency: instrument.currency, timestamp: '2026-01-02T00:00:00Z' },
      ];
      await repo.saveTrade(value, `${id}-operation`);
    }
    if (!addEuro) {
      const instrument = await repo.saveEntity('instruments', { ...preset, id: 'overview-usd-share', name: 'USD share', symbol: 'USDTEST', preset: 'equity', currency: 'USD' });
      const other = await repo.saveEntity('accounts', { id: 'overview-other', name: 'Other active account', currency: 'USD' });
      await closed('overview-main', data.accounts[0], instrument, '110.10');
      await closed('overview-other-trade', other, instrument, '102.20');
    } else {
      const euro = await repo.saveEntity('accounts', { id: 'overview-eur', name: 'Euro account', currency: 'EUR' });
      const instrument = await repo.saveEntity('instruments', { ...preset, id: 'overview-eur-share', name: 'EUR share', symbol: 'EURTEST', preset: 'equity', currency: 'EUR' });
      await closed('overview-eur-trade', euro, instrument, '98.50');
      await closed('overview-incomplete', euro, await repo.getEntity('instruments', 'overview-usd-share'), '110');
    }
  }, addEuro);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
}
for (const width of [320, 838, 1440]) {
  test(`realized net sums same currencies and labels mixed totals at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 924 });
    await journal(page, request);
    await addOverviewResults(page);
    const card = page.locator('.overview-card').first();
    await expect(card.locator('.overview-value')).toHaveText('+12.30 USD');
    await expect(card).toContainText('All accounts');
    await addOverviewResults(page, true);
    await expect(card.locator('.overview-currency-total')).toHaveText(['-1.50 EUR', '+12.30 USD']);
    await expect(card).toContainText('1 incomplete trade excluded');
    await page.getByLabel('Filter tag', { exact: true }).fill('no-matching-tag');
    await expect(countBadge(page)).toHaveText('0');
    await expect(card.locator('.overview-currency-total')).toHaveText(['-1.50 EUR', '+12.30 USD']);
    await page.getByLabel('Filter tag', { exact: true }).press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/journal-currency-totals-${width}.png`, fullPage: true });
    await page.getByLabel('Filter account', { exact: true }).selectOption('overview-other');
    await expect(card.locator('.overview-value')).toHaveText('+2.20 USD');
    await page.getByLabel('Filter account', { exact: true }).selectOption('overview-eur');
    await expect(card.locator('.overview-value')).toHaveText('-1.50 EUR');
    await expect(card).toContainText('1 incomplete trade excluded');
  });
}

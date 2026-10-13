import { test, expect, setup } from './fixtures.js';
import { savedTrade } from './audit-editor-fixtures.js';

async function seed(page, request) {
  await setup(page, request); await savedTrade(page);
  await page.evaluate(async () => {
    const { auth, db } = await import('/src/persistence/firebase.js');
    const { Repository } = await import('/src/persistence/repository.js');
    const { createTrade } = await import('/src/domain/journal.js');
    const repo = new Repository(db, auth.currentUser.uid, () => auth.currentUser.emailVerified);
    const data = await repo.load();
    await repo.saveEntity('settings', { ...await repo.getSettings(), timezone: 'UTC' });
    const account = await repo.saveEntity('accounts', { ...data.accounts[0], name: 'Long account identity for history comparison across narrow screens' });
    const strategy = await repo.saveEntity('strategies', { id: 'history-strategy', name: 'Long strategy identity for lifecycle and realized outcome review' });
    const instrument = data.instruments[0];
    for (const [id, opened, closed] of [['earlier', '2090-01-01T10:00:00Z', '2090-02-10T11:00:00Z'], ['later', '2090-02-01T10:00:00Z', '2090-02-09T11:00:00Z']]) {
      const trade = createTrade({ id, account, strategy, instruments: [{ instrument, direction: 'long' }] });
      trade.tags = ['long-tag-content-that-wraps-without-hiding-trading-context', 'review'];
      trade.executions = [['entry', opened], ['exit', closed]].map(([kind, timestamp], index) => ({
        id: `${id}-${kind}`, legId: trade.legs[0].id, kind, timestamp, quantity: '1', price: index ? '12' : '10', fees: '0', feeCurrency: account.currency,
      }));
      await repo.saveTrade(trade, `${id}-create`);
    }
    const combination = createTrade({ id: 'combination', account, strategy, instruments: [{ instrument, direction: 'long' }, { instrument, direction: 'short' }] });
    combination.adjustments = [{ id: 'foreign-cost', timestamp: '2090-02-11T00:00:00Z', amount: '-1', currency: 'EUR', rate: null, reason: 'Foreign cost without conversion' }];
    await repo.saveTrade(combination, 'combination-create');
    const earlier = await repo.getTrade('earlier');
    await repo.saveTrade({ ...earlier, review: 'Later context edit must not move lifecycle dates' }, 'earlier-review');
  });
  await page.getByRole('button', { name: 'Journal', exact: true }).click(); await page.reload();
  await expect(page.getByRole('region', { name: 'Trades', exact: true })).toBeVisible();
}
const history = (page) => page.getByRole('region', { name: 'Trades', exact: true });
const visibleRecords = (page) => history(page).locator('[data-trade-id]').filter({ visible: true });



test('sort changes preserve controls, focus and scroll; date basis and navigation retain state', async ({ page, request }) => {
  await page.setViewportSize({ width: 838, height: 500 }); await seed(page, request);
  const sort = history(page).getByLabel('Sort by', { exact: true });
  await page.evaluate(() => { window.historySortNode = document.querySelector('[name="sort"]'); document.querySelector('main').scrollTop = 300; });
  await sort.focus();
  const scroll = await page.locator('main').evaluate((main) => main.scrollTop);
  await sort.selectOption('closed');
  await expect(sort).toBeFocused();
  expect(await page.evaluate(() => document.querySelector('[name="sort"]') === window.historySortNode)).toBe(true);
  expect(await page.locator('main').evaluate((main) => main.scrollTop)).toBe(scroll);
  await expect(visibleRecords(page).first()).toHaveAttribute('data-trade-id', 'earlier');
  await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toBeHidden();
  await page.getByLabel('From', { exact: true }).fill('2090-02-09');
  await page.getByLabel('To', { exact: true }).fill('2090-02-10');
  await expect(history(page).locator('.count-badge')).toHaveText('0');
  await page.getByLabel('Date basis', { exact: true }).selectOption('closed');
  await expect(history(page).locator('.count-badge')).toHaveText('2');
  await expect(page.getByRole('status').filter({ hasText: '2 matching trades' })).toHaveAttribute('aria-live', 'polite');
  await page.getByLabel('To', { exact: true }).fill('2090-02-08');
  await page.getByLabel('Date basis', { exact: true }).selectOption('opened');
  await expect(page.getByText(/previous valid date range \(Closed:/)).toBeVisible();
  await expect(history(page).locator('.count-badge')).toHaveText('2');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByLabel('Search instruments', { exact: true })).toBeFocused();
  await expect(sort).toHaveValue('closed');
  await expect(page.getByLabel('Date basis', { exact: true })).toHaveValue('opened');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(history(page).getByLabel('Sort by', { exact: true })).toHaveValue('closed');
  await expect(history(page).getByRole('button', { name: /^View details for AUDIT in / }).filter({ visible: true }).first()).toBeVisible();
  await history(page).getByRole('button', { name: /^View details for AUDIT in / }).filter({ visible: true }).first().click();
  await expect(page.getByRole('button', { name: 'Edit trade', exact: true })).toBeVisible();
});

test('native sort type-ahead and View details work through keyboard navigation', async ({ page, request }) => {
  await page.setViewportSize({ width: 838, height: 924 }); await seed(page, request);
  const sort = history(page).getByLabel('Sort by', { exact: true });
  await sort.focus(); await sort.press('c');
  await expect(sort).toHaveValue('closed'); await expect(sort).toBeFocused();
  const order = history(page).getByLabel('Order', { exact: true });
  await order.focus(); await order.press('o');
  await expect(order).toHaveValue('asc');
  await expect(visibleRecords(page).first()).toHaveAttribute('data-trade-id', 'later');
  await order.press('Tab');
  const action = history(page).getByRole('button', { name: /^View details for / }).filter({ visible: true }).first();
  await expect(action).toBeFocused(); await action.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit trade', exact: true })).toBeVisible();
});

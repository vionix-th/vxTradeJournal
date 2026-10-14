import { test, expect, setup } from './fixtures.js';
async function seed(page) {
 await setup(page);
 await page.evaluate(async () => {
 const { createTrade } = await import('/src/domain/journal.js');
 const { prepareTrade } = await import('/src/application/journal.js');
 const ui = window.fixtureUI, data = ui.data;
 for (const [id, opened, closed] of [['earlier','2090-01-01T10:00:00Z','2090-02-10T11:00:00Z'],['later','2090-02-01T10:00:00Z','2090-02-09T11:00:00Z']]) {
 const trade = createTrade({id,account:data.accounts[0],strategy:data.strategies[0],instruments:[{instrument:data.instruments[0],direction:'long'}]});
 trade.createdAt='2089-01-01T00:00:00Z'; trade.updatedAt='2090-03-01T00:00:00Z'; trade.tags=['long-tag-content-that-wraps-without-hiding-trading-context','review'];
 trade.executions=[['entry',opened],['exit',closed]].map(([kind,timestamp],index)=>({id:id+'-'+kind,legId:trade.legs[0].id,kind,timestamp,quantity:'1',price:index?'12':'10',fees:'0',feeCurrency:'USD'}));
 data.trades.push(prepareTrade(trade,data));
 }
 const combination=createTrade({id:'combination',account:data.accounts[0],instruments:[{instrument:data.instruments[0],direction:'long'},{instrument:data.instruments[0],direction:'short'}]});
 combination.createdAt='2089-01-01T00:00:00Z'; combination.adjustments=[{id:'cost',timestamp:'2090-02-11T00:00:00Z',amount:'-1',currency:'EUR',rate:null,reason:'Missing conversion'}];
 data.trades.push(prepareTrade(combination,data)); ui.go('journal');
 });
}
const history = page=>page.getByRole('region',{name:'Trades',exact:true});
const visibleRecords = page=>history(page).locator('[data-trade-id]').filter({visible:true});
test('ordinary history card uses compact rows at intermediate width', async ({ page }) => {
  await page.setViewportSize({ width: 838, height: 924 });
  await seed(page);
  await page.evaluate(() => {
    const ui = window.fixtureUI;
    ui.data.accounts[0].name = 'DEX Wallet EU A1';
    ui.data.trades = ui.data.trades.filter((trade) => trade.id === 'later');
    const trade = ui.data.trades[0];
    trade.strategySnapshot.name = 'Support/resistance holding';
    trade.tags = ['hyperliquid', 'historical-import', 'dex-wallet-eu-a1'];
    ui.go('journal');
  });
  const card = visibleRecords(page).first();
  await expect(card).toBeVisible();
  expect((await card.boundingBox()).height).toBeLessThanOrEqual(264);
  const sameLine = async (first, second) => {
    const a = await first.boundingBox(), b = await second.boundingBox();
    expect(Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)).toBeGreaterThan(0);
  };
  await sameLine(card.locator('.history-instrument strong'), card.locator('.history-direction'));
  for (const row of await card.locator('.history-card-dates > div').all()) {
    await sameLine(row.locator('dt'), row.locator('time'));
    const time = row.locator('time');
    expect((await time.boundingBox()).height).toBeLessThanOrEqual(20);
  }
  await expect(card.locator('.history-result-label')).toHaveClass(/visually-hidden/);
  await expect(card.locator('.history-result-label')).toHaveText('Realized net');
  const fields = card.locator('.history-context > div');
  await expect(fields.filter({ has: page.locator('dt', { hasText: /^Account$/ }) }).locator('dd')).toHaveText('DEX Wallet EU A1');
  await expect(fields.filter({ has: page.locator('dt', { hasText: /^Strategy$/ }) }).locator('dd')).toHaveText('Support/resistance holding');
  await sameLine(fields.nth(0), fields.nth(1));
  await expect(card.getByRole('list', { name: 'Tags', exact: true }).getByRole('listitem')).toHaveText(['hyperliquid', 'historical-import', 'dex-wallet-eu-a1']);
  const details = card.getByRole('button', { name: /^View details for / });
  expect((await details.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await details.click();
  await expect(page.getByRole('heading', { name: 'Trade details', exact: true })).toBeVisible();
});
for (const width of [320, 838, 1024, 1440]) test(`history comparison fits panel width at ${width}px in both sidebar states`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 924 }); await seed(page, request);
  for (const collapsed of width > 700 ? [false, true] : [false]) {
    if (collapsed) await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    const wide = await history(page).evaluate((panel) => panel.clientWidth - parseFloat(getComputedStyle(panel).paddingLeft) - parseFloat(getComputedStyle(panel).paddingRight) >= 900);
    if (wide) { await expect(history(page).locator('.history-table-wrap')).toBeVisible(); await expect(history(page).locator('.history-cards')).toBeHidden(); }
    else { await expect(history(page).locator('.history-table-wrap')).toBeHidden(); await expect(history(page).locator('.history-cards')).toBeVisible(); }
    await expect(visibleRecords(page).first()).toHaveAttribute('data-trade-id', 'later');
    const firstRecord = visibleRecords(page).first();
    const context = firstRecord.locator('.history-context > div');
    await expect(context.locator('dt')).toHaveText(['Account', 'Strategy']);
    await expect(context.locator('dd')).toHaveText(['Long account identity for history comparison across narrow screens', 'Long strategy identity for lifecycle and realized outcome review']);
    await expect(firstRecord.getByRole('list', { name: 'Tags', exact: true }).getByRole('listitem')).toHaveText(['long-tag-content-that-wraps-without-hiding-trading-context', 'review']);
    for (const label of await context.locator('dt').all()) await expect(label).toHaveClass(/visually-hidden/);
    const chips = await firstRecord.getByRole('list', { name: 'Tags', exact: true }).boundingBox();
    if (!wide) {
      const rows = firstRecord.locator('.history-card-dates > div');
      const valueStart = (await rows.first().locator('dd').boundingBox()).x;
      const labelStart = (await rows.first().locator('dt').boundingBox()).x;
      for (const row of await rows.all()) {
        expect((await row.locator('dt').boundingBox()).x).toBeCloseTo(labelStart, 0);
        expect((await row.locator('dd').boundingBox()).x).toBeCloseTo(valueStart, 0);
      }
      const dates = await firstRecord.locator('.history-card-dates').boundingBox();
      const footer = await firstRecord.locator('.history-card-footer').boundingBox();
      expect(chips.y - (footer.y + footer.height)).toBeCloseTo(12, 0);
      await expect(firstRecord.locator(':scope > :last-child')).toHaveAttribute('aria-label', 'Tags');
      const details = await firstRecord.getByRole('button', { name: /^View details for / }).boundingBox();
      expect(details.x + details.width).toBeCloseTo(dates.x + dates.width, 0);
      if (width === 320) {
        const outcome = await firstRecord.locator('.history-outcome').boundingBox();
        expect(details.y - (outcome.y + outcome.height)).toBeGreaterThanOrEqual(8);
      }
    } else {
      const fields = await firstRecord.locator('.history-context').boundingBox();
      expect(chips.y - (fields.y + fields.height)).toBeCloseTo(12, 0);
    }
    await expect(history(page).getByText('Not entered', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(history(page).getByText('Realized so far', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(history(page).getByText('Combination · 2 legs', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(history(page).getByText('Incomplete · USD', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(history(page).getByText('Dates and times: UTC', { exact: true })).toBeVisible();
    for (const control of [history(page).getByLabel('Sort by', { exact: true }), history(page).getByLabel('Order', { exact: true }), ...await history(page).getByRole('button', { name: /^View details for / }).filter({ visible: true }).all()]) {
      expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    const metrics = await history(page).evaluate((panel) => ({ width: panel.clientWidth, scroll: panel.scrollWidth }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (width === 320) expect(await visibleRecords(page).first().locator('.history-card-dates').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(1);
    await page.screenshot({ path: test.info().outputPath(`test-results/journal-history-${width}-${collapsed ? 'collapsed' : 'expanded'}.png`.split("/").pop()), fullPage: true });
  }
});

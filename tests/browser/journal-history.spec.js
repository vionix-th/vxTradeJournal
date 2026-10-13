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
for (const width of [320, 838, 1024, 1440]) test(`history comparison fits panel width at ${width}px in both sidebar states`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 924 }); await seed(page, request);
  for (const collapsed of width > 700 ? [false, true] : [false]) {
    if (collapsed) await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    const wide = await history(page).evaluate((panel) => panel.clientWidth - parseFloat(getComputedStyle(panel).paddingLeft) - parseFloat(getComputedStyle(panel).paddingRight) >= 900);
    if (wide) { await expect(history(page).locator('.history-table-wrap')).toBeVisible(); await expect(history(page).locator('.history-cards')).toBeHidden(); }
    else { await expect(history(page).locator('.history-table-wrap')).toBeHidden(); await expect(history(page).locator('.history-cards')).toBeVisible(); }
    await expect(visibleRecords(page).first()).toHaveAttribute('data-trade-id', 'later');
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

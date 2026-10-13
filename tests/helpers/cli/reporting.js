import { it, expect } from 'vitest';
import { createTrade } from '../../../src/domain/journal.js';
export function register(context) {
 const { cli, prerequisites } = context;
it('reports opening and closing chronology without changing default ordering or summary/export contracts', async () => {

  const repo = await prerequisites({ instrument: true });
  const account = await repo.getEntity('accounts', 'a'), instrument = await repo.getEntity('instruments', 'i');
  for (const [id, opened, closed] of [['older', '2026-01-01T10:00:00Z', '2026-02-10T00:30:00Z'], ['newer', '2026-02-01T10:00:00Z', '2026-02-09T00:30:00Z']]) {
    const trade = createTrade({ id, account, instruments: [{ instrument, direction: 'long' }] });
    trade.executions = [['entry', opened], ['exit', closed]].map(([kind, timestamp], index) => ({ id: `${id}-${kind}`, kind, timestamp,
      legId: trade.legs[0].id, quantity: '1', price: index ? '12' : '10', fees: '0', feeCurrency: 'USD' }));
    await repo.saveTrade(trade, `${id}-create`);
  }
  const older = await repo.getTrade('older');
  await repo.saveTrade({ ...older, review: 'Later review' }, 'older-review');
  const before = (await cli('export')).body.data.trades;
  const ordinary = await cli('journal list'); expect(ordinary.code).toBe(0);
  expect(ordinary.body.data.items.map((trade) => trade.id)).toEqual(['older', 'newer']);
  const opened = await cli('journal list', undefined, { sort: 'opened', order: 'desc' });
  expect(opened.code).toBe(0); expect(opened.body.data.items.map((trade) => trade.id)).toEqual(['newer', 'older']);
  const closed = await cli('journal list', undefined, { sort: 'closed', order: 'asc', 'page-size': 1 });
  expect(closed.code).toBe(0); expect(closed.body.data).toMatchObject({ total: 2, pages: 2, page: 1 });
  expect(closed.body.data.items).toEqual([ordinary.body.data.items[1]]);
  expect(closed.body.data.items[0]).not.toHaveProperty('executions');
  expect(closed.body.data.items[0].summary).not.toHaveProperty('closedAt');
  const range = await cli('journal list', undefined, { 'date-basis': 'closed', from: '2026-02-09', to: '2026-02-09', timezone: 'America/New_York' });
  expect(range.code).toBe(0); expect(range.body.data.items.map((trade) => trade.id)).toEqual(['older']);
  const invalid = await cli('journal list', undefined, { sort: 'created' });
  expect(invalid.code).toBe(2); expect(invalid.body.error.code).toBe('VALIDATION');
  expect((await cli('export')).body.data.trades).toEqual(before);
}, 30000);

it("reproduces PRD sizing and scaled-fill fixtures through the CLI", async () => {

  expect((await cli("accounts create", { id: "acceptance-account", name: "Acceptance", currency: "USD" })).code).toBe(0);
  for (const instrument of [
    { id: "contracts", name: "Contracts", symbol: "CONTRACT", pointValue: "50", quantityIncrement: "1", currency: "USD" },
    { id: "fractional", name: "Fractional FX", symbol: "FXROUND", pointValue: "1", quantityIncrement: "0.1", currency: "EUR" },
    { id: "scaled", name: "Scaled equity", symbol: "SCALE", pointValue: "1", quantityIncrement: "1", currency: "USD" },
  ]) expect((await cli("instruments create", { ...instrument, preset: "equity" })).code).toBe(0);
  for (const [instrumentId, planning, quantity] of [
    ["contracts", { entry: "10", stop: "8", riskBudget: "500" }, "5"],
    ["fractional", { entry: "10", stop: "7", riskBudget: "1", rate: "0.8" }, "0.4"],
  ]) {
    const id = `sizing-${instrumentId}`;
    expect((await cli("trades create", { id, accountId: "acceptance-account", legs: [{ id: "sizing-leg", instrumentId, direction: "long", planning }] }, { "operation-id": id })).code).toBe(0);
    expect((await cli("calculate size", undefined, { trade: id, leg: "sizing-leg" })).body.data.quantity).toBe(quantity);
  }
  let saved = await cli("trades create", { id: "scaled-fixture", accountId: "acceptance-account", legs: [{ id: "scaled-leg", instrumentId: "scaled", direction: "long" }] }, { "operation-id": "scaled-create" });
  const fills = [["entry", "100", "10"], ["entry", "100", "12"], ["exit", "50", "13"], ["entry", "50", "10"], ["exit", "200", "12"]];
  for (const [index, [kind, quantity, price]] of fills.entries()) {
    saved = await cli("executions add", { id: `scaled-${index}`, legId: "scaled-leg", kind, quantity, price, timestamp: `2026-01-0${index + 1}T00:00:00Z` }, { trade: "scaled-fixture", revision: saved.body.data.trade.revision, "operation-id": `scaled-${index}` });
    expect(saved.code).toBe(0);
    if (index === 2) expect(saved.body.data.trade.summary.legs[0]).toMatchObject({ remaining: "150", averageEntry: "11", gross: "100" });
    if (index === 3) expect(saved.body.data.trade.summary.legs[0]).toMatchObject({ remaining: "200", averageEntry: "10.75", gross: "100" });
  }
  expect(saved.body.data.trade.summary).toMatchObject({ status: "closed", accountNet: "350" });
  expect((await cli("calculate trade", undefined, { id: "scaled-fixture" })).body.data.calculation.accountNet).toBe("350");
  expect((await cli("export")).body.data.trades.find((trade) => trade.id === "scaled-fixture").summary.accountNet).toBe("350");
}, 90000);

it('reports independently expected active-account currency totals and incomplete records', async () => {

  const repo = await prerequisites({ instrument: true });
  const { createTrade, PRESETS } = await import('../../../src/domain/journal.js');
  const main = await repo.getEntity('accounts', 'a');
  const other = await repo.saveEntity('accounts', { id: 'other-usd', name: 'Other USD', currency: 'USD' });
  const usdInstrument = await repo.getEntity('instruments', 'i');
  async function closed(id, account, instrument, exitPrice) {
    const value = createTrade({ id, account, instruments: [{ instrument, direction: 'long' }] });
    value.executions = [
      { id: `${id}-entry`, legId: value.legs[0].id, kind: 'entry', quantity: '1', price: '100', fees: '0', feeCurrency: instrument.currency, timestamp: '2026-01-01T00:00:00Z' },
      { id: `${id}-exit`, legId: value.legs[0].id, kind: 'exit', quantity: '1', price: exitPrice, fees: '0', feeCurrency: instrument.currency, timestamp: '2026-01-02T00:00:00Z' },
    ];
    return repo.saveTrade(value, `${id}-operation`);
  }
  await closed('main-result', main, usdInstrument, '450');
  await closed('other-result', other, usdInstrument, '200');
  const same = await cli('journal overview');
  expect(same.code).toBe(0);
  expect(same.body.data).toMatchObject({ account: null, net: '450', currency: 'USD', total: 2, currencyTotals: [{ currency: 'USD', net: '450', complete: 2, incomplete: 0 }] });
  const euro = await repo.saveEntity('accounts', { id: 'euro-reporting', name: 'Euro', currency: 'EUR' });
  const { label: _label, ...preset } = PRESETS.equity;
  const euroInstrument = await repo.saveEntity('instruments', { ...preset, id: 'euro-share', name: 'Euro share', symbol: 'EURSH', preset: 'equity', currency: 'EUR' });
  await closed('euro-result', euro, euroInstrument, '75');
  await closed('missing-fx', euro, usdInstrument, '150');
  const mixed = await cli('journal overview');
  expect(mixed.code).toBe(0);
  expect(mixed.body.data).toMatchObject({ net: null, currency: null, total: 4, incomplete: 1, currencyTotals: [
    { currency: 'EUR', net: '-25', complete: 1, incomplete: 1 }, { currency: 'USD', net: '450', complete: 2, incomplete: 0 },
  ] });
  await repo.saveEntity('accounts', { ...await repo.getEntity('accounts', other.id), archived: true });
  const active = await cli('journal overview');
  expect(active.body.data).toMatchObject({ total: 3, currencyTotals: [{ currency: 'EUR', net: '-25', complete: 1, incomplete: 1 }, { currency: 'USD', net: '350', complete: 1, incomplete: 0 }] });
  const selected = await cli('journal overview', undefined, { account: euro.id });
  expect(selected.body.data).toMatchObject({ net: '-25', currency: 'EUR', total: 2, incomplete: 1 });
});
}

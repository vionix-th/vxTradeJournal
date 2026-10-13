import { describe, expect, it } from 'vitest';
import { journalOverview } from '../../src/application/journal.js';
const trade = (id, accountId, net, complete = true, status = 'closed') => ({ id, accountId, status, summary: { complete, accountNet: net } });
const accounts = [{ id: 'a', name: 'Main', currency: 'USD' }, { id: 'b', name: 'Other', currency: 'EUR' }];
const trades = [trade('t1', 'a', '350'), trade('t2', 'a', null, false, 'open'), trade('t3', 'b', '100', true, 'open')];

describe('journal overview currency aggregation', () => {
  it('keeps selected-account results and identifies incomplete trades', () => {
    expect(journalOverview(trades, accounts, 'a')).toEqual({
      total: 2, open: 1, closed: 1, account: accounts[0], net: '350', incomplete: 1,
      currency: 'USD', currencyTotals: [{ currency: 'USD', net: '350', complete: 1, incomplete: 1 }],
    });
  });
  it('provides separate subtotals without adding different currencies', () => {
    expect(journalOverview(trades, accounts)).toEqual({
      total: 3, open: 2, closed: 1, account: null, net: null, incomplete: 1, currency: null,
      currencyTotals: [{ currency: 'EUR', net: '100', complete: 1, incomplete: 0 }, { currency: 'USD', net: '350', complete: 1, incomplete: 1 }],
    });
  });
  it('adds complete results across accounts sharing one reporting currency', () => {
    expect(journalOverview(trades, [{ ...accounts[0] }, { ...accounts[1], currency: 'USD' }])).toMatchObject({
      account: null, net: '450', currency: 'USD', incomplete: 1,
      currencyTotals: [{ currency: 'USD', net: '450', complete: 2, incomplete: 1 }],
    });
  });
  it('preserves single-account automatic scope', () => {
    expect(journalOverview(trades.slice(0, 2), accounts.slice(0, 1))).toMatchObject({ account: accounts[0], net: '350', currency: 'USD' });
  });
  it('preserves signs without floating-point precision loss', () => {
    const sameCurrency = [{ ...accounts[0] }, { ...accounts[1], currency: 'USD' }];
    const precise = [trade('large', 'a', '9007199254740993.01'), trade('small', 'b', '0.09'), trade('negative', 'a', '-0.10')];
    expect(journalOverview(precise, sameCurrency).net).toBe('9007199254740993');
    expect(journalOverview([trade('one', 'a', '0.1'), trade('two', 'b', '0.2')], sameCurrency).net).toBe('0.3');
  });
  it('excludes archived profit, losses and incomplete records from every overview measure', () => {
    const archived = [{ ...accounts[0] }, { ...accounts[1], archived: true }];
    expect(journalOverview([...trades, trade('loss', 'b', '-999'), trade('unknown', 'b', null, false)], archived)).toMatchObject({
      total: 2, open: 1, closed: 1, net: '350', incomplete: 1,
      currencyTotals: [{ currency: 'USD', net: '350', complete: 1, incomplete: 1 }],
    });
    expect(() => journalOverview(trades, archived, 'b')).toThrow('Account not found');
    expect(journalOverview(trades.filter((t) => t.accountId === 'b'), archived.slice(1))).toMatchObject({ total: 0, net: null, currencyTotals: [] });
  });
  it('keeps USD and USDC distinct without implied conversion', () => {
    const currencies = [{ ...accounts[0] }, { ...accounts[1], currency: 'USDC' }];
    expect(journalOverview([trade('usd', 'a', '20.25'), trade('usdc', 'b', '11.75')], currencies)).toMatchObject({
      net: null, currency: null,
      currencyTotals: [{ currency: 'USD', net: '20.25', complete: 1, incomplete: 0 }, { currency: 'USDC', net: '11.75', complete: 1, incomplete: 0 }],
    });
  });
  it('returns zero for empty currency groups and no monetary unit when no accounts exist', () => {
    expect(journalOverview([], accounts).currencyTotals).toEqual([{ currency: 'EUR', net: '0', complete: 0, incomplete: 0 }, { currency: 'USD', net: '0', complete: 0, incomplete: 0 }]);
    expect(journalOverview([], accounts, 'a')).toMatchObject({ net: '0', currency: 'USD' });
    expect(journalOverview([], [])).toMatchObject({ net: null, currency: null, currencyTotals: [], total: 0 });
  });
  it('does not treat excluded incomplete results as known profit', () => {
    expect(journalOverview([trade('unknown', 'a', null, false)], accounts, 'a')).toMatchObject({ net: '0', incomplete: 1, currencyTotals: [{ currency: 'USD', net: '0', complete: 0, incomplete: 1 }] });
  });
  it('does not broaden unknown selected-account scope or silently drop orphan records', () => {
    expect(() => journalOverview(trades, accounts, 'missing')).toThrow('Account not found');
    expect(() => journalOverview([trade('orphan', 'missing', '100')], accounts)).toThrow('Trade account not found');
  });
});

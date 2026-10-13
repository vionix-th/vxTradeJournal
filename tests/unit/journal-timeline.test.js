import { describe, expect, it } from 'vitest';
import { journalTimeline } from '../../src/application/journal-timeline.js';
import { filterJournal, prepareTrade } from '../../src/application/journal.js';
import { createTrade, normalizeAccount, normalizeInstrument, PRESETS } from '../../src/domain/journal.js';

const account = normalizeAccount({ id: 'a', name: 'Main', currency: 'USD' });
const { label: _label, ...defaults } = PRESETS.equity;
const instrument = normalizeInstrument({ ...defaults, id: 'i', name: 'Example', symbol: 'EX', preset: 'equity', currency: 'USD', priceUnit: 'USD/share' });
function fixture(events = [], directions = ['long']) {
  const trade = createTrade({ id: 't', account, instruments: directions.map((direction) => ({ instrument, direction })) });
  trade.createdAt = '2026-01-01T00:00:00Z'; trade.updatedAt = '2026-02-01T00:00:00Z';
  trade.executions = events.map(([kind, quantity, timestamp, leg = 0], index) => ({ id: `e${index}`, legId: trade.legs[leg].id,
    kind, quantity, timestamp, price: kind === 'settlement' ? null : '10', fees: '0', feeCurrency: 'USD', manualGross: '0', manualSource: 'user-entered', reason: kind === 'settlement' ? 'Final settlement' : '' }));
  return prepareTrade(trade, { accounts: [account], instruments: [instrument], strategies: [] });
}
describe('read-only journal chronology', () => {
  it('uses creation fallback for unfilled ideas without adding fields to source or calculation', () => {
    const trade = fixture(); const before = structuredClone(trade);
    expect(journalTimeline(trade)).toEqual({ openedAt: '2026-01-01T00:00:00.000Z', closedAt: null, updatedAt: '2026-02-01T00:00:00.000Z', entered: false });
    expect(trade).toEqual(before); expect(trade.summary).not.toHaveProperty('closedAt');
    expect(filterJournal([trade], { from: '2026-01-01', to: '2026-01-01' }).total).toBe(1);
  });
  it('reports first entry and final close; a partial close stays undated', () => {
    const events = [['entry', '2', '2026-01-03T10:00:00+02:00'], ['exit', '1', '2026-01-04T08:00:00Z']];
    expect(journalTimeline(fixture(events))).toMatchObject({ openedAt: '2026-01-03T08:00:00.000Z', closedAt: null, entered: true });
    expect(journalTimeline(fixture([...events, ['exit', '1', '2026-01-05T08:00:00Z']])).closedAt).toBe('2026-01-05T08:00:00.000Z');
  });
  it('retains initial opening across reopening and exposes only the latest completed close', () => {
    const events = [['entry', '1', '2026-01-03T00:00:00Z'], ['exit', '1', '2026-01-04T00:00:00Z'], ['entry', '1', '2026-01-06T00:00:00Z']];
    expect(journalTimeline(fixture(events))).toMatchObject({ openedAt: '2026-01-03T00:00:00.000Z', closedAt: null });
    expect(journalTimeline(fixture([...events, ['exit', '1', '2026-01-07T00:00:00Z']])).closedAt).toBe('2026-01-07T00:00:00.000Z');
  });
  it('takes final settlement across legs without replaying positions in the projection', () => {
    const trade = fixture([['entry', '1', '2026-01-03T00:00:00Z', 0], ['entry', '1', '2026-01-04T00:00:00Z', 1],
      ['exit', '1', '2026-01-05T00:00:00Z', 0], ['settlement', '1', '2026-01-06T00:00:00Z', 1]], ['long', 'short']);
    expect(trade.status).toBe('closed');
    expect(journalTimeline(trade).closedAt).toBe('2026-01-06T00:00:00.000Z');
  });
  it('ignores later context edits and adjustments when determining closing time', () => {
    const trade = fixture([['entry', '1', '2026-01-03T00:00:00Z'], ['exit', '1', '2026-01-04T00:00:00Z']]);
    trade.updatedAt = '2026-05-01T00:00:00Z'; trade.review = 'Later review';
    trade.adjustments.push({ id: 'fee', timestamp: '2026-06-01T00:00:00Z', amount: '-1', currency: 'USD', reason: 'Fee' });
    expect(journalTimeline(trade).closedAt).toBe('2026-01-04T00:00:00.000Z');
  });
  it('matches inclusive closing days in the selected timezone and excludes open ideas', () => {
    const trade = fixture([['entry', '1', '2026-01-03T00:00:00Z'], ['exit', '1', '2026-01-04T00:30:00Z']]);
    const filters = { dateBasis: 'closed', from: '2026-01-03', to: '2026-01-03' };
    expect(filterJournal([trade, { ...fixture(), id: 'idea' }], filters, 1, 12, 'America/New_York').items).toEqual([trade]);
    expect(filterJournal([trade], filters, 1, 12, 'UTC').total).toBe(0);
  });
  it.each(['asc', 'desc'])('keeps missing dates last and equal instants in ID order (%s)', (order) => {
    const trades = [{ id: 'z' }, { id: 'b', openedAt: '2026-01-01T00:00:00Z' }, { id: 'a', openedAt: '2026-01-01T01:00:00+01:00' }];
    expect(filterJournal(trades, { sort: 'opened', order }).items.map((trade) => trade.id)).toEqual(['a', 'b', 'z']);
    expect(filterJournal(trades, { sort: 'closed', order }).items.map((trade) => trade.id)).toEqual(['a', 'b', 'z']);
  });
  it('defaults to latest update while explicit opening sort compares chronology before pagination', () => {
    const trades = [{ id: 'old', openedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
      { id: 'new', openedAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' }];
    expect(filterJournal(trades, {}, 1, 1).items[0].id).toBe('old');
    expect(filterJournal(trades, { sort: 'opened' }, 1, 1).items[0].id).toBe('new');
    expect(filterJournal(trades, { sort: 'opened', order: 'asc' }, 2, 1).items[0].id).toBe('new');
  });
});

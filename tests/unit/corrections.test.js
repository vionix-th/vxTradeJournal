import { describe, it, expect } from 'vitest';
import { correctionDiff, correctionReason, correctionPage, correctionId, validateCorrection } from '../../src/application/corrections.js';
import { publicError } from '../../src/cli/errors.js';
import { createTrade, normalizeInstrument, calculateTrade } from '../../src/domain/journal.js';

const meta = { uid: 'alice', schemaVersion: 2, revision: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const source = () => ({ legs: [{ id: 'l', ...meta, direction: 'long', snapshot: { id: 'i', pointValue: '1' }, planning: { quantity: '2' } }], executions: [{ id: 'e', ...meta, legId: 'l', kind: 'entry', quantity: '2', price: '10', fees: '0', feeCurrency: 'USD', timestamp: '2026-01-01T00:00:00Z', resultRate: null }], adjustments: [] });
describe('source correction contract', () => {
  it('ignores new records, metadata and key order; tracks saved fields and deletion without mutation', () => {
    const before = source(), original = structuredClone(before), next = structuredClone(before);
    next.executions[0] = Object.fromEntries(Object.entries({ ...next.executions[0], revision: 2 }).reverse());
    next.adjustments.push({ id: 'new', amount: '1' });
    expect(correctionDiff(before, next)).toEqual([]);
    next.executions[0].resultRate = '1.25'; next.legs[0].planning.quantity = '3';
    expect(correctionDiff(before, next).map((c) => c.recordType)).toEqual(['legs', 'executions']);
    expect(correctionDiff(before, next)).toEqual([
      { recordType: 'legs', recordId: 'l', before: { planning: { quantity: '2' } }, after: { planning: { quantity: '3' } } },
      { recordType: 'executions', recordId: 'e', before: { resultRate: null }, after: { resultRate: '1.25' } },
    ]);
    next.executions = [];
    expect(correctionDiff(before, next)[1].after).toBeNull();
    expect(correctionDiff(before, next)[1].before).not.toHaveProperty('uid');
    expect(correctionDiff(before, next)[1].before).not.toHaveProperty('revision');
    const metadataOnly = structuredClone(before); metadataOnly.legs[0].snapshot.revision = 99;
    expect(correctionDiff(before, metadataOnly)).toEqual([]);
    const absent = structuredClone(before); delete absent.executions[0].resultRate;
    expect(correctionDiff(absent, before)).toEqual([{ recordType: 'executions', recordId: 'e', before: {}, after: { resultRate: null } }]);
    expect(before).toEqual(original);
    expect(correctionDiff(null, next)).toEqual([]);
  });
  it('requires bounded nonblank reasons and exposes safe structured errors', () => {
    expect(correctionReason('  Historical broker correction  ', true)).toBe('Historical broker correction');
    for (const value of ['', '  ', 'x'.repeat(1001), 42]) {
      try { correctionReason(value, true); throw new Error('Unexpected success'); }
      catch (error) { expect(publicError(error)).toMatchObject({ code: 'VALIDATION', exitCode: 2, details: { rule: 'CORRECTION_REASON', path: '/correctionReason' } }); }
    }
  });
  it('groups and paginates operations; validates owner and exact identity', () => {
    const record = { ...meta, calculationVersion: 1, id: correctionId('op'), operationId: 'op', reason: 'Reported FX', changes: [{ recordType: 'executions', recordId: 'e', before: { resultRate: null }, after: { resultRate: '1.25' } }] };
    expect(() => validateCorrection(record, 'alice')).not.toThrow();
    expect(() => validateCorrection(record, 'bob')).toThrow();
    expect(() => validateCorrection({ ...record, id: 'forged' }, 'alice')).toThrow();
    expect(() => validateCorrection({ ...record, reason: ' untrimmed ' }, 'alice')).toThrow();
    expect(() => validateCorrection({ ...record, changes: [] }, 'alice')).toThrow();
    expect(() => validateCorrection({ ...record, changes: [...record.changes, ...record.changes] }, 'alice')).toThrow();
    expect(() => validateCorrection({ ...record, changes: [{ ...record.changes[0], after: { notes: 'Not a source field' } }] }, 'alice')).toThrow();
    const records = Array.from({ length: 13 }, (_, n) => ({ ...record, id: `op${n}`, operationId: `op${n}`, createdAt: `2026-01-${String(n + 1).padStart(2, '0')}T00:00:00Z` }));
    records[12].changes = [...records[12].changes, { recordType: 'legs', recordId: 'l', before: { direction: 'long' }, after: { direction: 'short' } }];
    expect(correctionPage(records, 1).items[0].changes).toHaveLength(2);
    expect(correctionPage(records, 2)).toMatchObject({ total: 13, page: 2, pages: 2 });
  });
});

it('replays 32 seeded histories against independent arithmetic and stable tie ordering', () => {
  for (let seed = 1; seed <= 32; seed++) {
    const p = seed + 10, multiplier = seed % 3 + 1;
    const instrument = normalizeInstrument({ id: 'i', name: 'Synthetic', symbol: 'S', market: 'Equities', preset: 'equity', model: 'linear', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: String(multiplier), currency: 'USD' });
    const trade = createTrade({ id: `t-${seed}`, account: { id: 'a', name: 'Main', currency: 'USD' }, instruments: [{ instrument, direction: 'long' }] });
    const fills = [['entry', 2, p], ['entry', 2, p + 2], ['exit', 1, p + 3], ['entry', 1, p + 5], ['exit', 4, p + 7], ['entry', 2, p + 10], ['exit', 2, p + 9]];
    trade.executions = fills.map(([kind, quantity, price], index) => ({ id: `e${index}`, legId: trade.legs[0].id, kind, quantity: String(quantity), price: String(price), timestamp: '2026-01-01T00:00:00Z', sequence: index, fees: '1', feeCurrency: 'EUR', feeRate: '2' }));
    trade.adjustments = [{ id: 'credit', amount: '3', currency: 'GBP', rate: '3', timestamp: '2026-01-01T00:00:00Z', reason: 'Credit' }, { id: 'charge', amount: '-2', currency: 'USD', rate: '1', timestamp: '2026-01-01T00:00:00Z', reason: 'Charge' }];
    const original = structuredClone(trade), result = calculateTrade(trade);
    expect(trade).toEqual(original);
    expect(result.accountNet).toBe(String(20 * multiplier - 7));
    expect(result.legs[0].gross).toBe(String(20 * multiplier));
    expect(result.legs[0].history[2]).toMatchObject({ remaining: '3', averageEntry: String(p + 1), gross: String(2 * multiplier) });
    expect(result.legs[0].history[3]).toMatchObject({ remaining: '4', averageEntry: String(p + 2) });
    expect(result.legs[0].history[4]).toMatchObject({ remaining: '0', averageEntry: '0' });
    let state = seed;
    for (let i = trade.executions.length - 1; i > 0; i--) { state = (state * 1664525 + 1013904223) >>> 0; const j = state % (i + 1); [trade.executions[i], trade.executions[j]] = [trade.executions[j], trade.executions[i]]; }
    expect(calculateTrade(trade)).toEqual(result);
    const byId = { ...original, executions: original.executions.map(({ sequence: _sequence, ...fill }) => fill) };
    expect(calculateTrade(byId)).toEqual(result);
    expect(original.executions).toEqual(fills.map(([kind, quantity, price], index) => ({ id: `e${index}`, legId: trade.legs[0].id, kind, quantity: String(quantity), price: String(price), timestamp: '2026-01-01T00:00:00Z', sequence: index, fees: '1', feeCurrency: 'EUR', feeRate: '2' })));
  }
});

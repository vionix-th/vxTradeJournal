import { it, expect } from 'vitest';
import { validateSchema2 } from '../../src/application/schema-evolution.js';
import { createTrade, normalizeAccount, normalizeInstrument } from '../../src/domain/journal.js';
import { flattenJournal } from '../../src/application/portable.js';

function records() {
  const stamp = { uid: 'synthetic', schemaVersion: 2, revision: 2, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
  const account = { ...normalizeAccount({ id: 'a', name: 'Main', currency: 'USD' }), ...stamp };
  const instrument = { ...normalizeInstrument({ id: 'i', name: 'Share', symbol: 'S', preset: 'equity', market: 'Equities', model: 'linear', currency: 'USD', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1' }), ...stamp };
  const trade = { ...createTrade({ id: 't', account, instruments: [{ id: 'l', instrument, direction: 'long' }] }), ...stamp };
  trade.legs = trade.legs.map(leg => ({ ...leg, ...stamp }));
  trade.corrections = [{ id: 'correction', operationId: 'correction', ...stamp, calculationVersion: 1, reason: 'Correct entry context', changes: [{ recordType: 'legs', recordId: 'l', before: { direction: 'short' }, after: { direction: 'long' } }] }];
  return flattenJournal({ accounts: [account], instruments: [instrument], strategies: [], trades: [trade] }).map(record => ({ ...record, path: `users/synthetic/${record.path}` }));
}

it('accepts correction-bearing schema-2 graphs without rewriting source records', () => {
  const graph = records(), original = structuredClone(graph);
  expect(() => validateSchema2(graph)).not.toThrow();
  expect(graph).toEqual(original);
});

it('rejects orphan correction paths instead of ignoring unmanaged history', () => {
  const graph = records(), correction = graph.find(record => record.path.includes('/corrections/'));
  for (const path of ['users/synthetic/trades/missing/corrections/correction', 'users/synthetic/accounts/a/corrections/correction', `${correction.path}/extra/child`]) {
    expect(() => validateSchema2([{ ...correction, path }])).toThrow('Orphan correction');
  }
});

it('rejects correction path identity mismatches and history ahead of its parent revision', () => {
  const graph = records(), correction = graph.find(record => record.path.includes('/corrections/'));
  correction.path = 'users/synthetic/trades/t/corrections/other';
  expect(() => validateSchema2(graph)).toThrow('Invalid correction identity');
  correction.path = 'users/synthetic/trades/t/corrections/correction';
  correction.data.revision = 3;
  expect(() => validateSchema2(graph)).toThrow('Inconsistent correction operation history');
});

it('rejects stale snapshot schema metadata after adjacent conversion', () => {
  const graph = records(), leg = graph.find(record => record.path.includes('/legs/'));
  leg.data.snapshot.schemaVersion = 1;
  expect(() => validateSchema2(graph)).toThrow('Invalid snapshot metadata');
});

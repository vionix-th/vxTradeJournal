import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Repository } from '../../src/persistence/repository.js';
import { JournalTransfer } from '../../src/persistence/transfer.js';
import { createTrade, calculateTrade } from '../../src/domain/journal.js';
import { correctSnapshot } from '../../src/application/operations.js';
import { correctionId } from '../../src/application/corrections.js';
import { verifyExport } from '../../src/application/portable.js';
import { readyDatabase } from '../helpers/database.js';
let env, repo;
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: process.env.GCLOUD_PROJECT || 'demo-vxjournal-auto', firestore: { host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || 8280), rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => env?.cleanup());
beforeEach(async () => { await env.clearFirestore(); await readyDatabase(env); repo = new Repository(env.authenticatedContext('alice', { email_verified: true }).firestore(), 'alice'); });
async function fixture(legs = 1) {
  const account = await repo.saveEntity('accounts', { id: 'a', name: 'Main', currency: 'USD' });
  const instruments = [];
  for (let i = 0; i < legs; i++) instruments.push(await repo.saveEntity('instruments', { id: `i${i}`, name: 'Synthetic', symbol: `S${i}`, market: 'Equities', preset: 'equity', model: 'linear', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1', currency: 'USD' }));
  const trade = createTrade({ id: 't', account, instruments: instruments.map((instrument) => ({ instrument, direction: 'long' })) });
  trade.executions = trade.legs.flatMap((leg, index) => ['entry', 'exit'].map((kind, offset) => ({ id: `e${index}-${offset}`, legId: leg.id, kind, quantity: '2', price: offset ? '12' : '10', fees: '0', feeCurrency: 'USD', timestamp: `2026-01-0${offset + 1}T00:00:00Z` })));
  return repo.saveTrade(trade, 'original');
}
it('accepts owner correction entry structure without independently verifying source values', async () => {
  const before = await fixture();
  const entry = { id: 'owner-history', uid: 'alice', schemaVersion: 2, calculationVersion: 1, revision: before.revision, createdAt: before.updatedAt, updatedAt: before.updatedAt, operationId: 'owner-history', reason: 'Owner recorded fee correction', changes: [{ recordType: 'executions', recordId: 'e0-1', before: { fees: '0' }, after: { fees: '1' } }] };
  await assertSucceeds(setDoc(repo.child('t', 'corrections', entry.id), entry));
  await assertFails(setDoc(repo.child('t', 'corrections', 'empty'), { ...entry, id: 'empty', operationId: 'empty', changes: [] }));
  await assertFails(setDoc(repo.child('t', 'corrections', 'blank'), { ...entry, id: 'blank', operationId: 'blank', reason: ' ' }));
});
it('atomically corrects six distinct snapshots in one compact history entry with retry evidence', async () => {
  const before = await fixture(6);
  const input = { ...before, legs: before.legs.map((leg) => ({ ...leg, snapshot: { ...leg.snapshot, pointValue: '2' } })) };
  const context = { correctionReason: 'Correct six historical contract multipliers' };
  const after = await repo.saveTrade(input, 'correct-six', null, context);
  expect(after.summary.accountNet).toBe('48');
  expect(after.corrections).toHaveLength(1);
  expect(after.corrections[0]).toMatchObject({ id: 'correct-six', revision: 2 });
  expect(after.corrections[0].changes).toHaveLength(6);
  for (const c of after.corrections[0].changes) { expect(c.before).toEqual({ snapshot: { pointValue: '1' } }); expect(c.after).toEqual({ snapshot: { pointValue: '2' } }); }
  expect((await repo.saveTrade(input, 'correct-six', null, context)).corrections).toHaveLength(1);
  await expect(repo.saveTrade(input, 'correct-six', null, { correctionReason: 'Different explanation' })).rejects.toThrow(/different input/);
  await repo.deleteTrade(after);
  expect(await repo.listChildren('t', 'corrections')).toEqual([]);
});
it('rejects reasons, stale writes and invalid earlier edits without altering sources or evidence', async () => {
  const before = await fixture();
  const corrected = structuredClone(before); corrected.executions[0].price = '9';
  await expect(repo.saveTrade(corrected, 'missing')).rejects.toMatchObject({ name: 'ValidationError', details: { rule: 'CORRECTION_REASON' } });
  expect(await repo.getTrade('t')).toEqual(before); expect(await repo.getOperation('t', 'missing')).toBeNull();
  const invalid = structuredClone(before); invalid.executions[0].quantity = '1';
  await expect(repo.saveTrade(invalid, 'invalid', null, { correctionReason: 'Invalid quantity correction' })).rejects.toMatchObject({ details: { rule: 'POSITION_OVERDRAW', recordId: 'e0-1', path: '/executions/1/quantity' } });
  expect(await repo.getTrade('t')).toEqual(before);
  const saved = await repo.saveTrade(corrected, 'valid', null, { correctionReason: 'Broker corrected entry price' });
  await expect(repo.saveTrade(before, 'stale', null, { correctionReason: 'Stale correction' })).rejects.toThrow(/conflict/i);
  expect(await repo.getTrade('t')).toEqual(saved); expect(await repo.getOperation('t', 'stale')).toBeNull();
});
it('rejects malformed entries, cross-owner access and independent history updates/deletes', async () => {
  const before = await fixture(), leg = before.legs[0];
  const after = { ...leg, revision: 2, direction: 'short' }, parent = { ...before, revision: 2, lastOperation: 'forged' };
  for (const key of ['legs', 'executions', 'adjustments', 'corrections']) delete parent[key];
  const id = correctionId('forged', 'legs', leg.id);
  const record = { id, uid: 'alice', schemaVersion: 2, calculationVersion: 1, revision: 2, createdAt: parent.updatedAt, updatedAt: parent.updatedAt, operationId: 'forged', recordType: 'legs', recordId: leg.id, reason: 'Forged before value', before: { ...leg, direction: 'short' }, after };
  const batch = writeBatch(repo.db); batch.set(repo.ref('trades', 't'), parent); batch.set(repo.child('t', 'legs', leg.id), after); batch.set(repo.child('t', 'corrections', id), record);
  await assertFails(batch.commit());
  const changed = await repo.saveTrade({ ...before, legs: [{ ...leg, direction: 'short' }] }, 'correct', null, { correctionReason: 'Actual short position' });
  const c = changed.corrections[0];
  await assertFails(setDoc(repo.child('t', 'corrections', c.id), { ...c, reason: 'Rewritten history' }));
  await assertFails(deleteDoc(repo.child('t', 'corrections', c.id)));
  const other = env.authenticatedContext('bob', { email_verified: true }).firestore();
  await assertFails(setDoc(doc(other, `users/alice/trades/t/corrections/${c.id}`), c));
});
it('round trips correction events and restores displaced evidence from replacement backup', async () => {
  const before = await fixture();
  const changed = await repo.saveTrade({ ...before, executions: before.executions.map((e) => e.kind === 'exit' ? { ...e, price: '13' } : e) }, 'broker-correction', null, { correctionReason: 'Broker corrected close price' });
  const transfer = new JournalTransfer(repo), file = await transfer.export();
  expect(await verifyExport(file)).toMatchObject({ integrity: 'verified', counts: { corrections: 1 }, incompleteTradeIds: [] });
  const target = new Repository(env.authenticatedContext('bob', { email_verified: true }).firestore(), 'bob'), imported = new JournalTransfer(target);
  const preview = await imported.preview(file, { mode: 'add' });
  await imported.apply(file, { mode: 'add', acceptPreview: preview.fingerprint, operationId: 'copy' });
  const copied = await target.getTrade('t');
  expect(calculateTrade(copied).accountNet).toBe('6');
  expect(copied.corrections[0]).toMatchObject({ uid: 'bob', revision: changed.revision, createdAt: changed.corrections[0].createdAt, changes: [{ before: { price: '12' }, after: { price: '13' } }] });
  const baselineFile = await new JournalTransfer(target).export();
  const latest = await repo.saveTrade({ ...changed, executions: changed.executions.map((e) => e.kind === 'exit' ? { ...e, price: '14' } : e) }, 'second', null, { correctionReason: 'Second corrected close price' });
  const replace = await transfer.preview(baselineFile, { mode: 'replace' });
  await transfer.apply(baselineFile, { mode: 'replace', acceptPreview: replace.fingerprint, operationId: 'replace', yes: true });
  expect((await repo.getTrade('t')).corrections).toHaveLength(1);
  const backup = await transfer.backupExport('replace');
  expect(backup.trades[0].corrections).toEqual(latest.corrections);
  const restore = await transfer.preview(backup, { mode: 'replace' });
  await transfer.apply(backup, { mode: 'replace', acceptPreview: restore.fingerprint, operationId: 'restore', yes: true });
  expect((await repo.getTrade('t')).corrections).toEqual(latest.corrections);
});

it('keeps untouched execution metadata during snapshot correction', async () => {
  const before = await fixture();
  const changed = await repo.saveTrade({ ...before, legs: [{ ...before.legs[0], snapshot: { ...before.legs[0].snapshot, pointValue: '2' } }] }, 'snapshot-only', null, { correctionReason: 'Correct multiplier' });
  expect(changed.executions).toEqual(before.executions);
});


it('corrects six currencies and atomically records all resulting execution-rate invalidations', async () => {
  const before = await fixture(6);
  let next = before;
  for (const leg of before.legs) next = correctSnapshot(next, leg.id, { currency: 'EUR' });
  const after = await repo.saveTrade(next, 'correct-six-fx', null, { correctionReason: 'Broker corrected six historical quote currencies' });
  expect(after.summary.complete).toBe(false);
  expect(after.summary.native.EUR).toBe('24');
  expect(after.corrections).toHaveLength(1);
  expect(after.corrections[0].changes).toHaveLength(18);
  for (const execution of after.executions) expect(execution.resultRate).toBeNull();
  expect(after.corrections[0].changes.filter(c => c.recordType === 'executions')).toHaveLength(12);
  expect((await repo.saveTrade(next, 'correct-six-fx', null, { correctionReason: 'Broker corrected six historical quote currencies' })).corrections).toEqual(after.corrections);
  expect((await repo.getCorrections('t')).items).toHaveLength(1);
});


it('rejects invalid currency/rate shortcuts without changing records', async () => {
  const before = await fixture();
  const cases = [
    ['legs', before.legs[0], source => ({ ...source, snapshot: { ...source.snapshot, currency: 'eur' } })],
    ['executions', before.executions[0], source => ({ ...source, resultRate: '-1' })],
    ['executions', before.executions[0], source => ({ ...source, resultRate: '0' })],
  ];
  for (const [index, [recordType, source, change]] of cases.entries()) {
    const operationId = `invalid-${index}`;
    const parent = { ...before, revision: 2, lastOperation: operationId };
    for (const key of ['legs', 'executions', 'adjustments', 'corrections']) delete parent[key];
    const after = { ...change(source), revision: source.revision + 1 };
    const id = correctionId(operationId, recordType, source.id);
    const c = { id, uid: 'alice', schemaVersion: 2, calculationVersion: 1, revision: 2, createdAt: parent.updatedAt, updatedAt: parent.updatedAt, operationId, reason: 'Invalid historical correction', changes: [{ recordType, recordId: source.id, before: {}, after: {} }] };
    const batch = writeBatch(repo.db);
    batch.set(repo.ref('trades', 't'), parent); batch.set(repo.child('t', recordType, source.id), after); batch.set(repo.child('t', 'corrections', id), c);
    batch.set(repo.child('t', 'operations', operationId), { id: operationId, uid: 'alice', revision: 2 });
    await assertFails(batch.commit());
    expect(await repo.getTrade('t')).toEqual(before);
    expect(await repo.getOperation('t', operationId)).toBeNull();
  }
});

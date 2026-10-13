import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { Repository } from '../../src/persistence/repository.js';
import { JournalTransfer } from '../../src/persistence/transfer.js';
import { createTrade, calculateTrade } from '../../src/domain/journal.js';
import { fingerprint } from '../../src/application/fingerprint.js';
import { readyDatabase } from '../helpers/database.js';
let env, repo, transfer;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.GCLOUD_PROJECT || 'demo-vxjournal-auto', firestore: { host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || 8280), rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => { await env.clearFirestore(); await readyDatabase(env); repo = new Repository(env.authenticatedContext('alice', { email_verified: true }).firestore(), 'alice'); transfer = new JournalTransfer(repo); });
async function source({ history = false } = {}) {
  const account = await repo.saveEntity('accounts', { id: 'a', name: 'Main', currency: 'USD' });
  const instrument = await repo.saveEntity('instruments', { id: 'i', name: 'Share', symbol: 'S', market: 'Equities', preset: 'equity', model: 'linear', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1', currency: 'USD' });
  const strategy = history ? await repo.saveEntity('strategies', { id: 's', name: 'Original strategy' }) : null;
  let trade = createTrade({ id: 't', account, instruments: [{ instrument, direction: 'long' }], strategy });
  trade.executions = ['entry', 'exit'].map((kind, index) => ({ id: `e${index}`, legId: trade.legs[0].id, kind, quantity: '2.000', price: index ? '12.01' : '10.00', fees: '0', feeCurrency: 'USD', timestamp: `2020-01-0${index + 1}T00:00:00Z` }));
  if (history) {
    Object.assign(trade.executions[1], { fees: '0.20', feeCurrency: 'EUR', feeRate: '1.10' });
    trade.adjustments = [{ id: 'adjustment', amount: '-0.10', currency: 'GBP', rate: '1.25', reason: 'Historical charge', timestamp: '2020-01-02T01:00:00Z' }];
  }
  trade = await repo.saveTrade(trade, 'original-receipt');
  if (history) {
    trade.executions[1].orderReference = 'historical-broker-reference';
    trade = await repo.saveTrade(trade, 'correct-reference', null, { correctionReason: 'Record historical broker reference' });
  }
  await repo.saveEntity('instruments', { ...instrument, pointValue: '10', archived: true });
  await repo.saveEntity('accounts', { ...(await repo.getEntity('accounts', 'a')), archived: true });
  if (history) await repo.saveEntity('strategies', { ...strategy, name: 'Current strategy', archived: true });
  return { file: await transfer.export(), trade };
}
async function deletionOptions(operationId) {
  const account = await repo.getEntity('accounts', 'a');
  const preview = await transfer.previewAccountDeletion(account.id, account.revision);
  return { revision: account.revision, acceptPreview: preview.fingerprint, operationId, yes: true };
}
it('deletes archived account source and all nested history without rewriting unrelated records', async () => {
  const { file } = await source({ history: true });
  expect(file.accounts[0].archived).toBe(true);
  expect(file.trades[0].adjustments).toHaveLength(1);
  expect(file.trades[0].corrections).toHaveLength(1);
  const other = await repo.saveEntity('accounts', { id: 'other', name: 'Other', currency: 'EUR' });
  const instrument = await repo.getEntity('instruments', 'i');
  const result = await transfer.deleteAccount('a', await deletionOptions('delete-account'));
  expect(result).toMatchObject({ status: 'complete', kind: 'accountDeletion', backupAvailable: false });
  expect(await repo.getEntity('accounts', 'a')).toBeNull();
  expect(await repo.getTrade('t')).toBeNull();
  for (const type of ['legs', 'executions', 'adjustments', 'corrections', 'operations']) expect(await repo.listChildren('t', type)).toEqual([]);
  expect(await repo.getEntity('accounts', other.id)).toEqual(other);
  expect(await repo.getEntity('instruments', instrument.id)).toEqual(instrument);
  expect((await getDocs(transfer.rows('delete-account'))).empty).toBe(true);
  expect(await transfer.status('delete-account')).toMatchObject({ cleanupComplete: true });
  expect(await transfer.backups()).toEqual([]);
});
it('resumes interrupted deletion with same operation and fences ordinary writes and competing owners', async () => {
  await source({ history: true });
  const options = await deletionOptions('interrupted-delete');
  transfer.onCheckpoint = () => { throw new Error('Deletion interrupted'); };
  await expect(transfer.deleteAccount('a', options)).rejects.toMatchObject({ writeOutcome: { state: 'partial' } });
  await expect(repo.load()).rejects.toMatchObject({ code: 'JOURNAL_IMPORT_IN_PROGRESS' });
  await expect(new JournalTransfer(repo).resume(options.operationId)).rejects.toMatchObject({ code: 'IMPORT_BUSY' });
  let account;
  await env.withSecurityRulesDisabled(async (context) => { account = (await getDoc(doc(context.firestore(), 'users/alice/accounts/a'))).data(); });
  await assertFails(setDoc(repo.ref('accounts', 'a'), { ...account, revision: account.revision + 1, archived: false }));
  transfer.onCheckpoint = null;
  expect((await transfer.deleteAccount('a', options)).status).toBe('complete');
  expect(await repo.getEntity('accounts', 'a')).toBeNull();
});
it('rolls back partial deletion with historical values intact and unrelated revisions unchanged', async () => {
  const { trade } = await source({ history: true });
  const other = await repo.saveEntity('accounts', { id: 'other', name: 'Other', currency: 'EUR' });
  transfer.onCheckpoint = () => { throw new Error('Stop deletion'); };
  await expect(transfer.deleteAccount('a', await deletionOptions('cancel-delete'))).rejects.toThrow('Stop deletion');
  transfer.onCheckpoint = null;
  expect((await transfer.rollback('cancel-delete', true)).status).toBe('rolledBack');
  const restored = await repo.getTrade('t');
  expect(calculateTrade(restored).accountNet).toBe('3.675');
  expect(restored.executions.map((item) => [item.id, item.price, item.fees, item.feeRate])).toEqual(trade.executions.map((item) => [item.id, item.price, item.fees, item.feeRate]));
  expect((await repo.getEntity('accounts', 'a')).archived).toBe(true);
  expect(await repo.getEntity('accounts', other.id)).toEqual(other);
  expect((await getDocs(transfer.rows('cancel-delete'))).empty).toBe(true);
});
it('rejects stale deletion previews before touching journal source', async () => {
  await source();
  const options = await deletionOptions('stale-delete');
  await repo.saveEntity('accounts', { id: 'other', name: 'Other', currency: 'USD' });
  await expect(transfer.deleteAccount('a', options)).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_CHANGED' });
  expect(await repo.getTrade('t')).not.toBeNull();
  expect((await transfer.status(options.operationId)).status).toBe('rejected');
});
it('retries completed deletion cleanup without recreating removed records', async () => {
  await source();
  const options = await deletionOptions('cleanup-delete');
  const cleanup = transfer.cleanup.bind(transfer);
  transfer.cleanup = async () => { throw new Error('Cleanup unavailable'); };
  await expect(transfer.deleteAccount('a', options)).rejects.toMatchObject({ writeOutcome: { state: 'applied' } });
  expect(await transfer.inspect(options.operationId)).toMatchObject({ operationKind: 'accountDeletion', actions: ['finish_cleanup', 'check_status'] });
  await expect(repo.load()).rejects.toMatchObject({ code: 'JOURNAL_IMPORT_IN_PROGRESS' });
  await env.withSecurityRulesDisabled(async (context) => { expect((await getDoc(doc(context.firestore(), 'users/alice/accounts/a'))).exists()).toBe(false); });
  await expect(new JournalTransfer(repo).export()).rejects.toMatchObject({ code: 'IMPORT_BUSY' });
  const control = (await getDoc(transfer.control())).data();
  await assertFails(setDoc(transfer.control(), { ...control, state: 'ready', phase: 'complete' }));
  transfer.cleanup = cleanup;
  expect((await transfer.deleteAccount('a', options)).status).toBe('complete');
  expect((await getDocs(transfer.rows(options.operationId))).empty).toBe(true);
});
it('cancels deletion interrupted immediately after claim before manifest preparation', async () => {
  await source();
  const before = await repo.getEntity('accounts', 'a');
  const options = await deletionOptions('claim-gap');
  const fenced = transfer.fenced.bind(transfer);
  transfer.fenced = async () => { throw new Error('Preparing request interrupted'); };
  await expect(transfer.deleteAccount('a', options)).rejects.toThrow('Preparing request interrupted');
  expect(await transfer.status(options.operationId)).toMatchObject({ status: 'uploaded', active: true });
  transfer.fenced = fenced;
  expect((await transfer.rollback(options.operationId, true)).status).toBe('rolledBack');
  expect(await repo.getEntity('accounts', 'a')).toEqual(before);
});
it('requires archived ownership and confirmation, and blocks direct archived trade writes', async () => {
  await source();
  const options = await deletionOptions('guarded-delete');
  await expect(transfer.deleteAccount('a', { ...options, yes: false })).rejects.toThrow('explicit confirmation');
  const otherOwner = new Repository(env.authenticatedContext('bob', { email_verified: true }).firestore(), 'bob');
  await expect(new JournalTransfer(otherOwner).previewAccountDeletion('a', options.revision)).rejects.toThrow('Account not found');
  await assertFails(deleteDoc(repo.ref('accounts', 'a')));
  await assertFails(deleteDoc(repo.ref('trades', 't')));
  const parent = (await getDoc(repo.ref('trades', 't'))).data();
  await assertFails(setDoc(repo.ref('trades', 't'), { ...parent, revision: parent.revision + 1, review: 'Direct update' }));
  const unverified = new JournalTransfer(new Repository(env.authenticatedContext('alice', { email_verified: false }).firestore(), 'alice', () => false));
  await expect(unverified.deleteAccount('a', options)).rejects.toMatchObject({ code: 'EMAIL_UNVERIFIED' });
  await repo.saveEntity('accounts', { ...await repo.getEntity('accounts', 'a'), archived: false });
  await expect(transfer.previewAccountDeletion('a', options.revision + 1)).rejects.toThrow('Archive account');
});
it('clears archived defaults atomically and rejects archived preference selections', async () => {
  await source();
  let account = await repo.getEntity('accounts', 'a');
  account = await repo.saveEntity('accounts', { ...account, archived: false });
  const preferences = await repo.saveEntity('settings', { ...await repo.getSettings(), defaultAccount: account.id });
  await assertFails(setDoc(repo.ref('accounts', 'a'), { ...account, archived: true, revision: account.revision + 1 }));
  await repo.saveEntity('accounts', { ...account, archived: true });
  expect((await getDoc(repo.ref('settings', 'preferences'))).data()).toMatchObject({ defaultAccount: null, revision: preferences.revision + 1 });
  await expect(repo.saveEntity('settings', { ...await repo.getSettings(), defaultAccount: account.id })).rejects.toThrow('Default account must be active');
});
it('round trips historical data to another owner and retries completed imports', async () => {
  const { file, trade } = await source();
  const target = new Repository(env.authenticatedContext('bob', { email_verified: true }).firestore(), 'bob');
  const imported = new JournalTransfer(target);
  const preview = await imported.preview(file, { mode: 'add' });
  await imported.apply(file, { mode: 'add', acceptPreview: preview.fingerprint, operationId: 'copy' });
  const saved = await target.getTrade('t');
  expect(saved.createdAt).toBe(trade.createdAt); expect(saved.legs[0].snapshot.pointValue).toBe('1');
  expect(saved.legs[0].snapshot.uid).toBe('bob'); expect(saved.executions[0].quantity).toBe('2.000');
  expect(calculateTrade(saved).accountNet).toBe('4.02');
  expect(await target.getOperation('t', 'original-receipt')).toBeNull();
  expect((await imported.apply(file, { mode: 'add', acceptPreview: preview.fingerprint, operationId: 'copy' })).status).toBe('complete');
  await assertFails(getDoc(doc(target.db, 'users/alice/imports/copy')));
});
it('preserves strategy history, foreign fees and decimal adjustments across ownership', async () => {
  const { file } = await source({ history: true });
  const target = new Repository(env.authenticatedContext('bob', { email_verified: true }).firestore(), 'bob');
  const imported = new JournalTransfer(target), preview = await imported.preview(file, { mode: 'add' });
  await imported.apply(file, { mode: 'add', acceptPreview: preview.fingerprint, operationId: 'history' });
  const saved = await target.getTrade('t');
  expect(saved.strategySnapshot.name).toBe('Original strategy'); expect(saved.strategySnapshot.uid).toBe('bob');
  expect((await target.getEntity('strategies', 's')).name).toBe('Current strategy');
  expect(saved.executions[1]).toMatchObject({ fees: '0.20', feeRate: '1.10', feeCurrency: 'EUR' });
  expect(saved.adjustments[0]).toMatchObject({ amount: '-0.10', rate: '1.25', currency: 'GBP' });
  // 2 × (12.01 − 10.00) − 0.20 × 1.10 − 0.10 × 1.25 = 3.675 USD.
  expect(saved.summary.accountNet).toBe('3.675');
});
it('resumes an interrupted private backup before changing journal records', async () => {
  const { file } = await source(); await repo.saveEntity('accounts', { id: 'extra', name: 'Extra', currency: 'USD' });
  const preview = await transfer.preview(file, { mode: 'replace' }), fenced = transfer.fenced.bind(transfer);
  let checkpoint = 0;
  transfer.fenced = async (...args) => { const result = await fenced(...args); if (++checkpoint === 2) throw new Error('Backup interruption'); return result; };
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'backup' })).rejects.toThrow('Backup interruption');
  expect((await transfer.status('backup')).status).toBe('preparing');
  await env.withSecurityRulesDisabled(async (context) => {
    expect((await getDoc(doc(context.firestore(), 'users/alice/accounts/extra'))).data().name).toBe('Extra');
    expect((await getDoc(doc(context.firestore(), 'users/alice/trades/t'))).data().revision).toBe(1);
  });
  transfer.fenced = fenced;
  expect((await transfer.resume('backup')).status).toBe('complete');
  expect(await repo.getEntity('accounts', 'extra')).toBeNull();
  expect((await transfer.backupExport('backup')).accounts.some((a) => a.id === 'extra')).toBe(true);
});
it('rejects stale previews before journal mutation', async () => {
  const { file } = await source(); const preview = await transfer.preview(file, { mode: 'replace' });
  await repo.saveEntity('accounts', { id: 'other', name: 'Other', currency: 'USD' });
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'stale' })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_CHANGED' });
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'stale' })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_CHANGED' });
  expect(await repo.getEntity('accounts', 'other')).not.toBeNull();
});
it('keeps interrupted data unavailable, fences competing runs and rolls back', async () => {
  const { file } = await source(); await repo.saveEntity('accounts', { id: 'extra', name: 'Extra', currency: 'USD' });
  const preview = await transfer.preview(file, { mode: 'replace' });
  transfer.onCheckpoint = () => { throw new Error('Injected interruption'); };
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'interrupted' })).rejects.toThrow('Injected');
  await expect(repo.load()).rejects.toMatchObject({ code: 'JOURNAL_IMPORT_IN_PROGRESS' });
  await assertFails(setDoc(doc(repo.db, 'users/alice/accounts/rogue'), { id: 'rogue', uid: 'alice' }));
  const competing = new JournalTransfer(repo);
  await expect(competing.resume('interrupted')).rejects.toMatchObject({ code: 'IMPORT_BUSY' });
  transfer.onCheckpoint = null;
  await transfer.rollback('interrupted', true);
  expect(await repo.getEntity('accounts', 'extra')).not.toBeNull();
  expect((await repo.getTrade('t')).summary.accountNet).toBe('4.02');
});
it('resumes expired ownership without source file, rejects stale fences and retains downloadable backup', async () => {
  const { file } = await source();
  await repo.saveEntity('accounts', { id: 'extra', name: 'Extra', currency: 'USD' });
  const preview = await transfer.preview(file, { mode: 'replace' });
  transfer.onCheckpoint = () => { throw new Error('Interrupted'); };
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'resume' })).rejects.toThrow('Interrupted');
  const controlRef = doc(repo.db, 'users/alice/_journal/control');
  const stale = (await getDoc(controlRef)).data();
  await assertFails(getDocs(collection(repo.db, 'users/alice/trades')));
  await expect(transfer.deleteBackup('resume', true)).rejects.toMatchObject({ code: 'IMPORT_BUSY' });
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), controlRef.path), { ...stale, expiresAt: Timestamp.fromMillis(0) }));
  const resumed = new JournalTransfer(repo);
  await resumed.claim('resume', true);
  const rows = (await getDocs(collection(repo.db, 'users/alice/imports/resume/records'))).docs.map((d) => d.data());
  const record = rows.find((r) => r.after && r.path === 'accounts/a');
  const batch = writeBatch(repo.db); batch.set(controlRef, { ...stale, checkpoint: stale.checkpoint + 1 }); batch.set(doc(repo.db, `users/alice/${record.path}`), record.after);
  await assertFails(batch.commit());
  expect((await resumed.resume('resume')).status).toBe('complete');
  expect(await repo.getEntity('accounts', 'extra')).toBeNull();
  expect(await repo.getOperation('t', 'original-receipt')).toBeNull();
  const backup = await resumed.backupExport('resume');
  expect(backup.accounts.some((a) => a.id === 'extra')).toBe(true);
  expect((await resumed.backups()).map((b) => b.id)).toEqual(['resume']);
  await resumed.deleteBackup('resume', true);
  expect(await resumed.backups()).toEqual([]);
});
it('failed source upload never freezes journal and an incomplete upload can be cancelled', async () => {
  const { file } = await source(); const preview = await transfer.preview(file, { mode: 'replace' });
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'users/alice/imports/upload'), { id: 'upload', uid: 'alice', owner: 'gone', formatVersion: 1, projectId: repo.db.app.options.projectId, conversions: [], status: 'uploading', mode: 'replace', includeSettings: false, sourceFingerprint: 'x', previewFingerprint: preview.fingerprint, receiptId: 'new', schemaVersion: 2, calculationVersion: 1, sourceChunks: 2, backupAvailable: false }));
  await expect(transfer.resume('upload')).rejects.toMatchObject({ code: 'IMPORT_RECOVERY_REQUIRED' });
  expect((await repo.load()).trades).toHaveLength(1);
  expect((await transfer.rollback('upload', true)).status).toBe('rolledBack');
  expect(file.trades).toHaveLength(1);
});
it('resumes partial rollback and rejects altered restoration checkpoints', async () => {
  const { file } = await source();
  await repo.saveEntity('accounts', { id: 'extra', name: 'Extra', currency: 'USD' });
  const preview = await transfer.preview(file, { mode: 'replace' });
  transfer.onCheckpoint = () => { throw new Error('Apply interruption'); };
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'rollback' })).rejects.toThrow('Apply interruption');
  transfer.onCheckpoint = () => { throw new Error('Rollback interruption'); };
  await expect(transfer.rollback('rollback', true)).rejects.toThrow('Rollback interruption');
  await expect(repo.load()).rejects.toMatchObject({ code: 'JOURNAL_IMPORT_IN_PROGRESS' });
  const ref = doc(repo.db, 'users/alice/imports/rollback/records/accounts~extra');
  const original = (await getDoc(ref)).data();
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), ref.path), { ...original, restore: { ...original.restore, name: 'Corrupted backup' } }));
  transfer.onCheckpoint = null;
  await expect(transfer.resume('rollback')).rejects.toMatchObject({ code: 'IMPORT_RECOVERY_REQUIRED' });
  await expect(repo.load()).rejects.toMatchObject({ code: 'JOURNAL_IMPORT_IN_PROGRESS' });
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), ref.path), original));
  expect((await transfer.resume('rollback')).status).toBe('rolledBack');
  expect((await repo.getEntity('accounts', 'extra')).name).toBe('Extra');
  expect((await repo.getOperation('t', 'original-receipt')).revision).toBe(1);
  expect((await repo.getTrade('t')).summary.accountNet).toBe('4.02');
});
it('retains rollback intent when restoration staging is interrupted', async () => {
  const { file } = await source(); await repo.saveEntity('accounts', { id: 'extra', name: 'Extra', currency: 'USD' });
  const preview = await transfer.preview(file, { mode: 'replace' });
  transfer.onCheckpoint = () => { throw new Error('Apply interruption'); };
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'rollback-stage' })).rejects.toThrow('Apply interruption');
  transfer.onCheckpoint = null;
  const fenced = transfer.fenced.bind(transfer); let checkpoint = 0;
  transfer.fenced = async (...args) => { const result = await fenced(...args); if (++checkpoint === 2) throw new Error('Restoration staging interruption'); return result; };
  await expect(transfer.rollback('rollback-stage', true)).rejects.toThrow('Restoration staging interruption');
  transfer.fenced = fenced;
  expect((await transfer.resume('rollback-stage')).status).toBe('rolledBack');
  expect((await repo.getEntity('accounts', 'extra')).name).toBe('Extra');
});
it('keeps ordinary instrument validation within the rules budget after transfers', async () => {
  for (let owner = 0; owner < 4; owner++) {
    const target = new Repository(env.authenticatedContext(`budget-${owner}`, { email_verified: true }).firestore(), `budget-${owner}`);
    await new JournalTransfer(target).export();
    for (let index = 0; index < 8; index++) {
      const saved = await target.saveEntity('instruments', { id: `i-${index}`, name: 'Audit instrument', symbol: 'AUDIT', market: 'Equities', venue: '', preset: 'equity', model: 'linear', quantityUnit: 'shares', priceUnit: '', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1', currency: 'USD' });
      expect(saved.revision).toBe(1);
    }
  }
}, 60000);


it('restores exact correction evidence on interrupted replacement rollback and preserves it in retained backup', async () => {
  const { file, trade } = await source();
  const changed = await repo.saveTrade({ ...trade, executions: trade.executions.map(e => e.kind === 'exit' ? { ...e, price: '13.01' } : e) }, 'correct-close', null, { correctionReason: 'Broker corrected close price' });
  const preview = await transfer.preview(file, { mode: 'replace' });
  transfer.onCheckpoint = () => { throw new Error('Correction transfer interruption'); };
  await expect(transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'correction-rollback' })).rejects.toMatchObject({ writeOutcome: { state: 'partial' } });
  transfer.onCheckpoint = null;
  await transfer.rollback('correction-rollback', true);
  const recovered = await repo.getTrade('t');
  expect(recovered.corrections).toEqual(changed.corrections);
  expect(recovered.executions.map(({ revision: _revision, ...e }) => e)).toEqual(changed.executions.map(({ revision: _revision, ...e }) => e));
  expect(recovered.summary.accountNet).toBe('6.02');
  const retry = await transfer.preview(file, { mode: 'replace' });
  await transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: retry.fingerprint, operationId: 'correction-replace' });
  expect((await repo.getTrade('t')).corrections).toEqual([]);
  expect((await transfer.backupExport('correction-replace')).trades[0].corrections).toEqual(changed.corrections);
});

it('downloads retained schema-1 backups unchanged and converts them only when restored', async () => {
  const { file } = await source();
  const preview = await transfer.preview(file, { mode: 'replace' });
  await transfer.apply(file, { mode: 'replace', yes: true, acceptPreview: preview.fingerprint, operationId: 'retained-v1' });
  // Model a completed backup retained from the schema-1 runtime, with its verified source checksum.
  await env.withSecurityRulesDisabled(async context => {
    const store = context.firestore();
    const rows = (await getDocs(collection(store, 'users/alice/imports/retained-v1/records'))).docs;
    const before = [];
    for (const row of rows) {
      const value = row.data();
      if (value.before) {
        if (value.before.schemaVersion === 2) value.before.schemaVersion = 1;
        if (value.before.snapshot) value.before.snapshot.schemaVersion = 1;
        if (value.before.strategySnapshot) value.before.strategySnapshot.schemaVersion = 1;
        before.push({ path: value.path, data: value.before });
      }
      await setDoc(row.ref, value);
    }
    const sessionRef = doc(store, 'users/alice/imports/retained-v1');
    await setDoc(sessionRef, { ...(await getDoc(sessionRef)).data(), schemaVersion: 1, backupHash: await fingerprint(before.sort((a, b) => a.path.localeCompare(b.path))) });
  });
  const backup = await transfer.backupExport('retained-v1');
  expect(backup.schemaVersion).toBe(1);
  expect(backup.trades[0].legs[0].snapshot.schemaVersion).toBe(1);
  expect(backup.trades[0].corrections).toBeUndefined();
  const restore = await transfer.preview(backup, { mode: 'replace' });
  expect(restore.conversions).toMatchObject([{ id: 'schema-1-to-2' }]);
  await transfer.apply(backup, { mode: 'replace', yes: true, acceptPreview: restore.fingerprint, operationId: 'restore-v1' });
  const restored = await repo.getTrade('t');
  expect(restored.summary.accountNet).toBe('4.02');
  expect(restored.legs[0].snapshot.schemaVersion).toBe(2);
  expect(restored.corrections).toEqual([]);
  expect((await transfer.backupExport('retained-v1')).schemaVersion).toBe(1);
});

it('reports competing export metadata without changing its fence or exposing owner tokens', async () => {
  const exporter = new JournalTransfer(repo);
  await exporter.claim('live-export', false, true);
  const competitor = new JournalTransfer(repo);
  let error;
  try { await competitor.export(); } catch (failure) { error = failure; }
  expect(error).toMatchObject({ code: 'IMPORT_BUSY', details: { transfer: { reason: 'active_export', operationId: 'live-export', actions: ['check_status'] }, export: { filePrepared: false, downloadRequested: false } } });
  expect(JSON.stringify(error.details)).not.toContain(exporter.owner);
  const after = await getDoc(exporter.control());
  expect(after.data()).toMatchObject({ owner: exporter.owner, fence: 1, state: 'snapshot' });
});

it('classifies missing import operation metadata without offering recovery writes', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'alice', '_journal', 'control'), { state: 'import', operationId: 'missing', owner: 'owner', fence: 1, checkpoint: 1, cursor: 0, phase: 'preparing', expiresAt: Timestamp.fromMillis(0) });
  });
  expect(await transfer.inspect()).toMatchObject({ reason: 'status_unavailable', actions: ['check_status'] });
  expect((await getDoc(transfer.control())).data().state).toBe('import');
});

import { readyDatabase } from '../../helpers/database.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it, expect } from 'vitest';

export function register(context) {
 const { cli, prerequisites } = context;
it('supports import preview, conflict errors, replacement and recovery backup commands', async () => {

  const repo = await prerequisites();
  const exported = await cli('export'); expect(exported.code, JSON.stringify(exported.body)).toBe(0);
  expect(exported.body.data.formatVersion).toBe(1); expect(exported.body.data.checksum).toMatch(/^[a-f0-9]{64}$/);
  const add = await cli('import preview', exported.body.data, { mode: 'add' }); expect(add.body.data.skipped).toBe(1);
  await repo.saveEntity('accounts', { ...(await repo.getEntity('accounts', 'a')), name: 'Changed' });
  const conflict = await cli('import preview', exported.body.data, { mode: 'add' }); expect(conflict.body.data.canApply).toBe(false);
  const rejected = await cli('import apply', exported.body.data, { mode: 'add', 'accept-preview': conflict.body.data.fingerprint, 'operation-id': 'conflict-import' });
  expect(rejected.code).toBe(5); expect(rejected.body.error.code).toBe('IMPORT_CONFLICT');
  const preview = await cli('import preview', exported.body.data, { mode: 'replace' });
  const applied = await cli('import apply', exported.body.data, { mode: 'replace', yes: true, 'accept-preview': preview.body.data.fingerprint, 'operation-id': 'replace-import' });
  expect(applied.code, JSON.stringify(applied.body)).toBe(0);
  const status = await cli('import status', undefined, { 'operation-id': 'replace-import' });
  expect(status.body.data.status).toBe('complete');
  expect(status.body.data.transfer).toMatchObject({ reason: 'ready', importStatus: 'complete', actions: ['retry_export', 'check_status'] });
  expect(status.body.data.owner).toBeUndefined();
  expect((await cli('backup list')).body.data.map((b) => b.id)).toEqual(['replace-import']);
  expect((await cli('backup export', undefined, { 'operation-id': 'replace-import' })).body.data.accounts[0].name).toBe('Changed');
  expect((await cli('backup delete', undefined, { 'operation-id': 'replace-import', yes: true })).code).toBe(0);
});

it("blocks incompatible schemas before reads, writes and export output while doctor remains available", async () => {
    const { env, root } = context;

  const output = join(root, "blocked-export.json");
  try {
    await readyDatabase(env, { schemaVersion: 3 });
    for (const [command, input, extra] of [["accounts list", undefined, {}], ["accounts create", { id: "blocked", name: "Blocked", currency: "USD" }, {}], ["export", undefined, { output }]]) {
      const result = await cli(command, input, extra);
      expect(result.code).toBe(6);
      expect(result.body.error).toMatchObject({ code: "SCHEMA_VERSION_MISMATCH", expectedSchema: 2, actualSchema: 3 });
    }
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
    const diagnostic = await cli("doctor");
    expect(diagnostic.code).toBe(0);
    expect(diagnostic.body.data.database).toMatchObject({ compatible: false, schemaVersion: 3 });
    expect((await cli("auth status")).code).toBe(0);
    await readyDatabase(env, { status: "maintenance" });
    expect((await cli("accounts list")).body.error.code).toBe("DATABASE_MAINTENANCE");
    await env.withSecurityRulesDisabled(async (context) => {
      const { deleteDoc, doc } = await import("firebase/firestore");
      await deleteDoc(doc(context.firestore(), "_system/database"));
    });
    expect((await cli("accounts list")).body.error.code).toBe("DATABASE_NOT_INITIALIZED");
  } finally { await readyDatabase(env); }
});

it('exposes correction requirements, structured rejection and offline backup verification', async () => {

  const native = await prerequisites({ instrument: true });
  const created = await cli('trades create', { id: 'audit', accountId: 'a', legs: [{ id: 'audit-leg', instrumentId: 'i', direction: 'long' }] }, { 'operation-id': 'audit-create' });
  expect(created.body.writeOutcome).toEqual({ state: 'applied' });
  const fill = await cli('executions add', { id: 'audit-fill', legId: 'audit-leg', kind: 'entry', quantity: '1', price: '10', timestamp: '2026-01-01T00:00:00Z' }, { trade: 'audit', revision: 1, 'operation-id': 'audit-entry' });
  expect(fill.code, JSON.stringify(fill.body)).toBe(0);
  const options = { trade: 'audit', id: 'audit-fill', revision: 2, 'operation-id': 'audit-correct' };
  const preview = await cli('executions update', { fees: '1' }, { ...options, 'dry-run': true });
  expect(preview.body).toMatchObject({ writeOutcome: { state: 'not_applied' }, data: { correctionRequired: true, corrections: [{ recordId: 'audit-fill' }] } });
  const before = await native.getTrade('audit');
  const missing = await cli('executions update', { fees: '1' }, options);
  expect(missing.body).toMatchObject({ writeOutcome: { state: 'not_applied' }, error: { code: 'VALIDATION', rule: 'CORRECTION_REASON', path: '/correctionReason' } });
  expect(await native.getTrade('audit')).toEqual(before);
  const invalid = await cli('executions update', { quantity: '0' }, { ...options, 'correction-reason': 'Bad quantity' });
  expect(invalid.body.error).toMatchObject({ rule: 'DECIMAL_RANGE', path: '/executions/0/quantity', recordId: 'audit-fill', rejectedValue: '0' });
  const applied = await cli('executions update', { fees: '1' }, { ...options, 'correction-reason': 'Broker corrected execution fee' });
  expect(applied.code, JSON.stringify(applied.body)).toBe(0);
  expect((await cli('executions update', { fees: '1' }, { ...options, 'correction-reason': 'Broker corrected execution fee' })).body.data.replayed).toBe(true);
  expect((await cli('executions update', { fees: '1' }, { ...options, 'correction-reason': 'Different reason' })).body.error.code).toBe('OPERATION_MISMATCH');
  expect((await cli('trades corrections', undefined, { id: 'audit', page: 1, 'page-size': 12 })).body.data).toMatchObject({ total: 1, items: [{ reason: 'Broker corrected execution fee' }] });
  const exported = await cli('export');
  await cli('auth logout');
  const verified = await cli('export verify', exported.body.data);
  expect(verified.body).toMatchObject({ ok: true, data: { integrity: 'verified', counts: { corrections: 1 }, targetVersions: { schema: 2 } } });
  expect(await native.getTrade('audit')).toEqual(applied.body.data.trade);
}, 60000);

it('reports export contention through unchanged error codes and read-only doctor diagnostics', async () => {
    const { env, uid } = context;

  await prerequisites();
  await env.withSecurityRulesDisabled(async (context) => {
    const { setDoc, doc, Timestamp } = await import('firebase/firestore');
    await setDoc(doc(context.firestore(), 'users', uid, '_journal', 'control'), { state: 'snapshot', operationId: 'competing-export', owner: 'private-owner-token', fence: 1, checkpoint: 1, cursor: 0, phase: 'preparing', expiresAt: Timestamp.fromMillis(Date.now() + 120000) });
  });
  const blocked = await cli('export');
  expect(blocked.code).toBe(5);
  expect(blocked.body).toMatchObject({ ok: false, error: { code: 'IMPORT_BUSY', transfer: { reason: 'active_export', operationId: 'competing-export', actions: ['check_status'] } } });
  expect(blocked.body.data).toBeUndefined();
  expect(JSON.stringify(blocked.body)).not.toContain('private-owner-token');
  const diagnostic = await cli('doctor');
  expect(diagnostic.code).toBe(0);
  expect(diagnostic.body.data.journal.transfer.reason).toBe('active_export');
  expect(JSON.stringify(diagnostic.body.data.journal)).not.toContain('private-owner-token');
});

it('manages archives explicitly and deletes linked history through accepted CLI preview', async () => {

  const repo = await prerequisites({ instrument: true });
  const { createTrade } = await import('../../../src/domain/journal.js');
  const account = await repo.getEntity('accounts', 'a');
  const trade = await repo.saveTrade(createTrade({ id: 'archive-trade', account, instruments: [{ instrument: await repo.getEntity('instruments', 'i'), direction: 'long' }] }), 'archive-trade-operation');
  await repo.saveEntity('settings', { ...await repo.getSettings(), defaultAccount: account.id });
  const latest = await repo.getEntity('accounts', account.id);
  const archived = await cli('accounts archive', undefined, { id: account.id, revision: latest.revision });
  expect(archived.code).toBe(0);
  expect((await cli('accounts list')).body.data).toEqual([]);
  expect((await cli('accounts list', undefined, { archived: 'true' })).body.data).toHaveLength(1);
  expect((await cli('journal list')).body.data.total).toBe(0);
  expect((await cli('journal overview')).body.data).toMatchObject({ total: 0, net: null, currencyTotals: [] });
  expect((await cli('settings get')).body.data.defaultAccount).toBeNull();
  expect((await cli('trades get', undefined, { id: trade.id })).body.error.code).toBe('ACCOUNT_ARCHIVED');
  expect((await cli('export')).body.data.accounts[0].archived).toBe(true);
  const revision = archived.body.data.revision;
  const preview = await cli('accounts delete', undefined, { id: account.id, revision, preview: true });
  expect(preview.code).toBe(0);
  expect(preview.body.data).toMatchObject({ tradeCount: 1, accountName: account.name });
  expect((await cli('accounts delete', undefined, { id: account.id, revision })).code).toBe(2);
  const options = { id: account.id, revision, 'accept-preview': preview.body.data.fingerprint, 'operation-id': 'cli-account-delete', yes: true };
  const removed = await cli('accounts delete', undefined, options);
  expect(removed.code).toBe(0);
  expect(removed.body.data).toMatchObject({ deleted: true, kind: 'accountDeletion', status: 'complete' });
  expect((await cli('accounts delete', undefined, options)).code).toBe(0);
  expect(await repo.getEntity('accounts', account.id)).toBeNull();
  expect(await repo.listChildren(trade.id, 'operations')).toEqual([]);
  expect((await cli('import status', undefined, { 'operation-id': 'cli-account-delete' })).body.data).toMatchObject({ cleanupComplete: true, transfer: { operationKind: 'accountDeletion', reason: 'ready' } });
});
}

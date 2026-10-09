import { describe, it, expect } from 'vitest';
import { createExport, readExport, planImport, flattenJournal } from '../../src/application/portable.js';
import { defaultSettings } from '../../src/application/settings.js';

const date = '2020-01-01T00:00:00.000Z';
const account = { id: 'a', uid: 'source', schemaVersion: 1, revision: 2, createdAt: date, updatedAt: date, name: 'Main', currency: 'USD', archived: true, hasTrades: false };
const journal = () => ({ accounts: [structuredClone(account)], instruments: [], strategies: [], trades: [], settings: defaultSettings('UTC') });
describe('portable import contract', () => {
  it('seals exports and rejects corruption without altering source values', async () => {
    const file = await createExport(journal(), date);
    expect(file.formatVersion).toBe(1);
    expect(file.counts.accounts).toBe(1);
    expect((await readExport(file)).journal.accounts[0]).toEqual(account);
    file.accounts[0].name = 'Tampered';
    await expect(readExport(file)).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
  });
  it('explicitly accepts legacy export and rejects unknown versions and private snapshots', async () => {
    const file = await createExport(journal(), date);
    delete file.formatVersion; delete file.counts; delete file.checksum;
    expect((await readExport(file)).warnings).toHaveLength(1);
    await expect(readExport({ ...file, schemaVersion: 9 })).rejects.toMatchObject({ code: 'UNSUPPORTED_EXPORT_VERSION' });
    await expect(readExport({ ...file, calculationVersion: 9 })).rejects.toMatchObject({ code: 'UNSUPPORTED_EXPORT_VERSION' });
    await expect(readExport({ ...file, format: 'vxTradeJournal-database' })).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
  });
  it('rebinds ownership, skips identical records and rejects whole conflicting add', async () => {
    const file = await readExport(await createExport(journal(), date));
    const destination = journal(); destination.accounts[0].uid = 'target'; destination.accounts[0].revision = 9;
    const context = { uid: 'target', projectId: 'demo-test', mode: 'add', includeSettings: false };
    const preview = await planImport(file, flattenJournal(destination), context);
    expect(preview.skipped).toBe(1); expect(preview.conflicts).toEqual([]);
    destination.accounts[0].currency = 'EUR';
    const conflict = await planImport(file, flattenJournal(destination), context);
    expect(conflict.conflicts).toContain('accounts/a'); expect(conflict.canApply).toBe(false);
    expect(destination.accounts[0].currency).toBe('EUR');
  });
  it('replacement previews deletions and preserves preferences unless opted in', async () => {
    const source = await readExport(await createExport(journal(), date));
    const old = journal(); old.accounts[0].id = 'old'; old.settings.defaultAccount = 'old'; old.settings.theme = 'dark';
    const plan = await planImport(source, flattenJournal(old), { uid: 'target', projectId: 'demo-test', mode: 'replace', includeSettings: false });
    expect(plan.deleted).toContain('accounts/old');
    expect(plan.target.settings.theme).toBe('dark'); expect(plan.target.settings.defaultAccount).toBeNull();
    const other = await planImport(source, flattenJournal(old), { uid: 'target', projectId: 'other', mode: 'replace', includeSettings: false });
    expect(other.fingerprint).not.toBe(plan.fingerprint);
  });
  it('rejects duplicate IDs, unknown fields and broken references', async () => {
    const data = journal(); data.accounts.push(structuredClone(account));
    await expect(readExport(await createExport(data))).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
    const unknown = journal(); unknown.accounts[0].secret = true;
    await expect(readExport(await createExport(unknown))).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
    const broken = journal(); broken.settings.defaultAccount = 'missing';
    await expect(readExport(await createExport(broken))).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
  });
  it('rejects coercible boolean values before persistence and accepts reordered JSON', async () => {
    const data = journal(); data.accounts[0].archived = 'false';
    await expect(readExport(await createExport(data))).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
    const file = await createExport(journal());
    const reordered = Object.fromEntries(Object.entries(file).reverse());
    expect((await readExport(reordered)).journal.accounts[0].name).toBe('Main');
  });
});

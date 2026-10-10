import { describe, it, expect } from 'vitest';
import { createExport, readExport, planImport, flattenJournal } from '../../src/application/portable.js';
import { createTrade, normalizeInstrument } from '../../src/domain/journal.js';
import { prepareTrade } from '../../src/application/journal.js';
import { defaultSettings } from '../../src/application/settings.js';

const date = '2020-01-01T00:00:00.000Z';
const account = { id: 'a', uid: 'source', schemaVersion: 2, revision: 2, createdAt: date, updatedAt: date, name: 'Main', currency: 'USD', archived: true, hasTrades: false };
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

it('converts schema-1 exports offline without losing source metadata or inventing history', async () => {
  const source = journal(); source.accounts[0].schemaVersion = 1;
  const file = await createExport(source, date, { schemaVersion: 1 });
  const original = structuredClone(file);
  const result = await readExport(file);
  expect(result.journal.accounts[0]).toEqual({ ...source.accounts[0], schemaVersion: 2 });
  expect(result.conversions).toMatchObject([{ id: 'schema-1-to-2' }]);
  expect(file).toEqual(original);
  const { verifyExport } = await import('../../src/application/portable.js');
  expect(await verifyExport(file)).toMatchObject({ sourceVersions: { schema: 1 }, targetVersions: { schema: 2 }, integrity: 'verified', counts: { corrections: 0 } });
  const empty = await createExport({ ...source, accounts: [] }, date, { schemaVersion: 1 });
  expect((await readExport(empty)).journal.accounts).toEqual([]);
});


it('verifies equivalent multi-leg projections after persistence changes child array order', async () => {
  const data = journal(); data.accounts[0].archived = false; data.accounts[0].hasTrades = true;
  const instrument = normalizeInstrument({ ...account, id: 'i', archived: false, name: 'Synthetic', symbol: 'S', market: 'Equities', preset: 'equity', model: 'linear', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1', currency: 'USD' });
  delete instrument.hasTrades;
  const otherInstrument = { ...instrument, id: 'i2', name: 'Second', symbol: 'T' };
  data.instruments = [instrument, otherInstrument];
  const draft = createTrade({ id: 't', account: data.accounts[0], instruments: [{ id: 'z-leg', instrument, direction: 'long' }, { id: 'a-leg', instrument: otherInstrument, direction: 'short' }] });
  draft.executions = draft.legs.flatMap((leg, index) => ['entry', 'exit'].map((kind, offset) => ({ ...account, id: `e${index}-${offset}`, legId: leg.id, kind, quantity: '2', price: offset ? '12' : '10', fees: '0', feeCurrency: 'USD', timestamp: `2020-01-0${offset + 1}T00:00:00Z` })));
  for (const e of draft.executions) for (const key of ['name', 'currency', 'archived', 'hasTrades']) delete e[key];
  draft.legs = draft.legs.map(leg => ({ ...leg, uid: account.uid, schemaVersion: 2, revision: 1, createdAt: date, updatedAt: date }));
  data.trades = [prepareTrade({ ...draft, uid: account.uid, revision: 1, createdAt: date, updatedAt: date }, data)];
  data.trades[0].legs.reverse(); data.trades[0].executions.reverse();
  const file = await createExport(data, date), original = structuredClone(file);
  const converted = await readExport(file);
  expect(converted.journal.trades[0].summary.accountNet).toBe('0');
  expect(converted.journal.trades[0].summary.legs.map(leg => [leg.id, leg.gross])).toEqual([['z-leg', '4'], ['a-leg', '-4']]);
  expect(file).toEqual(original);
  data.trades[0].instruments[0].name = 'Forged';
  await expect(readExport(await createExport(data, date))).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
  data.trades[0].instruments[0].name = instrument.name;
  data.trades[0].summary.legs[0].gross = '5';
  await expect(readExport(await createExport(data, date))).rejects.toMatchObject({ code: 'INVALID_EXPORT' });
});

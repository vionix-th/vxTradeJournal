import { SCHEMA_VERSION, CALCULATION_VERSION, normalizeAccount, normalizeInstrument, normalizeStrategy, validateSettings, calculateTrade } from '../domain/journal.js';
import { defaultSettings } from './settings.js';
import { fingerprint, canonical } from './fingerprint.js';
import { exportJournal } from './journal.js';
import { migrationChain, schemaRegistry } from './schema-evolution.js';

export const IMPORT_MAX_BYTES = 32 * 1024 * 1024;
export class ImportError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'ImportError'; this.code = code; this.details = details; }
}
const fail = (message) => { throw new ImportError('INVALID_EXPORT', message); };
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const meta = ['id', 'uid', 'schemaVersion', 'revision', 'createdAt', 'updatedAt'];
export const recordFields = {
  accounts: [...meta, 'name', 'currency', 'archived', 'hasTrades'],
  instruments: [...meta, 'name', 'symbol', 'market', 'venue', 'preset', 'model', 'quantityUnit', 'priceUnit', 'quantityIncrement', 'priceIncrement', 'pointValue', 'currency', 'underlying', 'expiry', 'strike', 'optionType', 'draft', 'archived', 'lastUsedAt'],
  strategies: [...meta, 'name', 'purpose', 'markets', 'entryRules', 'exitRules', 'riskRules', 'archived'],
  settings: [...meta, 'theme', 'timezone', 'defaultAccount'],
  trades: [...meta, 'accountId', 'accountCurrency', 'strategyId', 'strategySnapshot', 'rationale', 'review', 'tags', 'riskBudget', 'status', 'summary', 'openedAt', 'instruments', 'lastOperation'],
  legs: [...meta, 'instrumentId', 'snapshot', 'direction', 'planning'],
  executions: [...meta, 'legId', 'kind', 'quantity', 'price', 'timestamp', 'fees', 'feeCurrency', 'feeRate', 'resultRate', 'manualGross', 'manualSource', 'orderReference', 'reason', 'sequence'],
  adjustments: [...meta, 'amount', 'currency', 'rate', 'timestamp', 'reason'],
};
const collections = ['accounts', 'instruments', 'strategies', 'trades'];
const children = ['legs', 'executions', 'adjustments'];
const requiredStrings = {
  accounts: ['name', 'currency'], instruments: ['name', 'symbol', 'market', 'venue', 'preset', 'model', 'quantityUnit', 'underlying', 'expiry', 'optionType'],
  strategies: ['name', 'purpose', 'markets', 'entryRules', 'exitRules', 'riskRules'], settings: ['theme', 'timezone'],
  trades: ['accountId', 'accountCurrency', 'rationale', 'review', 'status'], legs: ['instrumentId', 'direction'],
  executions: ['legId', 'kind', 'quantity', 'timestamp', 'fees', 'feeCurrency'], adjustments: ['amount', 'currency', 'timestamp', 'reason'],
};
export const rowId = (path) => path.replaceAll('/', '~');
export function assertJSON(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return;
  if (Array.isArray(value)) { value.forEach(assertJSON); return; }
  if (value && Object.getPrototypeOf(value) === Object.prototype) { Object.values(value).forEach(assertJSON); return; }
  fail('Unsupported or non-lossless value in portable journal data.');
}
export function flattenJournal(journal) {
  const records = [];
  for (const type of collections) for (const item of journal[type]) {
    const data = structuredClone(item);
    if (type === 'trades') for (const child of children) {
      for (const record of data[child]) records.push({ path: `trades/${data.id}/${child}/${record.id}`, data: record });
      delete data[child];
    }
    records.push({ path: `${type}/${data.id}`, data });
  }
  if (journal.settings) records.push({ path: 'settings/preferences', data: structuredClone(journal.settings) });
  return records.sort((a, b) => a.path.localeCompare(b.path));
}
export function rebuildJournal(records) {
  const result = { accounts: [], instruments: [], strategies: [], trades: [], settings: defaultSettings() };
  for (const { path, data } of records) {
    const parts = path.split('/');
    if (parts.length !== 2) continue;
    if (parts[0] === 'settings') result.settings = structuredClone(data);
    else if (collections.includes(parts[0])) result[parts[0]].push(structuredClone(data));
  }
  for (const trade of result.trades) for (const child of children)
    trade[child] = records.filter(({ path }) => path.startsWith(`trades/${trade.id}/${child}/`)).map(({ data }) => structuredClone(data));
  return result;
}
function counts(data) { return Object.fromEntries([...collections, ...children].map((type) => [type, collections.includes(type) ? data[type].length : data.trades.reduce((n, t) => n + t[type].length, 0)])); }
export async function createExport(journal, exportedAt, versions = {}) {
  assertJSON(journal);
  const payload = { ...exportJournal(journal, exportedAt), ...versions, formatVersion: 1, counts: counts(journal) };
  return { ...payload, checksum: await fingerprint(payload) };
}
function fields(data, type, persisted = true) {
  if (!data || Array.isArray(data) || typeof data !== 'object') fail(`Invalid ${type} record.`);
  for (const key of Object.keys(data)) if (!recordFields[type].includes(key)) fail(`Unknown ${type} field: ${key}.`);
  if (!idPattern.test(data.id)) fail(`Invalid ${type} ID.`);
  for (const key of requiredStrings[type]) if (typeof data[key] !== 'string') fail(`Invalid ${type}.${key}: expected text.`);
  const short = { accounts: ['name'], instruments: ['name', 'symbol', 'market', 'venue', 'quantityUnit', 'underlying'], strategies: ['name'], settings: ['timezone'] };
  if ((short[type] || []).some((key) => data[key].length > 120)) fail(`Oversized ${type} text.`);
  if (type === 'strategies' && ['purpose', 'markets', 'entryRules', 'exitRules', 'riskRules'].some((key) => data[key].length > 10000) || type === 'trades' && ['rationale', 'review'].some((key) => data[key].length > 10000)) fail(`Oversized ${type} notes.`);
  for (const key of ['currency', 'accountCurrency', 'feeCurrency'].filter((key) => recordFields[type].includes(key))) if (data[key] !== null && !/^[A-Z][A-Z0-9]{2,11}$/.test(data[key])) fail(`Invalid ${type} currency code.`);
  if (['executions', 'adjustments'].includes(type) && !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(data.timestamp)) fail('Stored history timestamps must use UTC Z form.');
  if (type === 'executions' && !/^[0-9]+([.][0-9]+)?$/.test(data.fees)) fail('Execution fees must be nonnegative decimal strings.');
  const requiredNullable = { instruments: ['quantityIncrement', 'priceIncrement', 'pointValue', 'currency', 'strike'], trades: ['strategyId', 'strategySnapshot', 'riskBudget'], executions: ['price'], adjustments: ['rate'] };
  if ((requiredNullable[type] || []).some((key) => !Object.hasOwn(data, key))) fail(`Incomplete ${type} record.`);
  for (const key of ['archived', 'hasTrades', 'draft'].filter((key) => recordFields[type].includes(key))) if (typeof data[key] !== 'boolean') fail(`Invalid ${type}.${key}: expected boolean.`);
  if (type === 'settings' && (data.id !== 'preferences' || !(data.defaultAccount === null || idPattern.test(data.defaultAccount)))) fail('Invalid preferences record.');
  if (type === 'legs') {
    if (!data.planning || typeof data.planning !== 'object' || Array.isArray(data.planning) || Object.keys(data.planning).some((key) => !['entry', 'stop', 'target', 'riskBudget', 'rate', 'quantity'].includes(key))) fail('Invalid leg planning fields.');
  }
  if (persisted && (typeof data.uid !== 'string' || !data.uid || data.schemaVersion !== SCHEMA_VERSION || !Number.isSafeInteger(data.revision) || data.revision < 1 || data.revision >= Number.MAX_SAFE_INTEGER || ![data.createdAt, data.updatedAt].every((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value))))) fail(`Invalid ${type} metadata.`);
}
export function validatePortable(journal) {
  const owners = new Set();
  const records = flattenJournal(journal), paths = new Set();
  for (const { path, data } of records) {
    if (paths.has(path)) fail(`Duplicate record: ${path}.`); paths.add(path);
    const type = path.split('/').at(-2);
    fields(data, type, type !== 'settings' || data.revision !== 0);
    if (data.uid) owners.add(data.uid);
  }
  if (owners.size > 1) fail('Export contains mixed ownership.');
  journal.accounts.forEach((a) => normalizeAccount(structuredClone(a)));
  journal.instruments.forEach((i) => normalizeInstrument(structuredClone(i)));
  journal.strategies.forEach((s) => normalizeStrategy(structuredClone(s)));
  validateSettings(journal.settings);
  if (journal.settings.defaultAccount && !paths.has(`accounts/${journal.settings.defaultAccount}`)) fail('Default account reference is missing.');
  for (const trade of journal.trades) {
    const account = journal.accounts.find((a) => a.id === trade.accountId);
    if (!account || account.currency !== trade.accountCurrency) fail(`Invalid account reference: ${trade.id}.`);
    if (trade.strategyId) {
      if (!paths.has(`strategies/${trade.strategyId}`) || trade.strategySnapshot?.id !== trade.strategyId) fail(`Invalid strategy reference: ${trade.id}.`);
      fields(trade.strategySnapshot, 'strategies'); normalizeStrategy(structuredClone(trade.strategySnapshot));
      if (trade.strategySnapshot.uid !== trade.uid) fail('Historical strategy ownership mismatch.');
    } else if (trade.strategySnapshot != null) fail('Unexpected strategy snapshot.');
    for (const leg of trade.legs) {
      if (!paths.has(`instruments/${leg.instrumentId}`)) fail(`Missing instrument: ${leg.instrumentId}.`);
      fields(leg.snapshot, 'instruments');
      if (leg.snapshot.uid !== trade.uid) fail('Historical instrument ownership mismatch.');
    }
    const replay = calculateTrade(trade);
    const result = { ...replay, legs: replay.legs.map(({ history: _history, ...leg }) => leg) };
    // Cached results are verified, never silently rewritten during import.
    if (JSON.stringify(canonical(result)) !== JSON.stringify(canonical(trade.summary)) || result.status !== trade.status || result.openedAt !== trade.openedAt) fail(`Historical summary does not match source history: ${trade.id}.`);
    if (JSON.stringify(canonical(trade.instruments)) !== JSON.stringify(canonical(trade.legs.map((leg) => ({ name: leg.snapshot.name, symbol: leg.snapshot.symbol, market: leg.snapshot.market }))))) fail(`Historical instrument cache is inconsistent: ${trade.id}.`);
  }
  return journal;
}
export async function readExport(file, registry = schemaRegistry) {
  try {
    assertJSON(file);
    if (new TextEncoder().encode(JSON.stringify(file)).byteLength > IMPORT_MAX_BYTES) fail('Import exceeds 32 MiB.');
    if (!file || file.format !== 'vxTradeJournal') fail('Expected portable vxTradeJournal JSON; operator snapshots are unsupported.');
    const allowed = ['format', 'formatVersion', 'schemaVersion', 'calculationVersion', 'exportedAt', 'counts', 'checksum', ...collections, 'settings'];
    if (Object.keys(file).some((key) => !allowed.includes(key))) fail('Unknown export field.');
    if (file.formatVersion !== undefined && file.formatVersion !== 1 || !Number.isInteger(file.schemaVersion) || file.schemaVersion < 1 || file.schemaVersion > SCHEMA_VERSION || file.calculationVersion !== CALCULATION_VERSION)
      throw new ImportError('UNSUPPORTED_EXPORT_VERSION', 'Export format, schema or calculation version is unsupported.');
    const warnings = [];
    if (file.formatVersion === 1) {
      const { checksum, ...payload } = file;
      if (checksum !== await fingerprint(payload)) fail('Export integrity check failed.');
    } else {
      if (file.counts !== undefined || file.checksum !== undefined) fail('Ambiguous legacy export format.');
      warnings.push('Legacy export has no integrity checksum; complete record validation still applies.');
    }
    if (!collections.every((key) => Array.isArray(file[key])) || !file.settings || !Number.isFinite(Date.parse(file.exportedAt))) fail('Incomplete journal export.');
    const journal = Object.fromEntries([...collections, 'settings'].map((key) => [key, structuredClone(file[key])]));
    for (const trade of journal.trades) if (!children.every((key) => Array.isArray(trade[key]))) fail('Incomplete trade history.');
    if (file.formatVersion === 1 && await fingerprint(file.counts) !== await fingerprint(counts(journal))) fail('Export counts are inconsistent.');
    const steps = migrationChain(file.schemaVersion, SCHEMA_VERSION, registry.migrations);
    let converted = journal;
    if (steps.length) {
      const uid = journal.accounts[0]?.uid || journal.trades[0]?.uid;
      if (!uid) fail('Older schema has no identifiable owner.');
      let records = flattenJournal(journal).map(({ path, data }) => ({ path: `users/${uid}/${path}`, data }));
      for (const step of steps) {
        await step.validateSource(records);
        const map = new Map(records.map((r) => [r.path, r]));
        const ordered = [...records].sort((a, b) => a.path.localeCompare(b.path));
        for (let offset = 0; offset < ordered.length; offset += 100) {
          const output = await step.transform(ordered.slice(offset, offset + 100));
          if (!Array.isArray(output) || output.length > 200) fail('Conversion exceeds bounded transformation contract.');
          for (const change of output) { if (!change.path.startsWith(`users/${uid}/`) || change.data && change.data.uid !== uid) fail('Conversion changed ownership.'); if (change.delete) map.delete(change.path); else map.set(change.path, change); }
        }
        records = [...map.values()]; await step.validateTarget(records);
      }
      converted = rebuildJournal(records.map(({ path, data }) => ({ path: path.split('/').slice(2).join('/'), data })));
    }
    validatePortable(converted);
    return { journal: converted, warnings, sourceFingerprint: await fingerprint(file), conversions: steps.map(({ id, checksum }) => ({ id, checksum })) };
  } catch (error) { if (error instanceof ImportError) throw error; throw new ImportError('INVALID_EXPORT', error.message); }
}
export function rebind(journal, uid) {
  const copy = structuredClone(journal);
  for (const type of collections) for (const record of copy[type]) {
    record.uid = uid;
    if (type === 'trades') {
      if (record.strategySnapshot) record.strategySnapshot.uid = uid;
      for (const child of children) for (const item of record[child]) { item.uid = uid; if (item.snapshot) item.snapshot.uid = uid; }
    }
  }
  copy.settings.uid = uid;
  return copy;
}
function comparable(data, type) {
  const copy = structuredClone(data);
  for (const key of ['uid', 'revision', 'schemaVersion', 'updatedAt', 'lastOperation']) delete copy[key];
  if (type === 'accounts') delete copy.hasTrades;
  if (type === 'instruments') delete copy.lastUsedAt;
  return copy;
}
export async function planImport(source, destination, { uid, projectId, mode, includeSettings = false }) {
  if (!['add', 'replace'].includes(mode)) throw new ImportError('INVALID_EXPORT', 'Choose add or replace import mode.');
  const incoming = rebind(source.journal, uid), old = rebuildJournal(destination);
  const target = mode === 'replace' ? structuredClone(incoming) : structuredClone(old);
  const conflicts = [], added = [], deleted = []; let skipped = 0;
  for (const type of collections) for (const record of incoming[type]) {
    const existing = old[type].find((r) => r.id === record.id);
    if (mode === 'replace') { if (!existing) added.push(`${type}/${record.id}`); continue; }
    if (!existing) { target[type].push(record); added.push(`${type}/${record.id}`); }
    else {
      const normalize = (r) => type === 'trades' ? { ...comparable(r, type), ...Object.fromEntries(children.map((c) => [c, r[c].map((item) => comparable(item, c)).sort((a, b) => a.id.localeCompare(b.id))])) } : comparable(r, type);
      if (await fingerprint(normalize(record)) === await fingerprint(normalize(existing))) skipped++;
      else conflicts.push(`${type}/${record.id}`);
    }
  }
  if (mode === 'replace') for (const { path } of destination) if (!flattenJournal(incoming).some((r) => r.path === path) && path !== 'settings/preferences') deleted.push(path);
  target.settings = includeSettings ? incoming.settings : structuredClone(old.settings);
  const warnings = [...source.warnings];
  if (target.settings.defaultAccount && !target.accounts.some((a) => a.id === target.settings.defaultAccount)) { target.settings.defaultAccount = null; warnings.push('Destination default account will be cleared because replacement removes it.'); }
  for (const account of target.accounts) account.hasTrades = account.hasTrades || target.trades.some((t) => t.accountId === account.id);
  const hash = await fingerprint({ source: source.sourceFingerprint, destination, uid, projectId, mode, includeSettings, conversions: source.conversions });
  return { fingerprint: hash, canApply: conflicts.length === 0, mode, includeSettings, added, deleted, skipped, conflicts, warnings, conversions: source.conversions, target };
}

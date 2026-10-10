import { canonical } from './fingerprint.js';
import { ValidationError } from '../domain/validation.js';

const types = ['legs', 'executions', 'adjustments'];
const metadata = new Set(['id', 'revision', 'createdAt', 'updatedAt', 'uid', 'schemaVersion', 'lastUsedAt']);
const sourceFields = {
  legs: ['snapshot', 'direction', 'planning'],
  executions: ['legId', 'kind', 'quantity', 'price', 'timestamp', 'fees', 'feeCurrency', 'feeRate', 'resultRate', 'manualGross', 'manualSource', 'orderReference', 'reason', 'sequence'],
  adjustments: ['amount', 'currency', 'rate', 'timestamp', 'reason'],
};
const snapshotFields = ['name', 'symbol', 'market', 'venue', 'preset', 'model', 'quantityUnit', 'priceUnit', 'quantityIncrement', 'priceIncrement', 'pointValue', 'currency', 'underlying', 'expiry', 'strike', 'optionType', 'draft', 'archived'];
const planningFields = ['entry', 'stop', 'target', 'riskBudget', 'rate', 'quantity'];
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function sourceValues(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record ?? null;
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => !metadata.has(key) && value !== undefined).map(([key, value]) => [key, sourceValues(value)]));
}
function changedFields(before, after) {
  const old = {}, next = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key], b = after[key];
    if (same(a, b)) continue;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const changed = changedFields(a, b); old[key] = changed.before; next[key] = changed.after;
    } else { if (a !== undefined) old[key] = a; if (b !== undefined) next[key] = b; }
  }
  return { before: old, after: next };
}
/** Changed source values only; no unchanged fields or persistence metadata. */
export function correctionDiff(previous, next) {
  if (!previous) return [];
  return types.flatMap((recordType) => (previous[recordType] || []).flatMap((before) => {
    const after = (next[recordType] || []).find((record) => record.id === before.id) || null;
    const project = (record) => sourceValues(recordType === 'legs' ? { snapshot: record.snapshot, direction: record.direction, planning: record.planning } : record);
    const values = after ? changedFields(project(before), project(after)) : { before: project(before), after: null };
    return after && !Object.keys(values.before).length && !Object.keys(values.after).length ? [] : [{ recordType, recordId: before.id, ...values }];
  }));
}
export function correctionReason(value, required = false) {
  const reason = typeof value === 'string' ? value.trim() : '';
  if ((required && !reason) || value != null && typeof value !== 'string' || reason.length > 1000)
    throw new ValidationError('Correction reason must contain 1–1,000 characters', { rule: 'CORRECTION_REASON', path: '/correctionReason' });
  return reason;
}
export const correctionId = (operationId) => operationId;
export function validateCorrection(record, uid) {
  const fail = () => { throw new ValidationError('Invalid correction history entry', { rule: 'CORRECTION_EVIDENCE', recordId: record?.id }); };
  const identifier = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
  const map = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!record || record.uid !== uid || !identifier.test(record.operationId) || record.id !== record.operationId || record.schemaVersion !== 2 || record.calculationVersion !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 1 || !Number.isFinite(Date.parse(record.createdAt)) || record.updatedAt !== record.createdAt) fail();
  if (Object.keys(record).some(key => !['id','uid','schemaVersion','calculationVersion','revision','createdAt','updatedAt','operationId','reason','changes'].includes(key))) fail();
  if (correctionReason(record.reason, true) !== record.reason || !Array.isArray(record.changes) || !record.changes.length) fail();
  const seen = new Set();
  for (const change of record.changes) {
    if (!change || Object.keys(change).some(key => !['recordType','recordId','before','after'].includes(key)) || !types.includes(change.recordType) || !identifier.test(change.recordId) || !map(change.before) || !(change.after === null || map(change.after)) || same(change.before, change.after) || change.after === null && !Object.keys(change.before).length) fail();
    const key = `${change.recordType}/${change.recordId}`;
    if (seen.has(key)) fail(); seen.add(key);
    for (const value of [change.before, change.after].filter(Boolean)) for (const [field, item] of Object.entries(value)) {
      if (!sourceFields[change.recordType].includes(field)) fail();
      const nested = change.recordType === 'legs' && ['snapshot', 'planning'].includes(field);
      if (nested) {
        const allowed = field === 'snapshot' ? snapshotFields : planningFields;
        if (!map(item) || Object.entries(item).some(([name, scalar]) => !allowed.includes(name) || !validScalar(scalar))) fail();
      } else if (!validScalar(item)) fail();
    }
  }
}
function validScalar(value) {
  return value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isSafeInteger(value) || typeof value === 'string' && value.length <= 10000;
}
export function validateCorrectionHistory(records, parentRevision) {
  const operations = new Set();
  for (const correction of records) {
    if (correction.revision > parentRevision || operations.has(correction.operationId))
      throw new ValidationError('Inconsistent correction operation history', { rule: 'CORRECTION_EVIDENCE', recordId: correction.id });
    operations.add(correction.operationId);
  }
}
export function correctionPage(records, page = 1, pageSize = 12) {
  const items = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  page = Math.max(1, Math.min(page, pages));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, pages, page };
}

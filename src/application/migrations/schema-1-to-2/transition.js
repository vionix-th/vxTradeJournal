import { validateSchema1 } from './validate-v1.js';
export const validateSource = validateSchema1;
const managed = (path) => {
  const parts = path.split('/');
  return parts[0] === 'users' && (parts.length === 4 && ['accounts', 'instruments', 'strategies', 'settings', 'trades'].includes(parts[2]) || parts.length === 6 && parts[2] === 'trades' && ['legs', 'executions', 'adjustments'].includes(parts[4]));
};
export function transform(records) {
  return records.filter(({ path }) => managed(path)).map(({ path, data }) => {
    const next = structuredClone(data);
    next.schemaVersion = 2;
    if (next.snapshot) next.snapshot.schemaVersion = 2;
    if (next.strategySnapshot) next.strategySnapshot.schemaVersion = 2;
    return { path, data: next };
  });
}
export function validateTarget(records) {
  const legacy = records.map(({ path, data }) => {
    const next = structuredClone(data);
    if (managed(path)) {
      if (next.schemaVersion !== 2) throw new Error(`Invalid schema-2 metadata: ${path}`);
      next.schemaVersion = 1;
      if (next.snapshot) next.snapshot.schemaVersion = 1;
      if (next.strategySnapshot) next.strategySnapshot.schemaVersion = 1;
    }
    return { path, data: next };
  });
  validateSchema1(legacy);
}

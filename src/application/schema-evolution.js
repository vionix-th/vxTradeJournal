import { SCHEMA_VERSION } from "../domain/journal.js";
import checksums from '../config/migrations.json' with { type: 'json' };
export function migrationChain(from, to, migrations, applied = []) {
  if (!Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < from) throw new Error("Unknown schema or schema downgrade.");
  const ids = new Set(), versions = new Set();
  for (const migration of migrations) {
    if (migration.to !== migration.from + 1 || ids.has(migration.id) || versions.has(migration.from) || !migration.checksum) throw new Error("Invalid adjacent migration registry.");
    ids.add(migration.id); versions.add(migration.from);
  }
  for (const receipt of applied) {
    const found = migrations.find((migration) => migration.id === receipt.id);
    if (!found || found.checksum !== receipt.checksum) throw new Error("Applied migration is missing or modified.");
  }
  const chain = [];
  for (let version = from; version < to; version++) {
    const migration = migrations.find((item) => item.from === version);
    if (!migration) throw new Error(`Missing migration ${version}→${version + 1}.`);
    chain.push(migration);
  }
  return chain;
}

export { validateSchema1 } from './migrations/schema-1-to-2/validate-v1.js';
import { validateTarget as validateSchema2Base, validateSource, transform } from './migrations/schema-1-to-2/transition.js';
import { validateCorrection, validateCorrectionHistory } from './corrections.js';
export function validateSchema2(documents) {
  validateSchema2Base(documents.filter(({ path }) => !path.includes('/corrections/')));
  const parents = new Map(documents.filter(({ path }) => path.split('/').length === 4).map(({ path, data }) => [path, data]));
  for (const { path, data } of documents) {
    if (path.split('/').length === 6 && path.includes('/legs/') && data.snapshot?.schemaVersion !== 2 || path.split('/').length === 4 && path.includes('/trades/') && data.strategySnapshot && data.strategySnapshot.schemaVersion !== 2) throw new Error(`Invalid snapshot metadata: ${path}`);
  }
  for (const { path, data } of documents.filter(({ path }) => path.includes('/corrections/'))) {
    const parts = path.split('/');
    if (parts.length !== 6 || parts[2] !== 'trades' || !parents.has(parts.slice(0, 4).join('/'))) throw new Error(`Orphan correction: ${path}`);
    validateCorrection(data, parts[1]);
    if (parts[5] !== data.id) throw new Error(`Invalid correction identity: ${path}`);
  }
  for (const [path, parent] of parents) if (path.split('/')[2] === 'trades') validateCorrectionHistory(documents.filter(record => record.path.startsWith(`${path}/corrections/`)).map(record => record.data), parent.revision);
}
const migrationPath = 'src/application/migrations/schema-1-to-2/';
export const migrationDefinitions = [{
  id: 'schema-1-to-2', from: 1, to: 2,
  sourcePath: `${migrationPath}transition.js`,
  dependencies: ['validate-v1.js', 'journal-v1.js', 'leg-capacity.js'].map((name) => `${migrationPath}${name}`),
  validateSource, transform, validateTarget: validateSchema2,
}];
export const schemaRegistry = { target: SCHEMA_VERSION, validators: new Map([[1, validateSource], [2, validateSchema2]]), migrations: migrationDefinitions.map((step) => ({ ...step, checksum: checksums[step.id] })) };

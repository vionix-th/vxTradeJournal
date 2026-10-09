import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { SCHEMA_VERSION } from "../../src/domain/journal.js";
import { schemaRegistry, migrationDefinitions } from "../../src/application/schema-evolution.js";
export { migrationChain, validateSchema1 } from "../../src/application/schema-evolution.js";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const metadata = (schemaVersion = SCHEMA_VERSION, status = "ready") => ({ metadataVersion: 1, schemaVersion, status });
/** Load immutable conversion code with a checksum covering declared dependencies. */
export async function loadMigration({ id, from, to, path, dependencies = [] }) {
  const sources = {};
  for (const file of [...new Set([path, ...dependencies])].sort()) sources[file] = hash(await readFile(file));
  const checksum = hash(JSON.stringify(sources));
  const module = await import(`${pathToFileURL(resolve(path)).href}?checksum=${checksum}`);
  for (const name of ["validateSource", "transform", "validateTarget"]) if (typeof module[name] !== "function") throw new Error(`Migration ${id} requires ${name}.`);
  return { id, from, to, checksum, validateSource: module.validateSource, transform: module.transform, validateTarget: module.validateTarget };
}
export const registry = { ...schemaRegistry, migrations: await Promise.all(migrationDefinitions.map(async (step) => {
  const loaded = await loadMigration({ ...step, path: step.sourcePath });
  if (schemaRegistry.migrations.find((item) => item.id === step.id)?.checksum !== loaded.checksum) throw new Error('Migration checksum manifest is stale.');
  return loaded;
})) };

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { SCHEMA_VERSION, normalizeAccount, normalizeInstrument, normalizeStrategy, validateSettings, calculateTrade } from "../../src/domain/journal.js";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const metadata = (schemaVersion = SCHEMA_VERSION, status = "ready") => ({ metadataVersion: 1, schemaVersion, status });
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

/** Load immutable conversion code with a checksum covering declared dependencies. */
export async function loadMigration({ id, from, to, path, dependencies = [] }) {
  const sources = {};
  for (const file of [...new Set([path, ...dependencies])].sort()) sources[file] = hash(await readFile(file));
  const checksum = hash(JSON.stringify(sources));
  const module = await import(`${pathToFileURL(resolve(path)).href}?checksum=${checksum}`);
  for (const name of ["validateSource", "transform", "validateTarget"]) if (typeof module[name] !== "function") throw new Error(`Migration ${id} requires ${name}.`);
  return { id, from, to, checksum, validateSource: module.validateSource, transform: module.transform, validateTarget: module.validateTarget };
}
const entityValidators = { accounts: normalizeAccount, instruments: normalizeInstrument, strategies: normalizeStrategy, settings: validateSettings };
export function validateSchema1(documents) {
  const map = new Map(documents.map((item) => [item.path, item.data]));
  for (const { path, data } of documents) {
    const parts = path.split("/");
    if (parts[0] !== "users" || parts.length % 2) throw new Error(`Invalid journal path: ${path}`);
    if (parts.length === 2) continue;
    const [, uid, type, id, child, childId] = parts;
    const managed = parts.length === 4 && (entityValidators[type] || type === "trades") || parts.length === 6 && type === "trades" && ["legs", "executions", "adjustments"].includes(child);
    if (managed && (data.uid !== uid || data.id !== (childId || id) || data.schemaVersion !== 1 || !Number.isInteger(data.revision) || data.revision < 1 || !Number.isFinite(Date.parse(data.createdAt)) || !Number.isFinite(Date.parse(data.updatedAt)))) throw new Error(`Invalid schema-1 metadata: ${path}`);
    if (parts.length === 4 && entityValidators[type]) entityValidators[type](structuredClone(data));
    if (parts.length === 4 && type === "trades") {
      const children = (name) => documents.filter((item) => item.path.startsWith(`${path}/${name}/`) && item.path.split("/").length === 6).map((item) => item.data);
      const trade = { ...data, legs: children("legs"), executions: children("executions"), adjustments: children("adjustments") };
      if (!map.has(`users/${uid}/accounts/${data.accountId}`)) throw new Error(`Missing trade account: ${path}`);
      for (const leg of trade.legs) {
        if (!map.has(`users/${uid}/instruments/${leg.instrumentId}`) || leg.snapshot?.uid !== uid) throw new Error(`Invalid leg reference: ${path}`);
        normalizeInstrument(leg.snapshot);
      }
      if (data.strategyId && (!map.has(`users/${uid}/strategies/${data.strategyId}`) || data.strategySnapshot?.uid !== uid)) throw new Error(`Invalid strategy reference: ${path}`);
      calculateTrade(trade); // Validation/replay only; never persist recalculated results.
    }
    if (parts.length === 6 && type === "trades" && !map.has(`users/${uid}/trades/${id}`)) throw new Error(`Orphan trade child: ${path}`);
    if (parts.length === 6 && child === "operations" && (data.uid !== uid || data.id !== childId)) throw new Error(`Invalid operation receipt: ${path}`);
  }
}
export const registry = { target: SCHEMA_VERSION, validators: new Map([[1, validateSchema1]]), migrations: [] };

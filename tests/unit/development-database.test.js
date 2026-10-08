import { afterEach, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { metadata, registry as baseline, hash } from "../../scripts/database/schema.js";
import { readSnapshot, decode } from "../../scripts/database/snapshot.js";
import { MemoryDatabase } from "../helpers/memory-database.js";
const directories = [];
const retained = { uid: "alice", id: "a", schemaVersion: 1, revision: 1, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", name: "Retained", currency: "USD", archived: false, hasTrades: false, amount: "123456789.123456789123456789" };
async function directory() { const path = await mkdtemp(join(tmpdir(), "vxj-dev-upgrade-")); directories.push(path); return path; }
async function upgrade(db, options = {}) {
  const { prepareDevelopmentDatabase } = await import("../../scripts/database/development.js");
  return prepareDevelopmentDatabase(db, { projectId: "demo-vxjournal-auto", profile: "auto", registry: baseline, log: () => {}, ...options });
}
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });

it("automatically registers retained schema-1 records after private backup without changing any values", async () => {
  const path = await directory();
  const records = { "users/alice/accounts/a": retained, "users/alice/unknown/missing/children/c": { exact: "0.123456789123456789", values: [false, null] } };
  const db = new MemoryDatabase(records);
  const result = await upgrade(db, { directory: path });
  expect(db.records.get("_system/database")).toEqual(metadata());
  for (const [key, value] of Object.entries(records)) expect(db.records.get(key)).toEqual(value);
  const snapshot = await readSnapshot(result.snapshot, "demo-vxjournal-auto");
  expect(snapshot.count).toBe(2);
  expect(decode(snapshot.records.find(item => item.path.endsWith("/a")).value, db)).toEqual(retained);
  expect(db.records.has("_system/lock")).toBe(false);
  expect(db.records.get(`_system/runs/history/${result.runId}`).status).toBe("complete");
});

it("creates the required schema for a genuinely empty database and makes repeat startup a no-op", async () => {
  const path = await directory();
  const db = new MemoryDatabase();
  const registry = { target: 3, migrations: [], validators: new Map([[3, documents => expect(documents).toEqual([])]]) };
  await upgrade(db, { directory: path, registry });
  expect(db.records.get("_system/database")).toEqual(metadata(3));
  const before = structuredClone([...db.records]);
  await upgrade(db, { directory: path, registry });
  expect([...db.records]).toEqual(before);
  expect(await readdir(path)).toEqual([]);
});

it("automatically resumes the same interrupted adjacent chain and reuses its original recovery file", async () => {
  const path = await directory();
  const db = new MemoryDatabase({ "_system/database": metadata(), "users/alice/accounts/a": retained });
  let fail = true;
  const calls = [];
  const migrations = [1, 2].map(from => ({ id: `${from}-${from + 1}`, from, to: from + 1, checksum: hash(`dev-step-${from}`), validateSource: () => {}, validateTarget: () => {}, transform: records => {
    calls.push(from);
    if (from === 2 && fail) throw new Error("injected interruption");
    return records.map(item => ({ ...item, data: { ...item.data, schemaVersion: from + 1 } }));
  } }));
  const registry = { target: 3, migrations, validators: new Map([1, 2, 3].map(version => [version, documents => { for (const { data } of documents) expect(data.schemaVersion).toBe(version); }])) };
  await expect(upgrade(db, { directory: path, registry })).rejects.toThrow("interruption");
  expect(db.records.get("_system/database")).toEqual(metadata(2, "maintenance"));
  const interrupted = db.records.get("_system/lock").runId;
  const original = db.records.get(`_system/runs/history/${interrupted}`).snapshot;
  const before = structuredClone([...db.records]);
  const changed = { ...registry, migrations: migrations.map(step => step.from === 2 ? { ...step, checksum: hash("changed-code") } : step) };
  await expect(upgrade(db, { directory: path, registry: changed })).rejects.toThrow("differs");
  expect([...db.records]).toEqual(before);
  fail = false;
  const result = await upgrade(db, { directory: path, registry });
  expect(result.runId).toBe(interrupted);
  expect(result.snapshot).toBe(original);
  expect(calls).toEqual([1, 2, 2]);
  expect(db.records.get("_system/database")).toEqual(metadata(3));
  expect(db.records.get("users/alice/accounts/a").amount).toBe(retained.amount);
  expect(await readdir(path)).toEqual([`${interrupted}.json`]);
  expect((await readSnapshot(original, "demo-vxjournal-auto")).schemaVersion).toBe(1);
  await upgrade(db, { directory: path, registry });
  expect(calls).toEqual([1, 2, 2]);
});

it("keeps failed legacy validation in maintenance with backup and unchanged journal records", async () => {
  const path = await directory();
  const invalid = { ...retained, schemaVersion: 7 };
  const db = new MemoryDatabase({ "users/alice/accounts/a": invalid });
  await expect(upgrade(db, { directory: path })).rejects.toThrow("Invalid schema");
  expect(db.records.get("_system/database").status).toBe("maintenance");
  expect(db.records.get("users/alice/accounts/a")).toEqual(invalid);
  expect(await readdir(path)).toHaveLength(1);
});

it("rejects unknown schemas, missing paths and competing live runs without changing database state", async () => {
  for (const [db, options, error] of [
    [new MemoryDatabase({ "_system/database": metadata(7) }), {}, "Unknown"],
    [new MemoryDatabase({ "_system/database": metadata() }), { registry: { ...baseline, target: 2, validators: new Map([[1, () => {}], [2, () => {}]]) } }, "Missing migration"],
    [new MemoryDatabase({ "_system/database": metadata(), "_system/lock": { runId: "other", owner: "live", expiresAt: Date.now() + 120000 } }), {}, "owns"],
  ]) {
    const before = structuredClone([...db.records]);
    await expect(upgrade(db, options)).rejects.toThrow(error);
    expect([...db.records]).toEqual(before);
  }
});

it("never mutates data or creates recovery files during development dry run", async () => {
  const path = await directory();
  const db = new MemoryDatabase({ "users/alice/accounts/a": retained });
  const before = structuredClone([...db.records]);
  expect(await upgrade(db, { directory: path, dryRun: true })).toMatchObject({ registerExistingSchema: 1, backupRequired: true });
  expect([...db.records]).toEqual(before);
  expect(await readdir(path)).toEqual([]);
});

it("rejects production automatic upgrade and ambiguous legacy commands before database access", async () => {
  const db = new MemoryDatabase();
  await expect(upgrade(db, { profile: "prod", projectId: "vionixtradejournal" })).rejects.toThrow("emulator-only");
  expect(db.records.size).toBe(0);
  const { argumentsFor } = await import("../../scripts/database/arguments.js");
  expect(argumentsFor(["deploy", "--profile", "prod", "--register-existing-schema", "1"]).options["--register-existing-schema"]).toBe("1");
  expect(() => argumentsFor(["initialize", "--profile", "dev"])).toThrow("upgrade");
  expect(() => argumentsFor(["deploy", "--profile", "prod", "--bootstrap-schema", "1"])).toThrow("register-existing-schema");
  expect(() => argumentsFor(["upgrade", "--profile", "prod"])).toThrow("emulator-only");
});

it("keeps an interrupted automatic upgrade guarded and resumes after the last verified step", async () => {
  const path = await directory();
  const db = new MemoryDatabase({ "_system/database": metadata(), "users/alice/accounts/a": retained });
  const controller = new AbortController();
  const step = { id: "1-2", from: 1, to: 2, checksum: hash("abort-step"), validateSource: () => {}, validateTarget: () => {}, transform: records => {
    controller.abort();
    return records.map(item => ({ ...item, data: { ...item.data, schemaVersion: 2 } }));
  } };
  const registry = { target: 2, migrations: [step], validators: new Map([[1, () => {}], [2, documents => { for (const item of documents) expect(item.data.schemaVersion).toBe(2); }]]) };
  await expect(upgrade(db, { directory: path, registry, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(db.records.get("_system/database")).toEqual(metadata(2, "maintenance"));
  expect(db.records.get("users/alice/accounts/a").amount).toBe(retained.amount);
  const runId = db.records.get("_system/lock").runId;
  await upgrade(db, { directory: path, registry });
  expect(db.records.get("_system/database")).toEqual(metadata(2));
  expect(db.records.get(`_system/runs/history/${runId}`).status).toBe("complete");
});

it("does not overwrite an upgrade completed between preflight and lease acquisition", async () => {
  const path = await directory();
  const db = new MemoryDatabase({ "_system/database": metadata(), "users/alice/accounts/a": retained });
  const step = { id: "1-2", from: 1, to: 2, checksum: hash("concurrent-step"), validateSource: documents => {
    for (const item of documents) if (item.data.schemaVersion !== 1) throw new Error("Source already advanced");
  }, validateTarget: () => {}, transform: records => records.map(item => ({ ...item, data: { ...item.data, schemaVersion: 2 } })) };
  const registry = { target: 2, migrations: [step], validators: new Map([[1, () => {}], [2, documents => { for (const item of documents) expect(item.data.schemaVersion).toBe(2); }]]) };
  const transact = db.runTransaction.bind(db);
  let advanced = false;
  db.runTransaction = async operation => {
    if (!advanced) {
      advanced = true;
      db.records.set("_system/database", metadata(2));
      db.records.set("users/alice/accounts/a", { ...retained, schemaVersion: 2 });
      db.records.set("_system/evolution", { applied: [{ id: step.id, from: 1, to: 2, checksum: step.checksum }] });
    }
    return transact(operation);
  };
  await expect(upgrade(db, { directory: path, registry })).rejects.toMatchObject({ code: "DATABASE_PREFLIGHT_CHANGED" });
  expect(db.records.get("_system/database")).toEqual(metadata(2));
  await upgrade(db, { directory: path, registry });
  expect(db.records.get("_system/database")).toEqual(metadata(2));
  expect(await readdir(path)).toEqual([]);
});

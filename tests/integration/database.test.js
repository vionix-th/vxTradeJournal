import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { connectAdmin, journalDocuments } from "../../scripts/database/admin.js";
import { Lease } from "../../scripts/database/lease.js";
import { migrate } from "../../scripts/database/migrate.js";
import { writeSnapshot, readSnapshot, restoreSnapshot } from "../../scripts/database/snapshot.js";
import { metadata, hash, validateSchema1, registry as currentRegistry } from "../../scripts/database/schema.js";
import { createTrade } from "../../src/domain/journal.js";
import { Repository } from "../../src/persistence/repository.js";
import { readyDatabase } from "../helpers/database.js";
let env, admin;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-vxjournal-auto", firestore: { host: "127.0.0.1", port: 8280, rules: readFileSync("firestore.rules", "utf8") } });
  admin = connectAdmin("auto");
});
beforeEach(async () => { await env.clearFirestore(); await readyDatabase(env); });
afterAll(async () => { await admin?.close(); await env?.cleanup(); });
it("checks availability at commit even when client preflight already succeeded", async () => {
  const client = env.authenticatedContext("alice", { email_verified: true }).firestore();
  const repo = new Repository(client, "alice");
  await repo.saveEntity("accounts", { id: "a", name: "Main", currency: "USD" });
  await readyDatabase(env, { status: "maintenance" });
  await expect(repo.saveEntity("accounts", { id: "b", name: "Blocked", currency: "USD" })).rejects.toMatchObject({ code: "DATABASE_MAINTENANCE" });
  await assertFails(getDoc(doc(client, "users/alice/accounts/a")));
  // Internal operation skips preflight deliberately; persistence must still deny it.
  await expect(repo._saveEntity("accounts", { id: "b", name: "Blocked", currency: "USD" })).rejects.toMatchObject({ code: "permission-denied" });
  expect((await admin.db.doc("users/alice/accounts/b").get()).exists).toBe(false);
});
it("serializes competing real leases and fences expired owners", async () => {
  const first = new Lease(admin.db, "first", { commit: "a" }); await first.acquire();
  const competitor = new Lease(admin.db, "second", { commit: "a" });
  await expect(competitor.acquire()).rejects.toThrow("owns");
  await admin.db.doc("_system/lock").update({ expiresAt: 0 });
  const resumed = new Lease(admin.db, "first", { commit: "a" }); await resumed.acquire(true);
  await expect(first.renew()).rejects.toThrow("lost");
  await resumed.release();
});
it("recovers partial real migrations and restores missing-parent journal records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vxj-recovery-"));
  try {
    await admin.db.doc("_system/database").set(metadata(1, "maintenance"));
    await admin.db.doc("users/alice/accounts/a").set({ id: "a", uid: "alice", schemaVersion: 1, revision: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", name: "Main", currency: "USD", archived: false, hasTrades: false });
    validateSchema1(await journalDocuments(admin.db));
    await admin.db.doc("users/alice/trades/missing/operations/r").set({ id: "r", uid: "alice", gross: "123456789.123456789123456789" });
    const lease = new Lease(admin.db, "migration", { commit: "a" }); await lease.acquire();
    const snapshot = await readSnapshot(await writeSnapshot(admin.db, lease, admin.projectId, 1, directory), admin.projectId);
    let fail = true;
    const migrations = [1, 2].map((from) => ({ id: `${from}-${from + 1}`, from, to: from + 1, checksum: hash(String(from)), validateSource: async () => {}, validateTarget: async () => {}, transform: async (records) => {
      if (from === 2 && fail) throw new Error("Injected crash");
      return records.map((record) => ({ ...record, data: { ...record.data, schemaVersion: from + 1 } }));
    } }));
    const registry = { target: 3, migrations, validators: new Map([1, 2, 3].map((version) => [version, () => {}])) };
    await expect(migrate(admin.db, lease, registry)).rejects.toThrow("Injected crash");
    expect((await admin.db.doc("_system/database").get()).data().schemaVersion).toBe(2);
    fail = false;
    await migrate(admin.db, lease, registry);
    expect((await admin.db.doc("_system/evolution").get()).data().applied.map((receipt) => receipt.id)).toEqual(["1-2", "2-3"]);
    await admin.db.doc("users/alice/accounts/new").set({ new: true });
    await restoreSnapshot(admin.db, lease, snapshot);
    expect((await admin.db.doc("users/alice/accounts/new").get()).exists).toBe(false);
    expect((await admin.db.doc("users/alice/trades/missing/operations/r").get()).data().gross).toBe("123456789.123456789123456789");
    expect((await admin.db.doc("_system/database").get()).data()).toEqual(metadata(1, "maintenance"));
    await lease.release();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("automatically registers retained emulator data after backup under enforced maintenance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vxj-baseline-"));
  try {
    const client = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const repo = new Repository(client, "alice");
    const account = await repo.saveEntity("accounts", { id: "a", name: "Retained", currency: "USD" });
    const instrument = await repo.saveEntity("instruments", { id: "i", name: "Retained equity", symbol: "R", market: "Equities", preset: "equity", model: "linear", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1", currency: "USD" });
    const strategy = await repo.saveEntity("strategies", { id: "s", name: "Retained strategy" });
    const trade = createTrade({ id: "t", account, strategy, instruments: [{ instrument, direction: "long" }] });
    trade.executions = ['entry', 'exit'].map((kind, index) => ({ id: `e${index}`, legId: trade.legs[0].id, kind, quantity: '2', price: index ? '12' : '10', timestamp: `2026-01-0${index + 1}T00:00:00Z`, fees: '1', feeCurrency: 'USD' }));
    await repo.saveTrade(trade, 'retained-source');
    for (const record of await journalDocuments(admin.db)) {
      const data = structuredClone(record.data);
      if (data.schemaVersion === 2) data.schemaVersion = 1;
      if (data.snapshot) data.snapshot.schemaVersion = 1;
      if (data.strategySnapshot) data.strategySnapshot.schemaVersion = 1;
      await admin.db.doc(record.path).set(data);
    }
    await admin.db.doc("users/alice/unknown/missing/children/c").set({ exact: "123456789.123456789123456789" });
    const original = await journalDocuments(admin.db);
    await admin.db.doc("_system/database").delete();
    const { prepareDevelopmentDatabase } = await import("../../scripts/database/development.js");
    const registry = { ...currentRegistry, validators: new Map([...currentRegistry.validators, [1, async documents => {
      expect((await admin.db.doc("_system/database").get()).data().status).toBe("maintenance");
      await assertFails(getDoc(doc(client, "users/alice/accounts/a")));
      const runId = (await admin.db.doc("_system/lock").get()).data().runId;
      const recovery = (await admin.db.doc(`_system/runs/history/${runId}`).get()).data().snapshot;
      expect((await readSnapshot(recovery, admin.projectId)).count).toBe(original.length);
      validateSchema1(documents);
    }]]) };
    const result = await prepareDevelopmentDatabase(admin.db, { profile: "auto", projectId: admin.projectId, directory, registry, log: () => {} });
    const backup = await readSnapshot(result.snapshot, admin.projectId);
    expect(backup.count).toBe(original.length);
    expect(backup.schemaVersion).toBe(1);
    expect((await admin.db.doc("users/alice/accounts/a").get()).data()).toEqual({ ...original.find(record => record.path === "users/alice/accounts/a").data, schemaVersion: 2 });
    const expected = original.map(({ path, data }) => ({ path, data: { ...data, ...(data.schemaVersion === 1 ? { schemaVersion: 2 } : {}), ...(data.snapshot ? { snapshot: { ...data.snapshot, schemaVersion: 2 } } : {}), ...(data.strategySnapshot ? { strategySnapshot: { ...data.strategySnapshot, schemaVersion: 2 } } : {}) } }));
    expect(await journalDocuments(admin.db)).toEqual(expected);
    expect((await repo.getTrade('t')).corrections).toEqual([]);
    expect((await admin.db.doc("users/alice/unknown/missing/children/c").get()).data().exact).toBe("123456789.123456789123456789");
    expect((await admin.db.doc("_system/database").get()).data()).toEqual(metadata());
    expect((await repo.getTrade("t")).summary.accountNet).toBe("2");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("automatically resumes a real failed adjacent upgrade with the same backup and completion ledger", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vxj-dev-resume-"));
  try {
    const client = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const repo = new Repository(client, "alice");
    const account = await repo.saveEntity("accounts", { id: "a", name: "Retained", currency: "USD" });
    await admin.db.doc("users/alice/accounts/a").set({ ...account, schemaVersion: 1 });
    await admin.db.doc("_system/database").set(metadata(1));
    await admin.db.doc("users/alice/unknown/missing/children/c").set({ exact: "123456789.123456789123456789", schemaVersion: 1 });
    const { prepareDevelopmentDatabase } = await import("../../scripts/database/development.js");
    let fail = true;
    const calls = [];
    const migrations = [1, 2].map(from => ({ id: `dev-${from}`, from, to: from + 1, checksum: hash(`dev-${from}`), validateSource: () => {}, validateTarget: () => {}, transform: records => {
      calls.push(from);
      if (from === 2 && fail) throw new Error("Injected automatic upgrade failure");
      return records.map(item => ({ ...item, data: { ...item.data, schemaVersion: from + 1 } }));
    } }));
    const registry = { target: 3, migrations, validators: new Map([1, 2, 3].map(version => [version, documents => { for (const item of documents) expect(item.data.schemaVersion).toBe(version); }])) };
    const options = { profile: "auto", projectId: admin.projectId, directory, registry, log: () => {} };
    await expect(prepareDevelopmentDatabase(admin.db, options)).rejects.toThrow("Injected");
    expect((await admin.db.doc("_system/database").get()).data()).toEqual(metadata(2, "maintenance"));
    await assertFails(getDoc(doc(client, "users/alice/accounts/a")));
    const runId = (await admin.db.doc("_system/lock").get()).data().runId;
    const snapshot = (await admin.db.doc(`_system/runs/history/${runId}`).get()).data().snapshot;
    fail = false;
    const result = await prepareDevelopmentDatabase(admin.db, options);
    expect(result.runId).toBe(runId);
    expect(result.snapshot).toBe(snapshot);
    expect(calls).toEqual([1, 2, 2]);
    expect((await readSnapshot(snapshot, admin.projectId)).schemaVersion).toBe(1);
    expect((await admin.db.doc("_system/database").get()).data()).toEqual(metadata(3));
    expect((await admin.db.doc("users/alice/unknown/missing/children/c").get()).data().exact).toBe("123456789.123456789123456789");
    expect((await admin.db.doc("_system/evolution").get()).data().applied).toHaveLength(2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

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
import { metadata, hash, validateSchema1 } from "../../scripts/database/schema.js";
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

it("explicitly initializes retained emulator data without changing journal values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vxj-baseline-"));
  try {
    const client = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const repo = new Repository(client, "alice");
    const account = await repo.saveEntity("accounts", { id: "a", name: "Retained", currency: "USD" });
    await admin.db.doc("_system/database").delete();
    const { initializeBaseline, initializeEmptyDatabase } = await import("../../scripts/database/initialize.js");
    await expect(initializeEmptyDatabase("auto")).rejects.toMatchObject({ code: "DATABASE_BASELINE_REQUIRED" });
    expect((await admin.db.doc("_system/database").get()).exists).toBe(false);
    expect((await admin.db.doc("users/alice/accounts/a").get()).data()).toEqual(account);
    const lease = new Lease(admin.db, "baseline", { schemaVersion: 1 }); await lease.acquire();
    await initializeBaseline(admin.db, lease, admin.projectId, directory);
    expect((await admin.db.doc("users/alice/accounts/a").get()).data()).toEqual(account);
    expect((await admin.db.doc("_system/database").get()).data()).toEqual(metadata());
  } finally { await rm(directory, { recursive: true, force: true }); }
});

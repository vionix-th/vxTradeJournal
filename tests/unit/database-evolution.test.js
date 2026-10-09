import { describe, it, expect } from "vitest";
import { checkDatabase } from "../../src/persistence/availability.js";
import { migrationChain, metadata, hash } from "../../scripts/database/schema.js";
import { adminTarget, journalDocuments } from "../../scripts/database/admin.js";
import { Lease } from "../../scripts/database/lease.js";
import { migrate } from "../../scripts/database/migrate.js";
import { deploymentPlan, deployDatabase } from "../../scripts/database/deploy.js";
import { MemoryDatabase } from "../helpers/memory-database.js";
const transitions = [1, 2, 3].map((from) => ({ id: `${from}-${from + 1}`, from, to: from + 1, checksum: hash(`step-${from}`) }));
describe("database evolution contracts", () => {
  it('rejects schema deployment while any user import remains active without writes', async () => {
    const db = new MemoryDatabase({ '_system/database': metadata(1), 'users/alice/_journal/control': { state: 'import', operationId: 'restore' } });
    const registry = { target: 2, migrations: [transitions[0]], validators: new Map([[1, () => {}], [2, () => {}]]) };
    await expect(deploymentPlan(db, registry, { rulesHash: 'next' })).rejects.toThrow('Active journal imports');
    expect(db.records.get('_system/database')).toEqual(metadata(1));
  });
  it("uses adjacent schema steps independent of application versions", () => {
    expect(migrationChain(1, 4, transitions).map((step) => step.id)).toEqual(["1-2", "2-3", "3-4"]);
    expect(migrationChain(3, 4, transitions).map((step) => step.id)).toEqual(["3-4"]);
    expect(migrationChain(1, 1, [])).toEqual([]);
    expect(() => migrationChain(1, 4, transitions.slice(1))).toThrow("Missing migration");
    expect(() => migrationChain(4, 1, transitions)).toThrow("downgrade");
    expect(() => migrationChain(2, 4, transitions, [{ id: "1-2", checksum: "modified" }])).toThrow("modified");
    expect(() => migrationChain(1, 4, [...transitions, transitions[0]])).toThrow("registry");
  });
  it("fails closed on missing, unsupported, maintenance and mismatched schemas", () => {
    expect(checkDatabase(metadata())).toEqual(metadata());
    for (const [value, code] of [[null, "DATABASE_NOT_INITIALIZED"], [{ ...metadata(), metadataVersion: 2 }, "DATABASE_NOT_INITIALIZED"], [metadata(1, "maintenance"), "DATABASE_MAINTENANCE"], [metadata(2), "SCHEMA_VERSION_MISMATCH"]]) {
      try { checkDatabase(value); throw new Error("Unexpected success"); } catch (error) { expect(error.code).toBe(code); }
    }
  });
  it("pins production and rejects emulator overrides or foreign demo endpoints", () => {
    expect(adminTarget("prod", {})).toEqual({ projectId: "vionixtradejournal" });
    expect(() => adminTarget("prod", { FIRESTORE_EMULATOR_HOST: "localhost:8080" })).toThrow("overrides");
    expect(() => adminTarget("auto", { FIRESTORE_EMULATOR_HOST: "foreign:8280" })).toThrow("differs");
    expect(() => adminTarget(undefined, {})).toThrow("Explicit");
  });
  it("preflight never writes and requires explicit baseline", async () => {
    const db = new MemoryDatabase();
    const registry = { target: 1, migrations: [], validators: new Map([[1, () => {}]]) };
    await expect(deploymentPlan(db, registry, { rulesHash: "rules" })).rejects.toThrow("register-existing-schema");
    expect(await deploymentPlan(db, registry, { rulesHash: "rules" }, 1)).toMatchObject({ bootstrap: true, maintenance: true });
    expect(db.records.size).toBe(0);
  });
  it("fences expired owners and requires explicit matching resume", async () => {
    const db = new MemoryDatabase();
    const first = new Lease(db, "run", { commit: "a" });
    await first.acquire();
    await expect(new Lease(db, "other", { commit: "a" }).acquire()).rejects.toThrow("owns");
    db.records.get("_system/lock").expiresAt = 0;
    await expect(new Lease(db, "other", { commit: "a" }).acquire()).rejects.toThrow("resume");
    await expect(new Lease(db, "run", { commit: "b" }).acquire(true)).rejects.toThrow("differs");
    const second = new Lease(db, "run", { commit: "a" });
    await second.acquire(true);
    await expect(first.transaction(async () => {})).rejects.toThrow("lost");
  });
  it("checkpoint and conversion commit together; interrupted chain resumes", async () => {
    const db = new MemoryDatabase({ "_system/database": metadata(1, "maintenance"), "users/alice/accounts/a": { schemaVersion: 1, amount: "100.123456789123456789" } });
    const calls = [];
    let fail = true;
    const steps = transitions.map((step) => ({ ...step, validateSource: async () => {}, validateTarget: async () => {}, transform: async (records) => {
      calls.push(step.id);
      if (step.from === 2 && fail) throw new Error("injected interruption");
      return records.map((record) => ({ ...record, data: { ...record.data, schemaVersion: step.to } }));
    } }));
    const registry = { target: 4, migrations: steps, validators: new Map([1, 2, 3, 4].map((version) => [version, (documents) => { for (const item of documents) expect(item.data.schemaVersion).toBe(version); }])) };
    const lease = new Lease(db, "run", { commit: "a" }); await lease.acquire();
    await expect(migrate(db, lease, registry)).rejects.toThrow("interruption");
    expect(db.records.get("_system/database")).toEqual(metadata(2, "maintenance"));
    expect(db.records.get("users/alice/accounts/a").schemaVersion).toBe(2);
    fail = false;
    await migrate(db, lease, registry);
    expect(calls).toEqual(["1-2", "2-3", "2-3", "3-4"]);
    expect(db.records.get("_system/database")).toEqual(metadata(4, "maintenance"));
    expect(db.records.get("users/alice/accounts/a").amount).toBe("100.123456789123456789");
    expect((await journalDocuments(db)).length).toBe(1);
  });
  it("Hosting failure keeps maintenance and verified publication precedes reopening", async () => {
    const db = new MemoryDatabase({ "_system/database": metadata(), "_system/release": { rulesHash: "before" } });
    const identity = { projectId: "demo-test", rulesHash: "after" };
    const lease = new Lease(db, "run", identity); await lease.acquire();
    const events = [];
    const registry = { target: 1, migrations: [], validators: new Map([[1, () => events.push("validate")]]) };
    const args = { db, lease, registry, identity, publishRules: async () => events.push("rules"), wait: async () => events.push("barrier"), publishHosting: async () => { events.push("hosting"); throw new Error("Hosting failed"); }, verifyHosting: async () => events.push("verify") };
    await expect(deployDatabase(args)).rejects.toThrow("Hosting failed");
    expect(db.records.get("_system/database").status).toBe("maintenance");
    await deployDatabase({ ...args, publishHosting: async () => events.push("hosting"), verifyHosting: async () => { expect(db.records.get("_system/database").status).toBe("maintenance"); events.push("verify"); } });
    expect(events).toEqual(["rules", "barrier", "validate", "hosting", "barrier", "validate", "hosting", "verify"]);
    expect(db.records.get("_system/database").status).toBe("ready");
  });
});

it("snapshot failure prevents migration and Hosting publication, preserving maintenance", async () => {
  const db = new MemoryDatabase({ "users/alice/accounts/a": { unsupported: new Date() } });
  const lease = new Lease(db, "failed-backup", { projectId: "demo-test", rulesHash: "rules" }); await lease.acquire();
  const events = [];
  const registry = { target: 1, migrations: [], validators: new Map([[1, () => events.push("validate")]]) };
  await expect(deployDatabase({ db, lease, registry, identity: lease.identity, bootstrap: 1, publishRules: async () => events.push("rules"), wait: async () => events.push("barrier"), publishHosting: async () => events.push("hosting"), verifyHosting: async () => {} })).rejects.toThrow("Unsupported");
  expect(events).toEqual(["rules", "barrier"]);
  expect(db.records.get("_system/database").status).toBe("maintenance");
});

it("interrupted bootstrap retains backup obligation and uncertain rules require republication", async () => {
  const db = new MemoryDatabase();
  const identity = { projectId: "demo-test", rulesHash: "new" };
  const lease = new Lease(db, "run", identity); await lease.acquire();
  const registry = { target: 1, migrations: [], validators: new Map([[1, () => {}]]) };
  await expect(deployDatabase({ db, lease, registry, identity, bootstrap: 1, publishRules: async () => { throw new Error("Uncertain rules publication"); }, wait: async () => {}, publishHosting: async () => {}, verifyHosting: async () => {} })).rejects.toThrow("Uncertain");
  expect(db.records.get("_system/runs/history/run").backupRequired).toBe(true);
  expect(db.records.get("_system/rules").status).toBe("pending");
  expect((await deploymentPlan(db, registry, identity)).rulesChanged).toBe(true);
  db.records.set("_system/rules", { status: "published", rulesHash: "new" });
  expect((await deploymentPlan(db, registry, { ...identity, rulesHash: "old" })).rulesChanged).toBe(true);
});

it("compares resume identity by values rather than Firestore map key order", async () => {
  const db = new MemoryDatabase();
  const first = new Lease(db, "run", { commit: "a", schemaVersion: 1 }); await first.acquire();
  db.records.get("_system/lock").expiresAt = 0;
  const resume = new Lease(db, "run", { schemaVersion: 1, commit: "a" });
  await expect(resume.acquire(true)).resolves.toBeUndefined();
});

it("rejects privileged migration writes that move journal records to another owner", async () => {
  const db = new MemoryDatabase({ "_system/database": metadata(1, "maintenance"), "users/alice/accounts/a": { uid: "alice", schemaVersion: 1 } });
  const lease = new Lease(db, "ownership", { commit: "a" }); await lease.acquire();
  const step = { ...transitions[0], validateSource: async () => {}, validateTarget: async () => {}, transform: async () => [{ path: "users/bob/accounts/a", data: { uid: "bob", schemaVersion: 2 } }] };
  const registry = { target: 2, migrations: [step], validators: new Map([[1, () => {}], [2, () => {}]]) };
  await expect(migrate(db, lease, registry)).rejects.toThrow("ownership");
  expect(db.records.has("users/bob/accounts/a")).toBe(false);
});

it("resumes mixed-version records after a mid-step chunk interruption", async () => {
  const records = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`users/alice/accounts/a-${String(index).padStart(3, "0")}`, { uid: "alice", schemaVersion: 1, amount: "0.123456789123456789" }]));
  const db = new MemoryDatabase({ "_system/database": metadata(1, "maintenance"), ...records });
  const lease = new Lease(db, "chunks", { commit: "a" }); await lease.acquire();
  let calls = 0, sourceChecks = 0, fail = true;
  const step = { ...transitions[0], validateSource: async (documents) => { sourceChecks++; expect(documents.every((item) => item.data.schemaVersion === 1)).toBe(true); }, validateTarget: async () => {}, transform: async (chunk) => {
    calls++;
    if (calls === 2 && fail) throw new Error("Mid-step failure");
    return chunk.map((item) => ({ ...item, data: { ...item.data, schemaVersion: 2 } }));
  } };
  const registry = { target: 2, migrations: [step], validators: new Map([[1, () => {}], [2, (documents) => expect(documents.every((item) => item.data.schemaVersion === 2)).toBe(true)]]) };
  await expect(migrate(db, lease, registry)).rejects.toThrow("Mid-step");
  expect((await journalDocuments(db)).filter((item) => item.data.schemaVersion === 2)).toHaveLength(100);
  expect(db.records.get("_system/database")).toEqual(metadata(1, "maintenance"));
  fail = false;
  await migrate(db, lease, registry);
  expect(sourceChecks).toBe(1);
  expect((await journalDocuments(db)).every((item) => item.data.schemaVersion === 2 && item.data.amount === "0.123456789123456789")).toBe(true);
  expect(db.records.get("_system/database")).toEqual(metadata(2, "maintenance"));
});

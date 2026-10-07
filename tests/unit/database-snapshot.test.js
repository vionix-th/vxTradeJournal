import { it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Timestamp, GeoPoint } from "firebase-admin/firestore";
import { encode, decode, readSnapshot, snapshotPayload, writeSnapshot, restoreSnapshot } from "../../scripts/database/snapshot.js";
import { hash, metadata } from "../../scripts/database/schema.js";
import { MemoryDatabase } from "../helpers/memory-database.js";
import { Lease } from "../../scripts/database/lease.js";
it("round trips lossless values and rejects unsupported or unsafe values", () => {
  const value = { amount: "1234567890.123456789", timestamp: new Timestamp(17, 123), geo: new GeoPoint(12, 13), bytes: Buffer.from("data"), list: [null, true, 1.5], tags: { scalar: "map" } };
  expect(encode(decode(encode(value), {}))).toEqual(encode(value));
  expect(() => encode(new Date())).toThrow("Unsupported");
  expect(() => encode(9007199254740992)).toThrow("Unsupported");
});
it("snapshots missing-parent descendants and restores exact journal contents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vxj-backup-"));
  try {
    const db = new MemoryDatabase({ "_system/database": metadata(1, "maintenance"), "users/alice/trades/t/operations/r": { id: "r", uid: "alice", amount: "0.000000000001" } });
    const lease = new Lease(db, "recovery", { commit: "a" }); await lease.acquire();
    const path = await writeSnapshot(db, lease, "demo-test", 1, directory);
    const snapshot = await readSnapshot(path, "demo-test");
    expect(snapshot.records[0].path).toBe("users/alice/trades/t/operations/r");
    expect(await writeSnapshot(db, lease, "demo-test", 1, directory)).toBe(path);
    db.records.set("users/alice/accounts/new", { createdByMigration: true });
    db.records.set("users/alice/trades/t/operations/r", { changed: true });
    await restoreSnapshot(db, lease, snapshot);
    expect(db.records.has("users/alice/accounts/new")).toBe(false);
    expect(db.records.get("users/alice/trades/t/operations/r").amount).toBe("0.000000000001");
    expect(db.records.get("_system/database").status).toBe("maintenance");
    await expect(readSnapshot(path, "foreign-project")).rejects.toThrow("identity");
    const payload = snapshotPayload([], "demo-test", 1);
    await writeFile(join(directory, "corrupt.json"), JSON.stringify({ ...payload, count: 5, checksum: hash(JSON.stringify(payload)) }), { mode: 0o600 });
    await expect(readSnapshot(join(directory, "corrupt.json"), "demo-test")).rejects.toThrow("integrity");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("rejects malformed typed values even when envelope hash could be recomputed", () => {
  for (const value of [["scalar", {}], ["number", 9007199254740992], ["map", [["a", ["scalar", 1]], ["a", ["scalar", true]]]], ["bytes", "not-base64"], ["reference", "invalid"], ["scalar", true, "extra"]]) expect(() => decode(value, {})).toThrow();
});

it("repeats interrupted restoration without reopening partial data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vxj-partial-restore-"));
  try {
    const records = Object.fromEntries(Array.from({ length: 205 }, (_, index) => [`users/alice/accounts/a-${String(index).padStart(3, "0")}`, { amount: "42.123456789" }]));
    const db = new MemoryDatabase({ "_system/database": metadata(1, "maintenance"), ...records });
    const lease = new Lease(db, "partial", { commit: "a" }); await lease.acquire();
    const snapshot = await readSnapshot(await writeSnapshot(db, lease, "demo-test", 1, directory), "demo-test");
    for (const path of Object.keys(records)) db.records.set(path, { changed: true });
    db.records.set("users/alice/accounts/new", { createdByMigration: true });
    db.records.set("_system/database", metadata(2, "maintenance"));
    const transaction = lease.transaction.bind(lease);
    let count = 0;
    lease.transaction = async (operation) => { if (++count === 2) throw new Error("Interrupted restore"); return transaction(operation); };
    await expect(restoreSnapshot(db, lease, snapshot)).rejects.toThrow("Interrupted restore");
    expect(db.records.get("_system/database")).toEqual(metadata(2, "maintenance"));
    expect(db.records.get("_system/runs/history/partial").restoreCheckpoint).toBe(100);
    lease.transaction = transaction;
    await restoreSnapshot(db, lease, snapshot);
    expect(db.records.has("users/alice/accounts/new")).toBe(false);
    expect(Object.keys(records).every((path) => db.records.get(path).amount === "42.123456789")).toBe(true);
    expect(db.records.get("_system/database")).toEqual(metadata(1, "maintenance"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

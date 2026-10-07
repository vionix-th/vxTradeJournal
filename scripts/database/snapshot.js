import { mkdir, lstat, readFile, open, link, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";
import { hash } from "./schema.js";
import { journalDocuments } from "./admin.js";

export function encode(value, db) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return ["scalar", value];
  if (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return ["number", value];
  if (value instanceof Timestamp) return ["timestamp", value.seconds, value.nanoseconds];
  if (value instanceof GeoPoint) return ["geo", value.latitude, value.longitude];
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return ["bytes", Buffer.from(value).toString("base64")];
  if (Array.isArray(value)) return ["array", value.map((item) => encode(item, db))];
  if (value instanceof DocumentReference) {
    if (db && !value.isEqual(db.doc(value.path))) throw new Error("Cross-database references are unsupported in journal snapshots.");
    return ["reference", value.path];
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) return ["map", Object.keys(value).sort().map((key) => [key, encode(value[key], db)])];
  throw new Error("Unsupported or non-lossless Firestore value in snapshot.");
}
export function decode(value, db) {
  if (!Array.isArray(value) || ![2, 3].includes(value.length)) throw new Error("Invalid encoded snapshot value.");
  const [type, content] = value;
  switch (type) {
    case "scalar":
      if (value.length !== 2 || !(content === null || ["string", "boolean"].includes(typeof content))) break;
      return content;
    case "number":
      if (value.length !== 2 || typeof content !== "number" || !Number.isFinite(content) || Number.isInteger(content) && !Number.isSafeInteger(content)) break;
      return content;
    case "timestamp":
      if (value.length !== 3) break;
      return new Timestamp(content, value[2]);
    case "geo":
      if (value.length !== 3) break;
      return new GeoPoint(content, value[2]);
    case "bytes": {
      if (value.length !== 2 || typeof content !== "string") break;
      const bytes = Buffer.from(content, "base64");
      if (bytes.toString("base64") !== content) break;
      return bytes;
    }
    case "reference":
      if (value.length !== 2 || typeof content !== "string" || !/^(?:[^/]+\/[^/]+)(?:\/[^/]+\/[^/]+)*$/.test(content)) break;
      return db.doc(content);
    case "array":
      if (value.length !== 2 || !Array.isArray(content)) break;
      return content.map((item) => decode(item, db));
    case "map":
      if (value.length !== 2 || !Array.isArray(content) || content.some((pair) => !Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string") || new Set(content.map((pair) => pair[0])).size !== content.length) break;
      return Object.fromEntries(content.map(([key, item]) => [key, decode(item, db)]));
    default: break;
  }
  throw new Error("Invalid or unknown encoded snapshot value.");
}
export async function backupDirectory(directory = join(homedir(), ".local/share/vx-trade-journal/backups")) {
  const path = resolve(directory);
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o077 || process.getuid && info.uid !== process.getuid()) throw new Error("Backup directory must be private, owned and not a symlink.");
  return path;
}
export function snapshotPayload(documents, projectId, schemaVersion, applied = [], db) {
  const records = documents.map(({ path, data }) => ({ path, value: encode(data, db) }));
  return { format: "vxTradeJournal-database", version: 1, projectId, database: "(default)", schemaVersion, applied, count: records.length, records };
}
export async function readSnapshot(path, projectId) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077 || process.getuid && info.uid !== process.getuid()) throw new Error("Snapshot must be a private owned regular file.");
  const { checksum, ...payload } = JSON.parse(await readFile(path, "utf8"));
  if (payload.format !== "vxTradeJournal-database" || payload.version !== 1 || payload.projectId !== projectId || payload.database !== "(default)" || !Number.isInteger(payload.schemaVersion) || payload.schemaVersion < 1 || !Array.isArray(payload.applied) || hash(JSON.stringify(payload)) !== checksum || payload.count !== payload.records?.length) throw new Error("Snapshot identity, count or integrity check failed.");
  const paths = new Set();
  for (const item of payload.records) {
    if (item.value?.[0] !== "map" || !/^users\/[^/]+(?:\/[^/]+\/[^/]+)*$/.test(item.path) || paths.has(item.path)) throw new Error("Invalid or duplicate snapshot document path.");
    paths.add(item.path);
    decode(item.value, { doc: (reference) => { if (!/^(?:[^/]+\/[^/]+)(?:\/[^/]+\/[^/]+)*$/.test(reference)) throw new Error("Invalid reference."); return reference; } });
  }
  return payload;
}
export async function writeSnapshot(db, lease, projectId, schemaVersion, directory) {
  lease.assert();
  const control = await db.doc("_system/database").get();
  if (control.data()?.status !== "maintenance") throw new Error("Snapshot requires maintenance.");
  const applied = (await db.doc("_system/evolution").get()).data()?.applied || [];
  const payload = snapshotPayload(await journalDocuments(db), projectId, schemaVersion, applied, db);
  const path = join(await backupDirectory(directory), `${lease.runId}.json`);
  try {
    const existing = await readSnapshot(path, projectId);
    if (hash(JSON.stringify(existing)) !== hash(JSON.stringify(payload))) throw new Error("Existing snapshot differs; refusing replacement.");
    return path;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(JSON.stringify({ ...payload, checksum: hash(JSON.stringify(payload)) })); await file.sync(); }
    finally { await file.close(); }
    await readSnapshot(temporary, projectId);
    // Atomic exclusive publication exposes only a complete verified recovery file.
    await link(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
  return path;
}
export async function restoreSnapshot(db, lease, snapshot) {
  const control = await db.doc("_system/database").get();
  if (control.data()?.status !== "maintenance") throw new Error("Restore requires active maintenance.");
  const desired = new Map(snapshot.records.map((item) => [item.path, decode(item.value, db)]));
  const paths = [...new Set([...(await journalDocuments(db)).map((item) => item.path), ...desired.keys()])].sort();
  for (let index = 0; index < paths.length; index += 100) {
    lease.assert();
    await lease.transaction(async (tx) => {
      for (const path of paths.slice(index, index + 100)) {
        if (desired.has(path)) tx.set(db.doc(path), desired.get(path)); else tx.delete(db.doc(path));
      }
      tx.set(db.doc(`_system/runs/history/${lease.runId}`), { restoreCheckpoint: index + 100 }, { merge: true });
    });
  }
  const actual = snapshotPayload(await journalDocuments(db), snapshot.projectId, snapshot.schemaVersion, snapshot.applied, db);
  if (hash(JSON.stringify(actual)) !== hash(JSON.stringify(snapshot))) throw new Error("Restored data verification failed.");
  await lease.transaction(async (tx) => {
    tx.set(db.doc("_system/database"), { metadataVersion: 1, schemaVersion: snapshot.schemaVersion, status: "maintenance" });
    tx.set(db.doc("_system/evolution"), { applied: snapshot.applied });
    tx.set(db.doc(`_system/runs/history/${lease.runId}`), { status: "restored", restoredAt: new Date().toISOString() }, { merge: true });
  });
}

import { connectAdmin } from "./admin.js";
import { metadata } from "./schema.js";
export async function initializeEmptyDatabase(profile) {
  if (profile === "prod") throw new Error("Production baseline requires guarded deployment.");
  const connection = connectAdmin(profile);
  try {
    const ref = connection.db.doc("_system/database");
    if ((await ref.get()).exists) return;
    if ((await connection.db.listCollections()).length && !(await ref.get()).exists) throw Object.assign(new Error("Nonempty database lacks metadata; use explicit schema baseline initialization."), { code: "DATABASE_BASELINE_REQUIRED" });
    try { await ref.create(metadata()); } catch (error) { if (error.code !== 6) throw error; }
  } finally { await connection.close(); }
}

export async function readySyntheticDatabase(profile) {
  if (profile !== "auto") throw new Error("Synthetic availability reset is restricted to auto profile.");
  const connection = connectAdmin(profile);
  try { await connection.db.doc("_system/database").set(metadata()); }
  finally { await connection.close(); }
}

/** Explicit retained emulator baseline; production always uses deployment orchestration. */
export async function initializeBaseline(db, lease, projectId, directory) {
  if (!projectId.startsWith("demo-")) throw new Error("Retained baseline initialization is emulator-only.");
  const { journalDocuments } = await import("./admin.js");
  const { validateSchema1 } = await import("./schema.js");
  const { writeSnapshot } = await import("./snapshot.js");
  const current = (await db.doc("_system/database").get()).data();
  if (current && current.schemaVersion !== 1) throw new Error("Baseline cannot replace an existing schema.");
  await lease.transaction(async (tx) => tx.set(db.doc("_system/database"), metadata(1, "maintenance")));
  const snapshot = await writeSnapshot(db, lease, projectId, 1, directory);
  await validateSchema1(await journalDocuments(db));
  await lease.transaction(async (tx) => {
    tx.set(db.doc("_system/database"), metadata());
    tx.set(db.doc(`_system/runs/history/${lease.runId}`), { status: "complete", snapshot, finishedAt: new Date().toISOString() }, { merge: true });
    tx.delete(db.doc("_system/lock"));
  });
}

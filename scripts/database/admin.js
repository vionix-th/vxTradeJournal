import { initializeApp, applicationDefault, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { profiles } from "../profiles.js";

export function adminTarget(profile, env = process.env) {
  if (profile === "prod") {
    if (Object.keys(env).some((key) => /EMULATOR/.test(key) && env[key])) throw new Error("Production administration rejects emulator overrides.");
    return { projectId: "vionixtradejournal" };
  }
  const target = profiles[profile];
  if (!target || !target.id.startsWith("demo-")) throw new Error("Explicit --profile prod|dev|test|auto required.");
  const host = `127.0.0.1:${target.firestore}`;
  if (env.FIRESTORE_EMULATOR_HOST && env.FIRESTORE_EMULATOR_HOST !== host) throw new Error("Emulator endpoint differs from explicit profile.");
  return { projectId: target.id, host };
}
export function connectAdmin(profile) {
  const target = adminTarget(profile);
  if (target.host) process.env.FIRESTORE_EMULATOR_HOST = target.host;
  const app = initializeApp({ projectId: target.projectId, ...(target.host ? {} : { credential: applicationDefault() }) }, `database-${crypto.randomUUID()}`);
  return { db: getFirestore(app), projectId: target.projectId, close: () => deleteApp(app) };
}
// listDocuments includes missing ancestors. Queries alone would omit their descendants.
export async function journalDocuments(db) {
  const result = [];
  async function visit(collection) {
    for (const ref of await collection.listDocuments()) {
      const snapshot = await ref.get();
      if (snapshot.exists) result.push({ path: ref.path, data: snapshot.data() });
      for (const child of await ref.listCollections()) await visit(child);
    }
  }
  await visit(db.collection("users"));
  return result.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

import { connectAdmin } from "./admin.js";
import { metadata } from "./schema.js";
export async function initializeEmptyDatabase(profile) {
  if (profile === "prod") throw new Error("Production baseline requires guarded deployment.");
  const connection = connectAdmin(profile);
  try {
    const ref = connection.db.doc("_system/database");
    if ((await ref.get()).exists) return;
    if ((await connection.db.listCollections()).length && !(await ref.get()).exists) throw Object.assign(new Error("Nonempty database requires an upgrade; development startup preserves and upgrades existing records automatically."), { code: "DATABASE_BASELINE_REQUIRED" });
    try { await ref.create(metadata()); } catch (error) { if (error.code !== 6) throw error; }
  } finally { await connection.close(); }
}

export async function readySyntheticDatabase(profile) {
  if (profile !== "auto") throw new Error("Synthetic availability reset is restricted to auto profile.");
  const connection = connectAdmin(profile);
  try { await connection.db.doc("_system/database").set(metadata()); }
  finally { await connection.close(); }
}

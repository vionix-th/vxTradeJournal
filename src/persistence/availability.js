import { doc, getDocFromServer } from "firebase/firestore";
import { SCHEMA_VERSION } from "../domain/journal.js";

export class DatabaseError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.details = details;
  }
}
export function checkDatabase(metadata, expected = SCHEMA_VERSION) {
  if (!metadata || metadata.metadataVersion !== 1 || !Number.isInteger(metadata.schemaVersion) || !["ready", "maintenance"].includes(metadata.status))
    throw new DatabaseError("DATABASE_NOT_INITIALIZED", "Database metadata is missing or unsupported. Contact the deployment operator.");
  if (metadata.status !== "ready")
    throw new DatabaseError("DATABASE_MAINTENANCE", "Journal unavailable during database maintenance. Retry after deployment completes.");
  if (metadata.schemaVersion !== expected)
    throw new DatabaseError("SCHEMA_VERSION_MISMATCH", "Installed client and database schemas differ. Replace the installed skill or reload the website.", { expectedSchema: expected, actualSchema: metadata.schemaVersion, recovery: "Install the skill matching the deployed database schema; contact the operator if the client is newer." });
  return metadata;
}
export async function databaseStatus(db) {
  const snapshot = await getDocFromServer(doc(db, "_system", "database"));
  const metadata = snapshot.exists() ? snapshot.data() : null;
  try { checkDatabase(metadata); return { ...metadata, compatible: true }; }
  catch (error) { if (!(error instanceof DatabaseError)) throw error; return { ...metadata, compatible: false, code: error.code, ...error.details }; }
}
export async function assertDatabaseReady(db) {
  const snapshot = await getDocFromServer(doc(db, "_system", "database"));
  return checkDatabase(snapshot.exists() ? snapshot.data() : null);
}

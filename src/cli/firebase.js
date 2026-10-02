import { initializeServerApp, deleteApp, setLogLevel } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator, memoryLocalCache, terminate } from "firebase/firestore";
import { Repository } from "../persistence/repository.js";
import { CliError } from "./errors.js";

export async function connectJournal(config, user) {
  setLogLevel("silent");
  const app = initializeServerApp(config.options, { authIdToken: user.idToken });
  let db;
  try {
    const auth = getAuth(app);
    if (config.useEmulators) connectAuthEmulator(auth, `http://127.0.0.1:${config.authPort}`, { disableWarnings: true });
    await auth.authStateReady();
    if (!auth.currentUser || auth.currentUser.uid !== user.uid) throw new CliError("AUTH_REQUIRED", "Firebase could not restore the authenticated user.", 3);
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
    if (config.useEmulators) connectFirestoreEmulator(db, "127.0.0.1", config.firestorePort);
    return { repo: new Repository(db, user.uid, () => auth.currentUser?.emailVerified === true), close: async () => { await terminate(db); await deleteApp(app); } };
  } catch (error) { if (db) await terminate(db); await deleteApp(app); throw error; }
}

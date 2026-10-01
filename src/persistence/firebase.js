import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  memoryLocalCache,
} from "firebase/firestore";
const config = __FIREBASE_CONFIG__;
export const useEmulators = config.useEmulators;
export const firebaseApp = initializeApp(config.options);
export const auth = getAuth(firebaseApp);
if (useEmulators) connectAuthEmulator(
  auth,
  `http://127.0.0.1:${config.authPort}`,
  { disableWarnings: true },
);
export const db = initializeFirestore(firebaseApp, {
  localCache: memoryLocalCache(),
});
if (useEmulators) connectFirestoreEmulator(
  db,
  "127.0.0.1",
  config.firestorePort,
);

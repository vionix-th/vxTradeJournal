import { profiles } from "../../scripts/profiles.js";

/** Resolve browser configuration without allowing local profiles to reach production. */
export function firebaseConfiguration(name, web) {
  if (name === "prod") {
    if (web.projectId !== "vionixtradejournal" ||
        !web.apiKey || !web.authDomain || !web.appId) {
      throw new Error("Production requires the vionixtradejournal web app configuration");
    }
    return { options: web, useEmulators: false };
  }
  const profile = profiles[name];
  if (!profile) throw new Error(`Unknown Firebase profile: ${name}`);
  return {
    options: { projectId: profile.id, apiKey: "demo-key", authDomain: `${profile.id}.firebaseapp.com` },
    useEmulators: true,
    authPort: profile.auth,
    firestorePort: profile.firestore,
  };
}

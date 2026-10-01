import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { firebaseConfiguration } from "./src/config/firebase.js";
import { profiles } from "./scripts/profiles.js";

function buildMetadata() {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim();
    return `${commit}${dirty ? "-dirty" : ""}`;
  } catch {
    return "unknown";
  }
}

const packageVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url)),
).version;
export default defineConfig(({ mode }) => {
  const profileName = process.env.VXJ_PROFILE ?? (mode === "hosted" ? "prod" : "dev");
  if (mode === "hosted" && profileName !== "prod") {
    throw new Error("Hosted builds require the prod profile");
  }
  const web = JSON.parse(readFileSync(new URL("./firebase.web.json", import.meta.url)));
  const config = firebaseConfiguration(profileName, web);
  const profile = profiles[profileName] ?? { id: web.projectId, vite: 4173 };
  return {
    build: { outDir: profileName === "prod" ? "dist-prod" : "dist" },
    define: {
      __FIREBASE_CONFIG__: JSON.stringify(config),
      __APP_VERSION__: JSON.stringify(packageVersion),
      __BUILD_COMMIT__: JSON.stringify(buildMetadata()),
      "import.meta.env.VITE_PROFILE": JSON.stringify(profileName),
      "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(profile.id),
      "import.meta.env.VITE_AUTH_EMULATOR_PORT": JSON.stringify(String(config.authPort ?? "")),
      "import.meta.env.VITE_FIRESTORE_EMULATOR_PORT": JSON.stringify(String(config.firestorePort ?? "")),
    },
    server: { host: "127.0.0.1", port: profile.vite, strictPort: true },
    preview: { host: "127.0.0.1", port: profile.vite, strictPort: true },
  };
});

export { profiles };

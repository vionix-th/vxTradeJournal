import { doc, setDoc } from "firebase/firestore";
export async function readyDatabase(env, overrides = {}) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "_system/database"), { metadataVersion: 1, schemaVersion: 2, status: "ready", ...overrides });
  });
}

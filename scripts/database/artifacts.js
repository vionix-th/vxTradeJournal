import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hash } from "./schema.js";
import { SCHEMA_VERSION } from "../../src/domain/journal.js";
const execute = promisify(execFile);
export async function files(directory, prefix = "") {
  const result = {};
  for (const entry of (await readdir(join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error("Deployment artifacts cannot contain symlinks.");
    if (entry.isDirectory()) Object.assign(result, await files(directory, path));
    else if (path !== "release.json") result[path] = hash(await readFile(join(directory, path)));
  }
  return result;
}
export async function sourceHash() {
  const { stdout } = await execute("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  const sources = {};
  for (const path of stdout.split("\0").filter(Boolean).sort()) sources[path] = hash(await readFile(path));
  return hash(JSON.stringify(sources));
}
export async function releaseManifest(directory) {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const { stdout: revision } = await execute("git", ["rev-parse", "HEAD"]);
  const { stdout: dirty } = await execute("git", ["status", "--porcelain"]);
  const manifest = { formatVersion: 1, applicationVersion: pkg.version, commit: revision.trim() + (dirty.trim() ? "-dirty" : ""), schemaVersion: SCHEMA_VERSION, sourceHash: await sourceHash(), rulesHash: hash(await readFile("firestore.rules")), files: await files(directory) };
  await writeFile(join(directory, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
export async function verifyArtifacts(directory, manifest) {
  if (JSON.stringify(await files(directory)) !== JSON.stringify(manifest.files) || hash(await readFile("firestore.rules")) !== manifest.rulesHash) throw new Error("Release artifacts or rules changed after preparation.");
}
export async function verifyHosted(manifest) {
  const origin = "https://vionixtradejournal.web.app";
  const response = await fetch(`${origin}/release.json?revision=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok || JSON.stringify(await response.json()) !== JSON.stringify(manifest)) throw new Error("Hosted release manifest differs from prepared build.");
  for (const path of Object.keys(manifest.files).filter((path) => path.startsWith("downloads/") && path.endsWith(".zip"))) {
    const archive = await fetch(`${origin}/${path}?revision=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!archive.ok || hash(Buffer.from(await archive.arrayBuffer())) !== manifest.files[path]) throw new Error("Hosted skill archive differs from prepared build.");
  }
}

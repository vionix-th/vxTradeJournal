import { execFile } from "node:child_process";
import { promisify, isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { readFile, lstat, access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { connectAdmin } from "./database/admin.js";
import { ensureDevelopmentDatabase } from "./database/development.js";
import { argumentsFor } from "./database/arguments.js";
import { registry, hash } from "./database/schema.js";
import { Lease } from "./database/lease.js";
import { readSnapshot, restoreSnapshot, backupDirectory } from "./database/snapshot.js";
import { deploymentPlan, deployDatabase } from "./database/deploy.js";
import { releaseManifest, verifyArtifacts, verifyHosted, sourceHash } from "./database/artifacts.js";
const execute = promisify(execFile);
async function writableDestination(directory) {
  const destination = resolve(directory || `${homedir()}/.local/share/vx-trade-journal/backups`);
  let path = destination;
  while (true) {
    try { const stat = await lstat(path); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Invalid backup destination."); if (path === destination && (stat.mode & 0o077 || process.getuid && stat.uid !== process.getuid())) throw new Error("Backup destination must be private and owned."); await access(path, constants.W_OK); return; }
    catch (error) { if (error.code !== "ENOENT") throw error; const parent = dirname(path); if (parent === path) throw error; path = parent; }
  }
}
async function main() {
  const { action, options } = argumentsFor(process.argv.slice(2));
  let connection, lease;
  try {
    if (action === "upgrade") {
      const result = await ensureDevelopmentDatabase(options["--profile"], { dryRun: !!options["--dry-run"], resume: options["--resume"], directory: options["--backup-dir"] });
      if (options["--dry-run"]) console.log(JSON.stringify(result));
      return;
    }
    let manifest;
    if (action === "deploy") {
      if (options["--profile"] !== "prod") throw new Error("Deployment targets prod only; test orchestration through isolated adapters.");
      if (options["--resume"]) manifest = JSON.parse(await readFile("dist-prod/release.json", "utf8"));
      else { const beforeBuild = await sourceHash(); await execute("npm", ["run", "build:prod"], { maxBuffer: 16 * 1024 * 1024 }); manifest = await releaseManifest("dist-prod"); if (beforeBuild !== manifest.sourceHash) throw new Error("Source changed during build."); }
      await verifyArtifacts("dist-prod", manifest);
      const pkg = JSON.parse(await readFile("package.json", "utf8"));
      const revision = (await execute("git", ["rev-parse", "HEAD"])).stdout.trim();
      const dirty = (await execute("git", ["status", "--porcelain"])).stdout.trim();
      if (manifest.applicationVersion !== pkg.version || manifest.commit !== revision + (dirty ? "-dirty" : "") || manifest.schemaVersion !== registry.target || manifest.sourceHash !== await sourceHash()) throw new Error("Build does not match current source/schema.");
      await writableDestination(options["--backup-dir"]);
    }
    connection = connectAdmin(options["--profile"]);
    const { db, projectId } = connection;
    if (action === "status") {
      console.log(JSON.stringify({ projectId, database: (await db.doc("_system/database").get()).data() || null, release: (await db.doc("_system/release").get()).data() || null, lock: (await db.doc("_system/lock").get()).data() || null }));
      return;
    }
    const runId = options["--resume"] || crypto.randomUUID();
    const previous = options["--resume"] ? (await db.doc(`_system/runs/history/${runId}`).get()).data() : null;
    const identity = action === "restore" ? previous?.identity : { projectId, applicationVersion: manifest.applicationVersion, commit: manifest.commit, schemaVersion: registry.target, rulesHash: manifest.rulesHash, buildHash: hash(JSON.stringify(manifest)), sourceHash: manifest.sourceHash, registryHash: hash(JSON.stringify(registry.migrations.map(({ id, checksum }) => ({ id, checksum })))) };
    if (!identity) throw new Error("Interrupted run not found.");
    if (options["--resume"] && (!previous || !isDeepStrictEqual(previous.identity, identity))) throw new Error("Resume source/build identity differs from recorded run.");
    const bootstrap = options["--register-existing-schema"] === undefined ? undefined : Number(options["--register-existing-schema"]);
    const snapshot = action === "restore" ? await readSnapshot(options["--snapshot"], projectId) : null;
    if (snapshot && !registry.validators.has(snapshot.schemaVersion)) throw new Error("Unsupported restore source schema.");
    if (action === "deploy") {
      const plan = await deploymentPlan(db, registry, identity, bootstrap);
      if (options["--dry-run"]) { console.log(JSON.stringify({ projectId, ...plan })); return; }
      if (plan.bootstrap || plan.migrations.length) await backupDirectory(options["--backup-dir"]);
    }
    lease = new Lease(db, runId, identity);
    await lease.acquire(!!options["--resume"]);
    lease.start();
    console.log(`Database run ${runId}`);
    if (action === "restore") {
      await restoreSnapshot(db, lease, snapshot);
      await lease.release();
      console.log("Journal restored; maintenance remains active. Deploy the matching schema release before reopening.");
    } else {
      await deployDatabase({ db, lease, registry, identity, bootstrap, directory: options["--backup-dir"],
        publishRules: () => execute("node_modules/.bin/firebase", ["deploy", "--config", "firebase.json", "--project", projectId, "--only", "firestore:rules"], { maxBuffer: 16 * 1024 * 1024 }),
        wait: async (milliseconds) => { console.log(`Rules propagation barrier: ${Math.ceil(milliseconds / 1000)} seconds.`); while (milliseconds > 0) { const chunk = Math.min(milliseconds, 30000); await delay(chunk); lease.assert(); milliseconds -= chunk; } },
        publishHosting: async () => { await verifyArtifacts("dist-prod", manifest); lease.assert(); await execute("node_modules/.bin/firebase", ["deploy", "--config", "firebase.json", "--project", projectId, "--only", "hosting"], { maxBuffer: 16 * 1024 * 1024 }); },
        verifyHosting: () => verifyHosted(manifest) });
      console.log("Deployment verified; database ready.");
    }
  } catch (error) {
    if (lease) {
      await lease.transaction(async (tx) => tx.set(lease.db.doc(`_system/runs/history/${lease.runId}`), { status: "failed", failure: String(error.message), failedAt: new Date().toISOString() }, { merge: true })).catch(() => {});
      console.error(`Interrupted run ${lease.runId}. Keep its prepared build and snapshot. After the previous process stops and its lease expires, use --resume ${lease.runId}.`);
    }
    throw error;
  } finally { lease?.stop(); await connection?.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });

import { journalDocuments } from "./admin.js";
import { metadata, migrationChain } from "./schema.js";
import { writeSnapshot, readSnapshot } from "./snapshot.js";
import { migrate } from "./migrate.js";

export async function deploymentPlan(db, registry, identity, bootstrap) {
  const current = (await db.doc("_system/database").get()).data();
  if (!current && bootstrap !== 1) throw new Error("Missing metadata requires explicit --bootstrap-schema 1.");
  if (current && (current.metadataVersion !== 1 || !["ready", "maintenance"].includes(current.status))) throw new Error("Unsupported database control metadata.");
  if (bootstrap !== undefined && bootstrap !== 1) throw new Error("Only schema-1 bootstrap is supported.");
  const from = current?.schemaVersion ?? 1;
  if (!registry.validators.has(from) || !registry.validators.has(registry.target)) throw new Error("Unknown installed or target schema.");
  const applied = (await db.doc("_system/evolution").get()).data()?.applied || [];
  const chain = migrationChain(from, registry.target, registry.migrations, applied);
  const rules = (await db.doc("_system/rules").get()).data();
  const rulesChanged = rules?.status !== "published" || rules?.rulesHash !== identity.rulesHash;
  return { from, target: registry.target, bootstrap: !current, migrations: chain.map((step) => step.id), rulesChanged, maintenance: !current || from !== registry.target || rulesChanged || current?.status === "maintenance" };
}
export async function deployDatabase({ db, lease, registry, identity, bootstrap, directory, publishRules, wait, publishHosting, verifyHosting }) {
  const plan = await deploymentPlan(db, registry, identity, bootstrap);
  const runRef = db.doc(`_system/runs/history/${lease.runId}`);
  const checkpoint = async (value) => lease.transaction(async (tx) => tx.set(runRef, value, { merge: true }));
  let state = (await runRef.get()).data();
  if (plan.maintenance) {
    await lease.transaction(async (tx) => {
      tx.set(db.doc("_system/database"), metadata(plan.from, "maintenance"));
      tx.set(runRef, { backupRequired: !!(state.backupRequired || plan.bootstrap || plan.migrations.length) }, { merge: true });
    });
    if (plan.rulesChanged && !state.rulesPublishedAt) {
      lease.assert();
      await lease.transaction(async (tx) => tx.set(db.doc("_system/rules"), { status: "pending", rulesHash: identity.rulesHash }));
      await publishRules();
      await lease.transaction(async (tx) => {
        const rulesPublishedAt = Date.now();
        tx.set(db.doc("_system/rules"), { status: "published", rulesHash: identity.rulesHash, publishedAt: rulesPublishedAt });
        tx.set(runRef, { rulesPublishedAt, maintenance: true }, { merge: true });
      });
    }
    state = (await runRef.get()).data();
    if (state.rulesPublishedAt) await wait(Math.max(0, state.rulesPublishedAt + 600000 - Date.now()));
    lease.assert();
    if ((plan.bootstrap || plan.migrations.length || state.backupRequired) && !state.snapshot) {
      await checkpoint({ backupRequired: true });
      const snapshot = await writeSnapshot(db, lease, identity.projectId, plan.from, directory);
      await checkpoint({ snapshot });
    }
    state = (await runRef.get()).data();
    if (state.snapshot) await readSnapshot(state.snapshot, identity.projectId);
    await migrate(db, lease, registry);
  } else await registry.validators.get(plan.from)(await journalDocuments(db));
  lease.assert();
  await publishHosting(); // Republication is safe after uncertain Hosting completion.
  await verifyHosting();
  lease.assert();
  await lease.transaction(async (tx) => {
    tx.set(db.doc("_system/release"), identity);
    tx.set(db.doc("_system/database"), metadata(registry.target));
    tx.set(runRef, { status: "complete", finishedAt: new Date().toISOString() }, { merge: true });
    tx.delete(db.doc("_system/lock"));
  });
  return plan;
}

import { isDeepStrictEqual } from 'node:util';
import { adminTarget, connectAdmin, journalDocuments } from './admin.js';
import { hash, metadata, migrationChain, registry as currentRegistry } from './schema.js';
import { Lease } from './lease.js';
import { migrate } from './migrate.js';
import { readSnapshot, writeSnapshot } from './snapshot.js';

/** Emulator-only evolution: preserve retained data, snapshot before changes,
 * and resume only the same recorded, checksummed conversion after lease expiry. */
export async function prepareDevelopmentDatabase(db, { profile, projectId, registry = currentRegistry, directory, dryRun = false, resume, signal, log = console.log }) {
  if (profile === 'prod') throw new Error('Automatic database upgrades are emulator-only. Production uses guarded deployment.');
  if (adminTarget(profile).projectId !== projectId) throw new Error('Development database project differs from its explicit profile.');
  signal?.throwIfAborted();
  const control = (await db.doc('_system/database').get()).data();
  const lock = (await db.doc('_system/lock').get()).data();
  if (lock && lock.expiresAt > Date.now()) throw new Error(`Another run owns the database (${lock.runId}). Stop that process before restarting development.`);
  if (control && (control.metadataVersion !== 1 || !['ready', 'maintenance'].includes(control.status))) throw new Error('Unsupported database control metadata.');
  const empty = !control && (await db.listCollections()).length === 0;
  const from = control?.schemaVersion ?? (empty ? registry.target : 1);
  if (!registry.validators.has(from) || !registry.validators.has(registry.target)) throw new Error('Unknown installed or target schema; retained data has not been cleared.');
  const applied = (await db.doc('_system/evolution').get()).data()?.applied || [];
  const chain = migrationChain(from, registry.target, registry.migrations, applied);
  const plan = { projectId, from, target: registry.target, empty, registerExistingSchema: !control && !empty ? 1 : undefined,
    migrations: chain.map(step => step.id), backupRequired: !empty && (!control || chain.length > 0 || control.status === 'maintenance') };
  if (dryRun) return plan;
  if (control?.status === 'ready' && from === registry.target && !lock && !resume) return plan;

  const identity = { projectId, profile, action: 'development-upgrade', targetSchema: registry.target,
    registryHash: hash(JSON.stringify(registry.migrations.map(({ id, from, to, checksum }) => ({ id, from, to, checksum })))) };
  const runId = resume || lock?.runId || crypto.randomUUID();
  const previous = (await db.doc(`_system/runs/history/${runId}`).get()).data();
  if ((resume || lock) && (previous?.identity?.action !== identity.action || previous.status === 'complete')) throw new Error('Interrupted run requires explicit operator recovery; it is not a resumable development upgrade.');
  if (resume && lock && resume !== lock.runId) throw new Error(`Resume must use the recorded run ${lock.runId}.`);
  const lease = new Lease(db, runId, identity);
  await lease.acquire(!!(resume || lock));
  lease.start();
  const assertLease = lease.assert.bind(lease);
  lease.assert = () => { assertLease(); signal?.throwIfAborted(); };
  const runRef = db.doc(`_system/runs/history/${runId}`);
  const checkpoint = value => lease.transaction(async tx => tx.set(runRef, value, { merge: true }));
  try {
    if (!isDeepStrictEqual((await db.doc('_system/database').get()).data(), control)) {
      throw Object.assign(new Error('Database schema changed during startup preflight; retry against the verified installed schema.'), { code: 'DATABASE_PREFLIGHT_CHANGED' });
    }
    let state = (await runRef.get()).data();
    log(`${previous ? 'Resuming' : 'Preparing'} development schema ${from}→${registry.target}; preserving existing records. Run ${runId}.`);
    await lease.transaction(async tx => {
      tx.set(db.doc('_system/database'), metadata(from, 'maintenance'));
      tx.set(runRef, { sourceSchema: state.sourceSchema ?? from,
        registerExistingSchema: state.registerExistingSchema ?? plan.registerExistingSchema ?? null,
        backupRequired: !!(state.backupRequired || plan.backupRequired) }, { merge: true });
    });
    state = (await runRef.get()).data();
    if (state.backupRequired && !state.snapshot) {
      if (from !== state.sourceSchema) throw new Error('Original source snapshot is missing after conversion; use explicit recovery.');
      const snapshot = await writeSnapshot(db, lease, projectId, state.sourceSchema, directory);
      await checkpoint({ snapshot });
      log(`Private recovery snapshot: ${snapshot}`);
    }
    state = (await runRef.get()).data();
    if (state.snapshot) {
      const snapshot = await readSnapshot(state.snapshot, projectId);
      if (snapshot.schemaVersion !== state.sourceSchema) throw new Error('Recovery snapshot source schema differs from its recorded run.');
    }
    if (state.registerExistingSchema && !state.baselineValidated) {
      await registry.validators.get(1)(await journalDocuments(db));
      await checkpoint({ baselineValidated: true });
    }
    await migrate(db, lease, registry);
    lease.assert();
    await lease.transaction(async tx => {
      tx.set(db.doc('_system/database'), metadata(registry.target));
      tx.set(runRef, { status: 'complete', finishedAt: new Date().toISOString() }, { merge: true });
      tx.delete(db.doc('_system/lock'));
    });
    return { ...plan, runId, snapshot: state.snapshot };
  } catch (error) {
    // A handled failure has no active writer. Retain the run/checkpoint and make
    // its fenced lease eligible for automatic takeover on the next startup.
    await lease.transaction(async tx => {
      tx.set(runRef, { status: error.name === 'AbortError' ? 'interrupted' : 'failed', failure: String(error.message), failedAt: new Date().toISOString() }, { merge: true });
      tx.update(db.doc('_system/lock'), { expiresAt: Date.now() - 1 });
    }).catch(() => {});
    log(`Development upgrade ${runId} stopped; existing records and checkpoints are preserved. Next startup resumes matching migration code. Use database:status to inspect recovery state.`);
    throw error;
  } finally { lease.stop(); }
}

export async function ensureDevelopmentDatabase(profile, options = {}) {
  if (profile === 'prod') throw new Error('Automatic database upgrades are emulator-only.');
  const connection = connectAdmin(profile);
  try {
    const result = await prepareDevelopmentDatabase(connection.db, { ...options, profile, projectId: connection.projectId });
    if (!options.dryRun) (options.log || console.log)(`Development database ready (schema ${result.target}); existing records preserved.`);
    return result;
  } finally { await connection.close(); }
}

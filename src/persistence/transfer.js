import { collection, doc, getDocFromServer as readDoc, getDocsFromServer as readDocs, runTransaction as transaction, Timestamp, deleteDoc as removeDoc } from 'firebase/firestore';
import { assertDatabaseReady } from './availability.js';
import { createExport, readExport, planImport, flattenJournal, rebuildJournal, rowId, ImportError, IMPORT_MAX_BYTES, assertJSON, validatePortable } from '../application/portable.js';
import { fingerprint } from '../application/fingerprint.js';
import { SCHEMA_VERSION, CALCULATION_VERSION } from '../domain/journal.js';
import { transferObservation } from '../application/transfer-status.js';
import { schemaRegistry } from '../application/schema-evolution.js';

const TTL = 120000;
const done = (status) => ['complete', 'rolledBack', 'rejected'].includes(status);
const same = async (a, b) => await fingerprint(a) === await fingerprint(b);
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
async function bounded(promise, db) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new ImportError('IMPORT_RECOVERY_REQUIRED', 'Transfer request timed out; a checkpoint may have committed. Inspect status before resuming.')), 60000); })]); }
  catch (error) { if (db && String(error.code).includes('permission-denied')) await assertDatabaseReady(db); throw error; }
  finally { clearTimeout(timer); }
}
const getDocFromServer = (ref) => bounded(readDoc(ref), ref.firestore);
const getDocsFromServer = (ref) => bounded(readDocs(ref), ref.firestore);
const runTransaction = (db, callback) => bounded(transaction(db, callback), db);
const deleteDoc = (ref) => bounded(removeDoc(ref), ref.firestore);
function sourceChunks(text) {
  const chunks = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + 65536, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    chunks.push(text.slice(offset, end)); offset = end;
  }
  return chunks;
}
const millis = (value) => value?.toMillis?.() || 0;
const order = (row) => {
  const type = row.path.split('/').at(-2);
  const rank = ['accounts', 'instruments', 'strategies', 'trades', 'legs', 'executions', 'adjustments', 'corrections', 'operations', 'settings'].indexOf(type);
  return row.after === null ? 100 - rank : rank;
};
export class JournalTransfer {
  constructor(repo) { this.repo = repo; this.db = repo.db; this.uid = repo.uid; this.owner = crypto.randomUUID(); this.onCheckpoint = null; this.onFeedback = null; }
  control() { return doc(this.db, 'users', this.uid, '_journal', 'control'); }
  session(id) { if (!identifier.test(id)) throw new ImportError('INVALID_EXPORT', 'Invalid import operation ID.'); return doc(this.db, 'users', this.uid, 'imports', id); }
  ref(path) { return doc(this.db, 'users', this.uid, ...path.split('/')); }
  rows(id) { return collection(this.session(id), 'records'); }
  async collect() {
    const records = [];
    for (const type of ['accounts', 'instruments', 'strategies', 'settings', 'trades']) {
      for (const item of (await getDocsFromServer(collection(this.db, 'users', this.uid, type))).docs) {
        assertJSON(item.data());
        if (item.data().uid !== this.uid || item.data().id !== item.id) throw new ImportError('INVALID_EXPORT', 'Destination journal metadata or ownership is invalid.');
        records.push({ path: `${type}/${item.id}`, data: item.data() });
        if (type === 'trades') for (const child of ['legs', 'executions', 'adjustments', 'corrections', 'operations'])
          for (const record of (await getDocsFromServer(collection(item.ref, child))).docs) { assertJSON(record.data()); if (record.data().uid !== this.uid || record.data().id !== record.id) throw new ImportError('INVALID_EXPORT', 'Destination child ownership or identity is invalid.'); records.push({ path: `trades/${item.id}/${child}/${record.id}`, data: record.data() }); }
      }
    }
    return records.sort((a, b) => a.path.localeCompare(b.path));
  }
  async preview(file, options) {
    await this.repo.guard(async () => {});
    const source = await readExport(file);
    const destination = await this.collect();
    validatePortable(rebuildJournal(destination));
    const { target: _target, ...preview } = await planImport(source, destination, { uid: this.uid, projectId: this.db.app.options.projectId, ...options });
    return preview;
  }
  async fenced(operation) {
    await assertDatabaseReady(this.db);
    const fence = this.fence;
    return runTransaction(this.db, async (tx) => {
      const snapshot = await tx.get(this.control()), control = snapshot.data();
      if (!control || control.owner !== this.owner || control.fence !== fence || millis(control.expiresAt) <= Date.now()) throw new ImportError('IMPORT_BUSY', 'Import ownership expired or changed; inspect status and explicitly resume.');
      return operation(tx, control);
    });
  }
  heartbeat() {
    this.heartbeatError = null;
    const timer = setInterval(() => {
      if (this.beating) return;
      this.beating = this.fenced(async (tx, control) => tx.set(this.control(), { ...control, expiresAt: Timestamp.fromMillis(Date.now() + TTL) })).catch((error) => { this.heartbeatError = error; }).finally(() => { this.beating = null; });
    }, 30000);
    return async () => { clearInterval(timer); if (this.beating) await this.beating; };
  }
  async claim(id, resume = false, snapshot = false) {
    const metadata = await assertDatabaseReady(this.db);
    if (metadata.importsBlocked) throw new ImportError('IMPORT_BUSY', 'Deployment is blocking new journal transfers. Retry after deployment.');
    await runTransaction(this.db, async (tx) => {
      const global = (await tx.get(doc(this.db, '_system', 'database'))).data();
      if (global?.status !== 'ready' || global.importsBlocked) throw new ImportError('IMPORT_BUSY', 'Database deployment interrupted transfer admission.');
      const control = (await tx.get(this.control())).data();
      const active = control && control.state !== 'ready' && (control.state === 'import' || millis(control.expiresAt) > Date.now());
      if (active && !(resume && control.operationId === id && (control.owner === this.owner || millis(control.expiresAt) <= Date.now()))) throw new ImportError('IMPORT_BUSY', 'Another journal transfer owns this journal.', { operationId: control.operationId });
      this.fence = (control?.fence || 0) + 1;
      const continuing = resume && control?.state === 'import' && control.operationId === id;
      tx.set(this.control(), { state: snapshot ? 'snapshot' : 'import', operationId: id, owner: this.owner, fence: this.fence, expiresAt: Timestamp.fromMillis(Date.now() + TTL), phase: continuing ? control.phase : 'preparing', cursor: continuing ? control.cursor : 0, checkpoint: (control?.checkpoint || 0) + 1 });
    });
  }
  async inspect(id) {
    const control = (await getDocFromServer(this.control())).data() || null;
    const operationId = control?.state === 'import' ? control.operationId : id;
    let session = null;
    if (operationId) session = (await getDocFromServer(this.session(operationId))).data() || null;
    const compatible = !session || this.recoveryCompatible(session);
    return transferObservation(control, session, { operationId, compatible, ownedByCaller: control?.owner === this.owner });
  }
  recoveryCompatible(session) {
    return session.schemaVersion === SCHEMA_VERSION && session.calculationVersion === CALCULATION_VERSION && session.formatVersion === 1 && session.projectId === this.db.app.options.projectId && Array.isArray(session.conversions) && session.conversions.every((step) => schemaRegistry.migrations.some((registered) => step.id === registered.id && step.checksum === registered.checksum));
  }
  feedback(error, progress) {
    try { this.onFeedback?.({ error, progress }); }
    catch (failure) { error.details = { ...error.details, secondaryErrors: [...(error.details?.secondaryErrors || []), { stage: 'feedback', code: failure.code || 'FEEDBACK_FAILED', message: failure.message }] }; }
  }
  async diagnose(error, id) {
    this.feedback(error, 'Checking transfer status…');
    const secondaryErrors = error.details?.secondaryErrors || [];
    try {
      const observation = await this.inspect(error.details?.operationId || id);
      error.details = { ...error.details, transfer: observation };
    } catch (failure) {
      secondaryErrors.push({ stage: 'inspection', code: failure.code || 'STATUS_UNAVAILABLE', message: failure.message });
      error.details = { ...error.details, transfer: { reason: 'status_unavailable', observedClientTime: new Date().toISOString(), actions: ['check_status'] } };
    }
    if (secondaryErrors.length) error.details.secondaryErrors = secondaryErrors;
    return error;
  }
  async export() {
    const id = crypto.randomUUID();
    let claimed = false, filePrepared = false, stop;
    try {
      await this.claim(id, false, true); claimed = true; stop = this.heartbeat();
      const journal = rebuildJournal(await this.collect()); validatePortable(journal);
      const file = await createExport(journal); filePrepared = true;
      await stop(); stop = null;
      await this.fenced(async (tx, control) => tx.set(this.control(), { ...control, state: 'ready', phase: 'complete' }));
      return file;
    } catch (error) {
      error.details = { ...error.details, export: { filePrepared, downloadRequested: false } };
      this.feedback(error, 'Checking export outcome…');
      if (stop) { await stop(); stop = null; }
      if (claimed) {
        try { await this.fenced(async (tx, control) => tx.set(this.control(), { ...control, state: 'ready', phase: 'complete' })); }
        catch (failure) { error.details = { ...error.details, secondaryErrors: [...(error.details?.secondaryErrors || []), { stage: 'cleanup', code: failure.code || 'CLEANUP_FAILED', message: failure.message }] }; }
      }
      throw await this.diagnose(error);
    } finally { if (stop) await stop(); }
  }
  async outcome(id, operation) {
    try { return await operation(); }
    catch (error) {
      this.feedback(error, 'Checking import outcome…');
      if (!error.writeOutcome) {
        let state = 'unknown';
        try {
          const session = await this.status(id);
          if (['complete', 'rolledBack'].includes(session.status)) state = 'applied';
          else if (['rollingBack', 'preparingRollback'].includes(session.status) || session.active && (session.cursor > 0 || ['verifying', 'verifyingRollback'].includes(session.phase))) state = 'partial';
          else state = 'not_applied';
        } catch (failure) {
          if (failure.code === 'IMPORT_NOT_FOUND') state = 'not_applied';
          else error.details = { ...error.details, secondaryErrors: [...(error.details?.secondaryErrors || []), { stage: 'outcome inspection', code: failure.code || 'STATUS_UNAVAILABLE', message: failure.message }] };
        }
        error.writeOutcome = { state };
      }
      throw error.details?.transfer ? error : await this.diagnose(error, id);
    }
  }
  async report(id) {
    try { return { ...await this.status(id), transfer: await this.inspect(id) }; }
    catch (error) {
      error.details = { ...error.details, transfer: { reason: 'status_unavailable', observedClientTime: new Date().toISOString(), actions: ['check_status'], ...(id ? { operationId: id } : {}) } };
      throw error;
    }
  }
  async status(id) {
    if (!id) { const control = (await getDocFromServer(this.control())).data(); const { owner: _owner, ...publicControl } = control || { state: 'ready' }; return publicControl; }
    const session = (await getDocFromServer(this.session(id))).data();
    if (!session) throw new ImportError('IMPORT_NOT_FOUND', 'Import operation was not found.');
    const control = (await getDocFromServer(this.control())).data();
    const { owner: _owner, ...publicSession } = session;
    return { ...publicSession, active: control?.state === 'import' && control.operationId === id, phase: control?.operationId === id ? control.phase : session.status, cursor: control?.operationId === id ? control.cursor : session.rowCount || 0 };
  }
  async upload(file, options) {
    const source = await readExport(file), id = options.operationId;
    if (!options.acceptPreview || options.mode === 'replace' && !options.yes) throw new ImportError('INVALID_EXPORT', 'Accepted preview required; replacement also requires explicit confirmation.');
    const text = JSON.stringify(file), chunks = sourceChunks(text);
    if (new TextEncoder().encode(text).byteLength > IMPORT_MAX_BYTES) throw new ImportError('INVALID_EXPORT', 'Import exceeds 32 MiB.');
    const ref = this.session(id), existing = (await getDocFromServer(ref)).data();
    if (existing) {
      if (existing.sourceFingerprint !== source.sourceFingerprint || existing.mode !== options.mode || existing.includeSettings !== !!options.includeSettings || existing.previewFingerprint !== options.acceptPreview) throw new ImportError('IMPORT_CONFLICT', 'Operation ID was already used with different import inputs.');
      if (done(existing.status)) return existing;
      if (existing.status !== 'uploading') return existing;
      if (existing.owner !== this.owner && millis(existing.uploadExpiresAt) > Date.now()) throw new ImportError('IMPORT_BUSY', 'Another client is uploading this operation.');
    }
    await this.repo.guard(async () => {});
    await runTransaction(this.db, async (tx) => {
      const current = (await tx.get(ref)).data();
      if (current && (current.status !== 'uploading' || current.owner !== this.owner && millis(current.uploadExpiresAt) > Date.now())) throw new ImportError('IMPORT_BUSY', 'Import upload ownership changed.');
      tx.set(ref, { id, uid: this.uid, formatVersion: 1, projectId: this.db.app.options.projectId, conversions: source.conversions, status: 'uploading', mode: options.mode, includeSettings: !!options.includeSettings, previewFingerprint: options.acceptPreview, sourceFingerprint: source.sourceFingerprint, schemaVersion: SCHEMA_VERSION, calculationVersion: CALCULATION_VERSION, startedAt: current?.startedAt || new Date().toISOString(), receiptId: current?.receiptId || crypto.randomUUID(), owner: this.owner, uploadExpiresAt: Timestamp.fromMillis(Date.now() + TTL), sourceChunks: chunks.length, backupAvailable: false });
    });
    for (let index = 0; index < chunks.length; index++) {
      await runTransaction(this.db, async (tx) => {
        const current = (await tx.get(ref)).data();
        if (current.owner !== this.owner || current.status !== 'uploading') throw new ImportError('IMPORT_BUSY', 'Upload ownership changed.');
        tx.set(doc(ref, 'source', String(index)), { index, text: chunks[index] });
        tx.update(ref, { uploadExpiresAt: Timestamp.fromMillis(Date.now() + TTL) });
      });
    }
    await runTransaction(this.db, async (tx) => { const current = (await tx.get(ref)).data(); if (current.owner !== this.owner || current.status !== 'uploading') throw new ImportError('IMPORT_BUSY', 'Upload ownership changed.'); tx.update(ref, { status: 'uploaded' }); });
    return this.status(id);
  }
  async source(id, session) {
    const chunks = (await getDocsFromServer(collection(this.session(id), 'source'))).docs.map((item) => item.data()).sort((a, b) => a.index - b.index);
    if (chunks.length !== session.sourceChunks || chunks.some((c, i) => c.index !== i)) throw new ImportError('IMPORT_RECOVERY_REQUIRED', 'Source upload is incomplete; reselect source file or cancel before journal changes.');
    const source = await readExport(JSON.parse(chunks.map((c) => c.text).join('')));
    if (source.sourceFingerprint !== session.sourceFingerprint) throw new ImportError('IMPORT_RECOVERY_REQUIRED', 'Staged source integrity check failed.');
    return source;
  }
  async apply(file, options) { return this.outcome(options.operationId, () => this._apply(file, options)); }
  async _apply(file, options) {
    if (!this.repo.verified()) throw new ImportError('EMAIL_UNVERIFIED', 'Verify email before importing.');
    const session = await this.upload(file, options);
    if (session.status === 'rejected') {
      await this.cleanup(options.operationId, false);
      throw new ImportError(session.rejectionCode || 'IMPORT_CONFLICT', 'This operation was rejected. Generate and accept a new preview with a new operation ID.', { conflicts: session.conflicts || [] });
    }
    if (done(session.status)) { await this.cleanup(options.operationId, session.backupAvailable); return session; }
    return this.resume(options.operationId);
  }
  async prepare(id, session) {
    const source = await this.source(id, session), before = await this.collect();
    validatePortable(rebuildJournal(before));
    const plan = await planImport(source, before, { uid: this.uid, projectId: this.db.app.options.projectId, mode: session.mode, includeSettings: session.includeSettings });
    if (!plan.canApply || plan.fingerprint !== session.previewFingerprint) {
      const rejectionCode = plan.canApply ? 'IMPORT_PREVIEW_CHANGED' : 'IMPORT_CONFLICT';
      await this.fenced(async (tx, control) => { tx.update(this.session(id), { status: 'rejected', rejectionCode, conflicts: plan.conflicts }); tx.set(this.control(), { ...control, state: 'ready', phase: 'rejected', checkpoint: control.checkpoint + 1 }); });
      throw new ImportError(rejectionCode, 'Destination changed or conflicts exist. Generate and accept a new preview.', { conflicts: plan.conflicts });
    }
    const old = new Map(before.map((r) => [r.path, r.data])), target = new Map();
    for (const { path, data } of flattenJournal(plan.target)) {
      const original = old.get(path), type = path.split('/').at(-2);
      if (type === 'settings' && !session.includeSettings && !original && data.revision === 0 && !data.defaultAccount) continue;
      if (original && await same(original, data) && (session.mode === 'add' || type === 'settings' && !session.includeSettings)) target.set(path, original);
      else if (type === 'corrections') target.set(path, structuredClone(data));
      else target.set(path, { ...data, uid: this.uid, schemaVersion: SCHEMA_VERSION, revision: Math.max(original?.revision || 0, data.revision || 0) + 1, createdAt: data.createdAt || session.startedAt, updatedAt: data.updatedAt || session.startedAt });
    }
    for (const { path, data } of before) if (path.split('/')[2] === 'operations' && session.mode === 'add') target.set(path, data);
    for (const trade of plan.target.trades) {
      if (session.mode === 'add' && old.has(`trades/${trade.id}`)) continue;
      const parent = target.get(`trades/${trade.id}`); parent.lastOperation = session.receiptId;
      target.set(`trades/${trade.id}/operations/${session.receiptId}`, { uid: this.uid, id: session.receiptId, revision: parent.revision, createdAt: session.startedAt, requestFingerprint: session.sourceFingerprint });
    }
    const rows = [];
    for (const path of [...new Set([...old.keys(), ...target.keys()])].sort()) {
      const before = old.get(path) || null, after = target.get(path) || null;
      rows.push({ path, before, after, apply: !await same(before, after) });
    }
    for (let offset = 0; offset < rows.length; offset += 3) await this.fenced(async (tx, control) => {
      for (const row of rows.slice(offset, offset + 3)) tx.set(doc(this.rows(id), rowId(row.path)), row);
      tx.set(this.control(), { ...control, checkpoint: control.checkpoint + 1 });
    });
    const targetRecords = [...target].map(([path, data]) => ({ path, data })).sort((a, b) => a.path.localeCompare(b.path));
    await this.fenced(async (tx, control) => {
      tx.update(this.session(id), { status: 'applying', rowCount: rows.length, backupHash: await fingerprint(before), targetHash: await fingerprint(targetRecords), backupAvailable: true });
      tx.set(this.control(), { ...control, phase: 'applying', cursor: 0, checkpoint: control.checkpoint + 1 });
    });
  }
  async storedRows(id, session) {
    const rows = (await getDocsFromServer(this.rows(id))).docs.map((d) => d.data());
    if (rows.length !== session.rowCount) throw new ImportError('IMPORT_RECOVERY_REQUIRED', 'Recovery manifest is incomplete.');
    const before = rows.filter((r) => r.before !== null).map((r) => ({ path: r.path, data: r.before })).sort((a, b) => a.path.localeCompare(b.path));
    const after = rows.filter((r) => r.after !== null).map((r) => ({ path: r.path, data: r.after })).sort((a, b) => a.path.localeCompare(b.path));
    if (await fingerprint(before) !== session.backupHash || await fingerprint(after) !== session.targetHash) throw new ImportError('IMPORT_RECOVERY_REQUIRED', 'Recovery integrity check failed.');
    if (session.status === 'rollingBack' && await fingerprint(rows.map((r) => ({ path: r.path, data: r.restore })).sort((a, b) => a.path.localeCompare(b.path))) !== session.restoreHash) throw new ImportError('IMPORT_RECOVERY_REQUIRED', 'Restoration checkpoint integrity check failed.');
    return rows;
  }
  async runRows(id, rows, rollback = false) {
    const changes = rows.filter((r) => r.apply).sort((a, b) => order({ ...a, after: rollback ? a.restore : a.after }) - order({ ...b, after: rollback ? b.restore : b.after }) || a.path.localeCompare(b.path));
    const control = (await getDocFromServer(this.control())).data();
    // One journal record per checkpoint keeps nested snapshot validation below
    // Firestore's expression budget without weakening persistence validation.
    for (let offset = control.cursor; offset < changes.length; offset++) {
      if (this.heartbeatError) throw this.heartbeatError;
      await this.fenced(async (tx, current) => {
        if (current.cursor !== offset) throw new ImportError('IMPORT_BUSY', 'Checkpoint changed; inspect status before resuming.');
        const row = changes[offset], data = rollback ? row.restore : row.after;
        if (data === null) tx.delete(this.ref(row.path)); else tx.set(this.ref(row.path), data);
        tx.set(this.control(), { ...current, cursor: offset + 1, checkpoint: current.checkpoint + 1 });
      });
      if (this.onCheckpoint) await this.onCheckpoint({ operationId: id, cursor: offset + 1, rollback });
    }
    await this.fenced(async (tx, current) => tx.set(this.control(), { ...current, phase: rollback ? 'verifyingRollback' : 'verifying', checkpoint: current.checkpoint + 1 }));
    const desired = rows.map((r) => ({ path: r.path, data: rollback && r.apply ? r.restore : rollback ? r.before : r.after })).filter((r) => r.data !== null).sort((a, b) => a.path.localeCompare(b.path));
    if (!await same(await this.collect(), desired)) throw new ImportError('IMPORT_RECOVERY_REQUIRED', 'Target verification failed; journal remains unavailable.');
    validatePortable(rebuildJournal(desired));
    await this.fenced(async (tx, current) => {
      tx.update(this.session(id), { status: rollback ? 'rolledBack' : 'complete', finishedAt: new Date().toISOString(), backupAvailable: !rollback && (await tx.get(this.session(id))).data().mode === 'replace' });
      tx.set(this.control(), { ...current, state: 'ready', phase: rollback ? 'rolledBack' : 'complete', checkpoint: current.checkpoint + 1 });
    });
    return this.status(id);
  }
  async resume(id) { return this.outcome(id, () => this._resume(id)); }
  async _resume(id) {
    let session = await this.status(id);
    if (done(session.status)) { await this.cleanup(id, session.backupAvailable); return session; }
    if (!this.recoveryCompatible(session)) throw new ImportError('UNSUPPORTED_EXPORT_VERSION', 'Import recovery requires matching project, contract, schema, calculation and conversion checksums.');
    if (session.status === 'uploading') throw new ImportError('IMPORT_RECOVERY_REQUIRED', 'Upload incomplete; reselect source file before applying. Journal is unchanged.');
    if (session.status === 'preparingRollback') return this.rollback(id, true);
    await this.claim(id, true); const stop = this.heartbeat();
    try {
      if (['uploaded', 'preparing'].includes(session.status)) { await this.fenced(async (tx, current) => { tx.update(this.session(id), { status: 'preparing' }); tx.set(this.control(), { ...current, checkpoint: current.checkpoint + 1 }); }); await this.prepare(id, session); session = await this.status(id); }
      const rows = await this.storedRows(id, session);
      const result = await this.runRows(id, rows, session.status === 'rollingBack');
      await this.cleanup(id, result.backupAvailable);
      return result;
    } finally { await stop(); }
  }
  async rollback(id, yes) { return this.outcome(id, () => this._rollback(id, yes)); }
  async _rollback(id, yes) {
    if (!yes) throw new ImportError('INVALID_EXPORT', 'Rollback requires explicit confirmation.');
    let session = await this.status(id);
    if (['rolledBack', 'rejected'].includes(session.status)) { await this.cleanup(id, false); return session; }
    if (session.status === 'complete') throw new ImportError('IMPORT_CONFLICT', 'Completed import requires recovery export and a new replacement preview.');
    if (['uploading', 'uploaded'].includes(session.status) && !session.active) {
      await runTransaction(this.db, async (tx) => { await tx.get(this.session(id)); tx.update(this.session(id), { status: 'rolledBack', backupAvailable: false }); });
      await this.cleanup(id, false); return this.status(id);
    }
    await this.claim(id, true); const stop = this.heartbeat();
    try {
      if (session.status === 'preparing') {
        await this.fenced(async (tx, current) => { tx.update(this.session(id), { status: 'rolledBack', backupAvailable: false }); tx.set(this.control(), { ...current, state: 'ready', phase: 'rolledBack', checkpoint: current.checkpoint + 1 }); });
        await this.cleanup(id, false); return this.status(id);
      }
      const rows = await this.storedRows(id, session);
      if (session.status !== 'rollingBack') {
        await this.fenced(async (tx, current) => { tx.update(this.session(id), { status: 'preparingRollback' }); tx.set(this.control(), { ...current, phase: 'preparingRollback', checkpoint: current.checkpoint + 1 }); });
        for (const row of rows) row.restore = row.before === null ? null : { ...row.before, ...(row.before.revision && !['operations', 'corrections'].includes(row.path.split('/')[2]) ? { revision: Math.max(row.before.revision, row.after?.revision || 0) + 1 } : {}) };
        for (let index = 0; index < rows.length; index += 3) await this.fenced(async (tx, current) => { for (const row of rows.slice(index, index + 3)) tx.set(doc(this.rows(id), rowId(row.path)), row); tx.set(this.control(), { ...current, checkpoint: current.checkpoint + 1 }); });
        const restoreHash = await fingerprint(rows.map((r) => ({ path: r.path, data: r.restore })).sort((a, b) => a.path.localeCompare(b.path)));
        await this.fenced(async (tx, current) => { tx.update(this.session(id), { status: 'rollingBack', restoreHash }); tx.set(this.control(), { ...current, phase: 'rollingBack', cursor: 0, checkpoint: current.checkpoint + 1 }); });
      }
      const result = await this.runRows(id, rows, true); await this.cleanup(id, false); return result;
    } finally { await stop(); }
  }
  async backups() { return (await getDocsFromServer(collection(this.db, 'users', this.uid, 'imports'))).docs.map((d) => d.data()).filter((s) => s.backupAvailable && s.status === 'complete').map(({ id, startedAt, finishedAt, rowCount, schemaVersion }) => ({ id, startedAt, finishedAt, rowCount, schemaVersion })); }
  async backupExport(id) {
    const session = await this.status(id);
    if (!session.backupAvailable || session.status !== 'complete') throw new ImportError('IMPORT_NOT_FOUND', 'Retained recovery backup was not found.');
    const rows = await this.storedRows(id, session);
    return createExport(rebuildJournal(rows.filter((r) => r.before !== null).map((r) => ({ path: r.path, data: r.before }))), undefined, { schemaVersion: session.schemaVersion, calculationVersion: session.calculationVersion });
  }
  async cleanup(id, retain) {
    for (const item of (await getDocsFromServer(collection(this.session(id), 'source'))).docs) await deleteDoc(item.ref);
    if (!retain) for (const item of (await getDocsFromServer(this.rows(id))).docs) await deleteDoc(item.ref);
  }
  async deleteBackup(id, yes) {
    if (!yes) throw new ImportError('INVALID_EXPORT', 'Backup deletion requires explicit confirmation.');
    const session = await this.status(id);
    if (!done(session.status) || session.active) throw new ImportError('IMPORT_BUSY', 'Active recovery data cannot be deleted.');
    await runTransaction(this.db, async (tx) => { const current = (await tx.get(this.session(id))).data(); if (!done(current.status)) throw new ImportError('IMPORT_BUSY', 'Recovery is active.'); tx.update(this.session(id), { backupAvailable: false }); });
    await this.cleanup(id, false); return { id, deleted: true };
  }
}

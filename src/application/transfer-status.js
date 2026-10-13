/** Read-only transfer diagnostics. Client time is observation, never server authority. */
const terminal = new Set(['complete', 'rolledBack', 'rejected']);
const statuses = new Set(['uploading', 'uploaded', 'preparing', 'applying', 'verifying', 'preparingRollback', 'rollingBack', 'verifyingRollback', ...terminal]);
const timestamp = (value) => {
  const result = value?.toMillis?.() ?? (typeof value === 'string' ? Date.parse(value) : NaN);
  return Number.isFinite(result) ? result : null;
};
export function transferObservation(control, session = null, { now = Date.now(), operationId, compatible = true, ownedByCaller = false } = {}) {
  const result = {
    reason: 'status_unavailable', observedClientTime: new Date(now).toISOString(),
    actions: ['check_status'],
  };
  if (session?.kind === 'accountDeletion') result.operationKind = 'accountDeletion';
  const unavailable = (issue) => ({ ...result, issue });
  if (control && !['ready', 'snapshot', 'import'].includes(control.state)) return unavailable('Invalid transfer state.');
  if (control) {
    result.operationId = control.operationId;
    result.ownedByCaller = ownedByCaller;
    result.phase = control.phase;
    result.checkpoint = control.checkpoint;
    result.committedRecords = control.cursor;
    const expiry = timestamp(control.expiresAt);
    if (expiry === null) return unavailable('Transfer expiry is missing or invalid.');
    result.expiresAt = new Date(expiry).toISOString();
    result.leaseActive = expiry > now;
    if (!Number.isInteger(control.cursor) || control.cursor < 0 || !Number.isInteger(control.checkpoint) || control.checkpoint < 0 || typeof control.operationId !== 'string' || !Number.isInteger(control.fence) || control.fence < 1 || typeof control.owner !== 'string' || !control.owner || typeof control.phase !== 'string') return unavailable('Transfer checkpoint metadata is invalid.');
    if (control.state === 'ready' && !['complete', 'rolledBack', 'rejected'].includes(control.phase) || control.state === 'snapshot' && control.phase !== 'preparing') return unavailable('Transfer phase disagrees with its state.');
    if (control.state === 'snapshot') return { ...result, reason: expiry > now ? 'active_export' : 'expired_export', actions: expiry > now ? ['check_status'] : ['retry_export', 'check_status'] };
  }
  if (operationId && !session) return unavailable('Import operation metadata is missing.');
  if (control?.state === 'import') {
    if (session?.kind === 'accountDeletion' && session.id === control.operationId && terminal.has(session.status) && control.phase === 'cleanup') {
      return { ...result, reason: result.leaseActive ? 'active_import' : 'interrupted_import', importStatus: session.status,
        cleanupComplete: !!session.cleanupComplete,
        actions: compatible && (ownedByCaller || !result.leaseActive) ? ['finish_cleanup', 'check_status'] : ['check_status'],
        ...(!compatible ? { issue: 'Recovery requires a client matching the deletion contract.' } : {}) };
    }
    if (!session || session.id !== control.operationId || !statuses.has(session.status) || terminal.has(session.status)) return unavailable('Import control and operation metadata disagree.');
    const phases = { uploaded: ['preparing'], preparing: ['preparing'], applying: ['applying', 'verifying'], preparingRollback: ['preparingRollback'], rollingBack: ['rollingBack', 'verifyingRollback'] };
    if (!phases[session.status]?.includes(control.phase) || Number.isInteger(session.rowCount) && control.cursor > session.rowCount) return unavailable('Import phase or record checkpoint disagrees with the operation.');
    const active = timestamp(control.expiresAt) > now;
    return { ...result, reason: active ? 'active_import' : 'interrupted_import', importStatus: session.status,
      actions: (active && !ownedByCaller) || !compatible ? ['check_status'] : ['resume_import', 'rollback_import', 'check_status'], ...(!compatible ? { issue: 'Recovery requires a client matching the recorded import contract and conversion checksums.' } : {}) };
  }
  if (session) {
    result.operationId = session.id;
    result.importStatus = session.status;
    result.phase = session.status;
    if (!statuses.has(session.status) || session.id !== operationId) return unavailable('Import operation metadata is invalid.');
    if (!terminal.has(session.status)) {
      if (!['uploading', 'uploaded'].includes(session.status)) return unavailable('Incomplete import has no matching recovery control.');
      const expiry = timestamp(session.uploadExpiresAt);
      if (expiry === null) return unavailable('Upload expiry is missing or invalid.');
      result.expiresAt = new Date(expiry).toISOString();
      if (session.status === 'uploading' && expiry > now) return { ...result, reason: 'active_import', actions: ['check_status'] };
      return { ...result, reason: 'interrupted_import', actions: compatible ? [ ...(session.status === 'uploaded' ? ['resume_import'] : []), 'rollback_import', 'check_status'] : ['check_status'], ...(!compatible ? { issue: 'Recovery requires a client matching the recorded import contract and conversion checksums.' } : {}) };
    }
  }
  // No control document is the established pristine-journal contract, not missing import metadata.
  return { ...result, reason: 'ready', actions: session?.kind === 'accountDeletion' && session.status === 'complete' && !session.cleanupComplete ? ['finish_cleanup', 'check_status'] : ['retry_export', 'check_status'] };
}

export const transferPhaseLabel = (phase, kind) => kind === 'accountDeletion' && ['preparing', 'applying', 'verifying'].includes(phase) ? ({ preparing: 'Preparing account deletion', applying: 'Deleting account records', verifying: 'Checking account deletion' }[phase]) : ({
  preparing: 'Preparing journal records', applying: 'Applying journal records',
  verifying: 'Checking imported journal', preparingRollback: 'Preparing restoration',
  rollingBack: 'Restoring journal records', verifyingRollback: 'Checking restored journal',
  cleanup: 'Removing temporary recovery records',
  uploading: 'Uploading import file', uploaded: 'Import file uploaded',
  complete: 'Complete', rolledBack: 'Restored', rejected: 'Import rejected',
}[phase] || 'Checking transfer status');

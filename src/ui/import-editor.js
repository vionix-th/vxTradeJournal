import { el, button, field, checkbox, header, section, notice } from './components.js';
import { JournalTransfer } from '../persistence/transfer.js';
import { transferFeedback } from './transfer-feedback.js';
import { IMPORT_MAX_BYTES } from '../application/portable.js';

export function downloadJournal(file, name = 'vxTradeJournal') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  el('a', { href: url, download: `${name}-${new Date().toISOString().slice(0, 10)}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function recoveryPanel({ transfer, operationId, complete, run = async (action) => action() }) {
  let activeId = operationId;
  let resume, rollback, back, title;
  let deletion = false, cleanup = false;
  const feedback = transferFeedback({ transfer, operationId: () => activeId, onState: (state) => {
    if (state.observation?.operationId) activeId = state.observation.operationId;
    deletion = state.observation?.operationKind === 'accountDeletion';
    cleanup = !!state.observation?.actions.includes('finish_cleanup');
    if (title) title.textContent = deletion ? 'Account deletion recovery' : 'Import recovery';
    for (const [control, action] of [[resume, 'resume_import'], [rollback, 'rollback_import']]) {
      if (!control) continue;
      control.hidden = !state.observation?.actions.includes(action) && !(control === resume && cleanup);
      control.disabled = state.pending;
    }
    if (resume) resume.textContent = cleanup ? 'Finish deletion cleanup' : deletion ? 'Resume account deletion' : 'Resume import';
    if (rollback) rollback.textContent = deletion ? 'Cancel deletion and restore records' : 'Roll back import';
    if (back) { back.hidden = state.observation?.reason !== 'ready'; back.disabled = state.pending; }
  } });
  const execute = async (restore) => {
    if (feedback.pending) return;
    const isDeletion = deletion;
    if (restore && !confirm(deletion ? 'Cancel this account deletion and restore records removed so far?' : 'Restore journal contents from before this import? Import-created records will be removed.')) return;
    transfer.onCheckpoint = ({ cursor, rollback }) => feedback.progress(`${rollback ? 'Restoring' : isDeletion ? 'Deleting' : 'Applying'} journal records… ${cursor} records committed in this phase.`);
    const outcome = await feedback.execute(() => run(() => restore ? transfer.rollback(activeId, true) : transfer.resume(activeId)), {
      progress: cleanup ? 'Removing temporary recovery records…' : restore ? 'Restoring original journal…' : isDeletion ? 'Continuing account deletion…' : 'Resuming import…',
      success: (result) => result.status === 'rolledBack' ? 'Original journal restored.' : result.status === 'rejected' ? 'Request rejected; recovery cleanup finished.' : isDeletion ? 'Account and linked history deleted; cleanup finished.' : 'Import completed.',
    });
    if (outcome.ok && ['complete', 'rolledBack', 'rejected'].includes(outcome.value.status)) await complete();
  };
  resume = button('Resume import', () => execute(false)); resume.hidden = true;
  rollback = button('Roll back import', () => execute(true), 'button secondary'); rollback.hidden = true;
  back = button('Return to journal', complete, 'button secondary'); back.hidden = true;
  for (const control of [resume, rollback]) control.setAttribute('aria-describedby', feedback.host.id);
  const host = section('Import recovery', feedback.host, el('div', { class: 'actions' }, resume, rollback, back));
  title = host.querySelector('h2');
  void feedback.inspect();
  return host;
}
export function importEditor(ui) {
  const transfer = new JournalTransfer(ui.repo);
  const mode = field('Import mode', 'import-mode', 'add', { choices: [{ value: 'add', label: 'Add only — keep existing records' }, { value: 'replace', label: 'Replace existing journal' }] });
  const settings = checkbox('Apply exported settings', 'include-settings');
  const inputId = `import-file-${crypto.randomUUID()}`;
  const input = el('input', { id: inputId, type: 'file', accept: '.json,application/json' });
  let feedback, previewButton, apply, recoveryId;
  const messages = el('div');
  const result = el('div'); const recovery = el('div');
  let file, preview;
  const complete = () => ui.loadUser(ui.user);
  const run = (action) => ui.lifecycle.run(action, async () => {});
  apply = button('Apply import', async () => {
    if (feedback.pending || !preview?.canApply) return;
    const replace = mode.control.value === 'replace';
    if (replace && !confirm('Replace destination journal with this file? Destination-only records will be deleted. A private recovery backup will be retained until explicitly deleted.')) return;
    const operationId = crypto.randomUUID();
    recoveryId = operationId;
    recovery.replaceChildren();
    transfer.onCheckpoint = ({ cursor }) => feedback.progress(`Applying journal records… ${cursor} records committed in this phase.`);
    const outcome = await feedback.execute(() => run(() => transfer.apply(file, { mode: mode.control.value, includeSettings: settings.control.checked, acceptPreview: preview.fingerprint, operationId, yes: replace })), {
      progress: 'Uploading source and preparing recovery backup…', success: 'Import completed.',
    });
    if (outcome.ok) await complete();
    else if (outcome.error && messages.isConnected) {
      preview = null;
      apply.disabled = true;
      recoveryId = outcome.error.details?.transfer?.operationId || operationId;
      recovery.replaceChildren(recoveryPanel({ transfer, operationId: recoveryId, complete, run }));
    }
  }, 'button', { disabled: true });
  previewButton = button('Preview import', async () => {
    if (feedback.pending) return;
    preview = null; apply.disabled = true; result.replaceChildren(); recovery.replaceChildren();
    recoveryId = undefined;
    const outcome = await feedback.execute(async () => {
      const selected = input.files?.[0];
      if (!selected) throw new Error('Choose a journal JSON file.');
      if (selected.size > IMPORT_MAX_BYTES) throw new Error('Import exceeds 32 MiB.');
      file = JSON.parse(await selected.text());
      return run(() => transfer.preview(file, { mode: mode.control.value, includeSettings: settings.control.checked }));
    }, { progress: 'Checking import file and journal…', success: 'Import preview prepared. Review changes before applying.', inspectFailure: false });
    if (!outcome.ok || !messages.isConnected) return;
    preview = outcome.value;
    result.append(section('Import preview', el('p', {}, `${preview.added.length} additions · ${preview.skipped} identical records skipped · ${preview.deleted.length} document deletions · ${preview.conflicts.length} conflicts`),
      ...preview.warnings.map((warning) => notice(warning)), ...preview.conflicts.map((path) => notice(`Conflicting ID: ${path}`, 'error')),
      el('p', {}, preview.includeSettings ? 'Exported settings will replace destination settings.' : 'Destination preferences will be retained; any removed default-account reference will be cleared.')));
    apply.disabled = !preview.canApply; apply.focus();
  });
  for (const node of [input, mode.control, settings.control]) node.addEventListener('change', () => { preview = null; apply.disabled = true; result.replaceChildren(); recovery.replaceChildren(); recoveryId = undefined; feedback.clear(); });
  const backups = el('div');
  const showBackups = async () => {
    backups.replaceChildren();
    try {
      const records = await transfer.backups();
      backups.append(section('Retained recovery backups', records.length ? null : el('p', { class: 'muted' }, 'No retained recovery backups.'), ...records.map((record) => el('div', { class: 'record-panel' },
        el('p', {}, `${record.startedAt} · ${record.rowCount} documents`),
        button('Download recovery JSON', () => feedback.execute(() => run(() => transfer.backupExport(record.id)), { progress: 'Preparing recovery export…', success: 'Recovery export file prepared. Download requested.', onSuccess: (file) => downloadJournal(file, 'vxTradeJournal-recovery'), successFailure: 'Recovery export file was prepared, but download could not be requested. ' }), 'button secondary'),
        button('Delete recovery backup', async () => { if (!confirm('Permanently delete this recovery backup? This cannot be undone.')) return; const outcome = await feedback.execute(() => run(() => transfer.deleteBackup(record.id, true)), { progress: 'Deleting retained recovery backup…', success: 'Recovery backup deleted.' }); if (outcome.ok) await showBackups(); }, 'button danger'),
      ))));
    } catch (error) { if (backups.isConnected) backups.replaceChildren(notice(`Recovery backups could not be loaded: ${error.message}`, 'error')); }
  };
  feedback = transferFeedback({ transfer, operationId: () => recoveryId, onState: (state) => {
    previewButton.disabled = state.pending;
    apply.disabled = state.pending || !preview?.canApply;
    for (const control of [input, mode.control, settings.control]) control.disabled = state.pending;
  } });
  for (const control of [apply, previewButton]) control.setAttribute('aria-describedby', feedback.host.id);
  messages.append(feedback.host);
  ui.show(el('div', {}, header('Import journal', 'Portable vxTradeJournal JSON. Historical source values and snapshots are preserved.'),
    section('Choose source and destination behavior', el('div', { class: 'form-grid' }, el('div', { class: 'field full' }, el('label', { for: inputId }, 'Journal JSON file'), input, el('p', { class: 'help' }, 'Maximum 32 MiB. Operator database snapshots are unsupported.')), mode, settings),
      el('div', { class: 'actions' }, previewButton, apply, button('Back to settings', () => ui.go('settings'), 'button secondary'))), messages, result, recovery, backups));
  void showBackups();
}

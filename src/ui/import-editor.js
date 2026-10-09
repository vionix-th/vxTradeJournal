import { el, button, field, checkbox, header, section, notice } from './components.js';
import { JournalTransfer } from '../persistence/transfer.js';
import { IMPORT_MAX_BYTES } from '../application/portable.js';

export function downloadJournal(file, name = 'vxTradeJournal') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  el('a', { href: url, download: `${name}-${new Date().toISOString().slice(0, 10)}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function recoveryPanel({ transfer, operationId, complete, run = async (action) => action() }) {
  const messages = el('div', { role: 'status', 'aria-live': 'polite' });
  const status = el('p');
  const host = section('Import recovery', el('p', {}, `Operation: ${operationId}`), status, messages);
  const refresh = async () => {
    try { const current = await transfer.status(operationId); status.textContent = `Status: ${current.status} · ${current.phase} · checkpoint ${current.cursor}`; }
    catch (error) { messages.replaceChildren(notice(error.message, 'error')); }
  };
  const execute = async (rollback) => {
    if (rollback && !confirm('Restore journal contents from before this import? Import-created records will be removed.')) return;
    messages.replaceChildren(notice(rollback ? 'Restoring original journal…' : 'Resuming import…'));
    try {
      const result = await run(() => rollback ? transfer.rollback(operationId, true) : transfer.resume(operationId));
      if (['complete', 'rolledBack', 'rejected'].includes(result.status)) await complete();
    } catch (error) { messages.replaceChildren(notice(error.message, 'error')); await refresh(); }
  };
  host.append(el('div', { class: 'actions' }, button('Resume import', () => execute(false)), button('Roll back import', () => execute(true), 'button secondary'), button('Refresh status', refresh, 'button secondary')));
  void refresh(); return host;
}
export function importEditor(ui) {
  const transfer = new JournalTransfer(ui.repo);
  const mode = field('Import mode', 'import-mode', 'add', { choices: [{ value: 'add', label: 'Add only — keep existing records' }, { value: 'replace', label: 'Replace existing journal' }] });
  const settings = checkbox('Apply exported settings', 'include-settings');
  const inputId = `import-file-${crypto.randomUUID()}`;
  const input = el('input', { id: inputId, type: 'file', accept: '.json,application/json' });
  const messages = el('div', { role: 'status', 'aria-live': 'polite' });
  const result = el('div'); const recovery = el('div');
  let file, preview;
  const complete = () => ui.loadUser(ui.user);
  const run = (action) => ui.lifecycle.run(action, async () => {});
  const apply = button('Apply import', async () => {
    if (!preview?.canApply) return;
    const replace = mode.control.value === 'replace';
    if (replace && !confirm('Replace destination journal with this file? Destination-only records will be deleted. A private recovery backup will be retained until explicitly deleted.')) return;
    const operationId = crypto.randomUUID();
    messages.replaceChildren(notice('Uploading source and preparing recovery backup…'));
    transfer.onCheckpoint = ({ cursor }) => { messages.replaceChildren(notice(`Applying import · checkpoint ${cursor}`)); };
    try {
      await run(() => transfer.apply(file, { mode: mode.control.value, includeSettings: settings.control.checked, acceptPreview: preview.fingerprint, operationId, yes: replace }));
      await complete();
    } catch (error) {
      messages.replaceChildren(notice(error.message, 'error'));
      apply.disabled = true;
      recovery.replaceChildren(recoveryPanel({ transfer, operationId: error.details?.operationId || operationId, complete, run }));
    }
  }, 'button', { disabled: true });
  const previewButton = button('Preview import', async () => {
    preview = null; apply.disabled = true; result.replaceChildren(); recovery.replaceChildren();
    try {
      const selected = input.files?.[0];
      if (!selected) throw new Error('Choose a journal JSON file.');
      if (selected.size > IMPORT_MAX_BYTES) throw new Error('Import exceeds 32 MiB.');
      file = JSON.parse(await selected.text());
      preview = await run(() => transfer.preview(file, { mode: mode.control.value, includeSettings: settings.control.checked }));
      messages.replaceChildren();
      result.append(section('Import preview', el('p', {}, `${preview.added.length} additions · ${preview.skipped} identical records skipped · ${preview.deleted.length} document deletions · ${preview.conflicts.length} conflicts`),
        ...preview.warnings.map((warning) => notice(warning)), ...preview.conflicts.map((path) => notice(`Conflicting ID: ${path}`, 'error')),
        el('p', {}, preview.includeSettings ? 'Exported settings will replace destination settings.' : 'Destination preferences will be retained; any removed default-account reference will be cleared.')));
      apply.disabled = !preview.canApply; apply.focus();
    } catch (error) { messages.replaceChildren(notice(error.message, 'error')); }
  });
  for (const node of [input, mode.control, settings.control]) node.addEventListener('change', () => { preview = null; apply.disabled = true; result.replaceChildren(); });
  const backups = el('div');
  const showBackups = async () => {
    backups.replaceChildren();
    try {
      const records = await transfer.backups();
      backups.append(section('Retained recovery backups', records.length ? null : el('p', { class: 'muted' }, 'No retained recovery backups.'), ...records.map((record) => el('div', { class: 'record-panel' },
        el('p', {}, `${record.startedAt} · ${record.rowCount} documents`),
        button('Download recovery JSON', async () => { try { downloadJournal(await transfer.backupExport(record.id), 'vxTradeJournal-recovery'); } catch (error) { messages.replaceChildren(notice(error.message, 'error')); } }, 'button secondary'),
        button('Delete recovery backup', async () => { if (!confirm('Permanently delete this recovery backup? This cannot be undone.')) return; try { await run(() => transfer.deleteBackup(record.id, true)); await showBackups(); } catch (error) { messages.replaceChildren(notice(error.message, 'error')); } }, 'button danger'),
      ))));
    } catch (error) { messages.replaceChildren(notice(error.message, 'error')); }
  };
  ui.show(el('div', {}, header('Import journal', 'Portable vxTradeJournal JSON. Historical source values and snapshots are preserved.'),
    section('Choose source and destination behavior', el('div', { class: 'form-grid' }, el('div', { class: 'field full' }, el('label', { for: inputId }, 'Journal JSON file'), input, el('p', { class: 'help' }, 'Maximum 32 MiB. Operator database snapshots are unsupported.')), mode, settings),
      el('div', { class: 'actions' }, previewButton, apply, button('Back to settings', () => ui.go('settings'), 'button secondary'))), messages, result, recovery, backups));
  void showBackups();
}

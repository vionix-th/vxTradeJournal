import { correctionDiff, correctionReason, correctionPage } from '../application/corrections.js';
import { removeChild } from '../application/operations.js';
import { el, field, values, button, notice, section, mutationErrorMessage } from './components.js';

export function journalValues(form) {
  const result = values(form);
  delete result.correctionReason;
  return result;
}
export function attachCorrectionReason(form, previous, build, { initial = '', retain = () => {} } = {}) {
  const input = field('Correction reason', 'correctionReason', initial, {
    type: 'textarea', containerAttrs: { class: 'full' },
    controlAttrs: { maxlength: 1000 }, help: 'Explain why saved financial facts changed. Stored with changed values.',
  });
  form.body.append(input.node);
  form.correctionReason = input;
  const update = () => {
    let required = false;
    try { required = correctionDiff(previous, build()).length > 0; }
    catch { required = !!previous; }
    input.setVisible(required);
    input.control.required = required;
  };
  input.control.addEventListener('input', () => { input.setError(null); retain(input.control.value); });
  form.node.addEventListener('input', update);
  form.node.addEventListener('change', update);
  form.updateCorrectionReason = update;
  update();
}
export const correctionContext = (form) => ({ correctionReason: form.correctionReason?.control.value || '' });

export function deleteSource(ui, trade, type, id, after) {
  const origin = document.activeElement;
  const reason = field('Correction reason', 'correctionReason', '', { type: 'textarea', controlAttrs: { required: true, maxlength: 1000 } });
  const errors = el('div', { role: 'alert' });
  const submit = el('button', { type: 'submit', class: 'button danger' }, 'Delete record');
  const form = el('form', {}, el('h2', { id: 'correction-delete-title' }, 'Delete saved record'), el('p', {}, 'Deletion recomputes trade history. Explain why this record is removed.'), reason.node, errors);
  const dialog = el('dialog', { class: 'correction-dialog', 'aria-labelledby': 'correction-delete-title' }, form);
  const close = () => { dialog.close(); dialog.remove(); if (origin?.isConnected) origin.focus(); };
  form.append(el('div', { class: 'actions' }, button('Cancel', close, 'button secondary'), submit));
  const operationId = crypto.randomUUID();
  let busy = false;
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (!busy) close(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy) return;
    try {
      correctionReason(reason.control.value, true);
      const next = removeChild(trade, type, id);
      busy = true; submit.disabled = true; reason.control.disabled = true;
      const saved = await ui.commit(async () => { const result = await ui.repo.saveTrade(next, operationId, null, { correctionReason: reason.control.value }); close(); return result; }, after);
      return saved;
    } catch (error) { errors.replaceChildren(notice(mutationErrorMessage(error), 'error')); if (error.details?.path === '/correctionReason') { reason.setError(error.message); reason.control.focus(); } }
    finally { busy = false; submit.disabled = false; reason.control.disabled = false; }
  });
  document.body.append(dialog); dialog.showModal(); reason.control.focus();
}

export function correctionHistory(ui, trade) {
  const node = section('Correction history', el('p', { class: 'help' }, 'Application-recorded changes since schema 2. Earlier changes are unavailable. History does not independently verify authorship.'));
  let page = 1;
  const body = el('div', { class: 'correction-history' });
  const render = () => {
    const result = correctionPage(trade.corrections || [], page);
    const records = result.items.map((group) => el('article', { class: 'card' },
      el('h3', {}, `Revision ${group.revision} · ${ui.date(group.createdAt)}`),
      el('p', { class: 'prose' }, group.reason), el('p', { class: 'help' }, `Operation ${group.operationId}`),
      group.changes.map((record) => {
        const diff = el('details', {}, el('summary', {}, `${record.recordType}: ${record.recordId}`));
        const changed = changedValues(record.before, record.after);
        const table = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Field'), el('th', {}, 'Before'), el('th', {}, 'After'))), el('tbody', {}, changed.map(([name, before, after]) => el('tr', {}, el('th', { scope: 'row' }, name), el('td', {}, before), el('td', {}, after)))));
        diff.append(el('div', { class: 'table-wrap correction-values' }, table));
        return diff;
      })));
    body.replaceChildren(...records, ...(records.length ? [] : [el('p', { class: 'muted' }, 'No recorded corrections.')]),
      el('div', { class: 'pagination' }, button('Previous corrections', () => { page--; render(); }, 'button secondary', { disabled: result.page === 1 }), el('span', { role: 'status' }, `Page ${result.page} of ${result.pages}`), button('Next corrections', () => { page++; render(); }, 'button secondary', { disabled: result.page === result.pages })));
  };
  node.append(body); render(); return node;
}

function changedValues(before, after, prefix = '') {
  const ignored = new Set(['uid', 'schemaVersion', 'revision', 'createdAt', 'updatedAt']);
  return [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter((key) => !ignored.has(key)).flatMap((key) => {
    const old = before?.[key], next = after?.[key];
    if (JSON.stringify(old) === JSON.stringify(next)) return [];
    const name = prefix ? `${prefix} / ${key}` : key;
    if (old && typeof old === 'object' || next && typeof next === 'object') return changedValues(old, next, name);
    const show = (value) => value === undefined ? 'Absent' : value === null ? 'Missing' : String(value);
    return [[name, show(old), after === null ? 'Deleted' : show(next)]];
  });
}

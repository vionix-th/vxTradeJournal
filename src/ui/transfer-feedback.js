import { el, button } from './components.js';
import { transferPhaseLabel } from '../application/transfer-status.js';

const explanations = {
  ready: 'No transfer is blocking this journal.',
  active_export: 'An export is running in another session. Check again before retrying.',
  expired_export: 'The previous export is no longer active. Export can be retried.',
  active_import: 'An import currently reserves journal access. Check its status before taking action.',
  interrupted_import: 'An import is unfinished. Journal records may be partially updated. Inspect recovery before continuing.',
  status_unavailable: 'Transfer status could not be established. Check status before choosing recovery.',
};
function failureMessage(error) {
  const code = String(error.code || '');
  if (code.includes('permission-denied')) return 'Access was denied. Check the signed-in account and transfer status before retrying.';
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) return 'The service could not be reached. Check transfer status before retrying.';
  if (error.code === 'IMPORT_BUSY') return 'This request could not obtain journal transfer access.';
  return error.message || 'The transfer request failed.';
}

/** One request owner; pending, last outcome and read-only observation remain separate. */
export function transferFeedback({ transfer, operationId = () => undefined, onState = () => {} }) {
  const host = el('div', { class: 'transfer-feedback', id: `transfer-feedback-${crypto.randomUUID()}`, role: 'region', 'aria-label': 'Journal transfer feedback' });
  const announcement = el('p', { class: 'transfer-announcement', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const errorText = el('p', { class: 'transfer-error', role: 'alert', hidden: true });
  const observationText = el('p', { class: 'transfer-observation', hidden: true });
  const details = el('details', { class: 'transfer-details', hidden: true }, el('summary', {}, 'Details'));
  const detailsBody = el('div'); details.append(detailsBody);
  const check = button('Check status', () => inspect(), 'button secondary'); check.hidden = true;
  host.append(announcement, errorText, observationText, check, details);
  let state = { pending: false, progress: '', error: null, observation: null, success: '', secondaryErrors: [] };
  let generation = 0;
  const current = (token) => token === generation && host.isConnected;
  function render() {
    announcement.textContent = state.pending ? state.progress : state.success;
    errorText.hidden = !state.error;
    errorText.textContent = state.error ? `Last request failed: ${state.failureContext || (state.error.details?.export?.filePrepared ? 'Export data was prepared, but export did not complete; no download requested. ' : '')}${failureMessage(state.error)}` : '';
    observationText.hidden = !state.observation;
    const observed = state.observation;
    observationText.textContent = observed ? `${observed.reason === 'active_export' && observed.ownedByCaller ? 'The previous export still reserves journal access. Check again before retrying.' : explanations[observed.reason] || explanations.status_unavailable}${observed.issue?.includes('matching') ? ' Recovery needs an app or CLI version matching this import.' : ''}${observed.reason.includes('import') && observed.phase ? ` ${transferPhaseLabel(observed.phase)}. ${Number.isInteger(observed.committedRecords) ? `${observed.committedRecords} records committed in the current phase.` : ''}` : ''}` : '';
    check.hidden = !state.error && !observed;
    check.disabled = state.pending;
    check.textContent = observed?.reason === 'active_export' || observed?.reason === 'active_import' ? 'Check again' : 'Check status';
    details.hidden = !state.error && !observed && !state.secondaryErrors.length;
    detailsBody.replaceChildren();
    const rows = [
      ['Request error', state.error ? `${state.error.code || 'REQUEST_FAILED'}: ${state.error.message}` : null],
      ['Operation', observed?.operationId], ['Phase', observed?.phase], ['Import status', observed?.importStatus],
      ['Expiry (not a completion estimate)', observed?.expiresAt], ['Observed client time', observed?.observedClientTime],
      ['Status issue', observed?.issue],
      ['Export data prepared', state.error?.details?.export ? String(state.error.details.export.filePrepared) : null],
      ['Download requested', state.error?.details?.export ? String(state.error.details.export.downloadRequested) : null],
      ...state.secondaryErrors.map((error) => [`Additional ${error.stage} failure`, `${error.code || 'FAILED'}: ${error.message}`]),
    ];
    for (const [label, value] of rows) if (value != null) detailsBody.append(el('p', {}, el('strong', {}, `${label}: `), value));
    onState(state);
  }
  async function inspect() {
    if (state.pending) return;
    const token = ++generation;
    state = { ...state, pending: true, progress: 'Checking transfer status…', success: '' }; render();
    try {
      const observation = await transfer.inspect(operationId());
      if (current(token)) state = { ...state, observation };
    } catch (error) {
      if (current(token)) state = { ...state, observation: { reason: 'status_unavailable', actions: ['check_status'] }, secondaryErrors: [...state.secondaryErrors, { stage: 'inspection', code: error.code, message: error.message }] };
    } finally { if (current(token)) { state = { ...state, pending: false, progress: '' }; render(); } }
  }
  async function execute(action, { progress = 'Preparing journal transfer…', success = '', onSuccess = () => {}, inspectFailure = true, successFailure = '' } = {}) {
    if (state.pending) return { ok: false, ignored: true };
    const token = ++generation;
    state = { pending: true, progress, error: null, observation: null, success: '', secondaryErrors: [] }; render();
    let produced = false;
    const previousFeedback = transfer.onFeedback;
    const receiveFeedback = ({ error, progress }) => {
      if (current(token)) { state = { ...state, error, progress }; render(); }
    };
    transfer.onFeedback = receiveFeedback;
    try {
      const value = await action(); produced = true;
      if (!current(token)) return { ok: false, detached: true };
      await onSuccess(value);
      if (current(token)) state = { ...state, success };
      return { ok: true, value };
    } catch (error) {
      if (!current(token)) return { ok: false, detached: true };
      let observation = error.details?.transfer;
      const secondaryErrors = [...(error.details?.secondaryErrors || [])];
      if (!observation && inspectFailure) {
        state = { ...state, error, progress: 'Checking transfer status…' }; render();
        try { observation = await transfer.inspect(operationId()); }
        catch (failure) {
          observation = { reason: 'status_unavailable', actions: ['check_status'] };
          secondaryErrors.push({ stage: 'inspection', code: failure.code, message: failure.message });
        }
      }
      if (current(token)) state = { ...state, error, observation, secondaryErrors, failureContext: produced ? successFailure : '' };
      return { ok: false, error };
    } finally {
      if (transfer.onFeedback === receiveFeedback) transfer.onFeedback = previousFeedback;
      if (current(token)) { state = { ...state, pending: false, progress: '' }; render(); }
    }
  }
  render();
  return { host, inspect, execute, get pending() { return state.pending; },
    progress(message) { if (state.pending && host.isConnected) { state = { ...state, progress: message }; render(); } },
    clear() { if (state.pending) return; generation++; state = { pending: false, progress: '', error: null, observation: null, success: '', secondaryErrors: [] }; render(); },
  };
}

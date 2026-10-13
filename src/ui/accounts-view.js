import { el, button, header, recordCard, metric, empty, notice } from './components.js';
import { aggregateAccount } from '../application/journal.js';
import { money } from '../domain/journal.js';
import { JournalTransfer } from '../persistence/transfer.js';
import { transferFeedback } from './transfer-feedback.js';
import { recoveryPanel } from './import-editor.js';

export function accountsView(ui, arg) {
  let archived = !!arg?.archived;
  const counts = [false, true].map((state) => ui.data.accounts.filter((account) => !!account.archived === state).length);
  const panelId = `accounts-${crypto.randomUUID()}`;
  const panel = el('div', { id: panelId, role: 'tabpanel', class: 'account-list' });
  const tabs = [false, true].map((state, index) => button(`${state ? 'Archived' : 'Active'} (${counts[index]})`, () => select(state), 'button secondary account-tab', {
    id: `${panelId}-${index}`, role: 'tab', 'aria-controls': panelId,
  }));
  const tablist = el('div', { role: 'tablist', 'aria-label': 'Account status', class: 'account-tabs' }, tabs);
  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    if (tabs.some((tab) => tab.disabled)) return;
    event.preventDefault();
    select(event.key === 'Home' ? false : event.key === 'End' ? true : !archived);
    tabs[archived ? 1 : 0].focus();
  });
  function select(state) {
    archived = state;
    tabs.forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === (archived ? 1 : 0))); tab.tabIndex = index === (archived ? 1 : 0) ? 0 : -1; });
    panel.setAttribute('aria-labelledby', tabs[archived ? 1 : 0].id);
    const accounts = ui.data.accounts.filter((account) => !!account.archived === archived);
    if (!accounts.length) panel.tabIndex = 0;
    else panel.removeAttribute('tabindex');
    panel.replaceChildren(...accounts.map(card));
    if (!accounts.length) panel.append(empty(archived ? 'No archived accounts' : 'No active accounts', archived ? 'Archived accounts appear here for restoration or permanent deletion.' : 'Create an account or restore one from Archived.'));
  }
  function card(account) {
    const transfer = new JournalTransfer(ui.repo);
    const recovery = el('div');
    const confirmation = el('div', { id: `confirm-account-${crypto.randomUUID()}`, role: 'group', 'aria-label': 'Confirm permanent account deletion', class: 'account-delete-confirmation', hidden: true });
    let feedback, operationId, preview;
    const run = (action) => ui.lifecycle.run(action, async () => {});
    const refresh = async () => ui.commit(async () => null, () => ui.go('accounts', { archived }, true, { replace: true }));
    const edit = button('Edit account', () => ui.go('accountEditor', account), 'button secondary');
    const toggle = button(account.archived ? 'Restore account' : 'Archive account', async () => {
      if (!account.archived && !confirm(`Archive ${account.name}? Its trades will disappear from the journal and totals. Restore the account to view or edit them again.`)) return;
      await ui.action(() => ui.repo.saveEntity('accounts', { ...account, archived: !account.archived }), () => ui.go('accounts', null, true, { replace: true }));
    }, 'button secondary');
    const remove = button('Delete account', async () => {
      if (feedback.pending) return;
      preview = undefined; confirmation.hidden = true; recovery.replaceChildren(); operationId = undefined;
      const outcome = await feedback.execute(() => run(() => transfer.previewAccountDeletion(account.id, account.revision)), { progress: 'Checking linked account records…', success: 'Deletion preview ready. Review before confirming.' });
      if (!outcome.ok) return;
      preview = outcome.value;
      confirmation.replaceChildren(notice(`Permanently delete ${account.name} and ${preview.tradeCount} ${preview.tradeCount === 1 ? 'trade' : 'trades'}? All linked executions, adjustments, corrections and receipts will be removed. This cannot be undone after completion. Existing downloaded exports and separate recovery backups remain unchanged.`, 'error'),
        el('div', { class: 'actions' }, permanent, button('Cancel deletion', () => { if (feedback.pending) return; confirmation.hidden = true; preview = undefined; feedback.clear(); remove.focus(); }, 'button secondary')));
      confirmation.hidden = false; permanent.focus();
    }, 'button danger');
    const permanent = button('Permanently delete account', async () => {
      if (!preview || feedback.pending) return;
      const focusRecovery = confirmation.contains(document.activeElement);
      operationId = crypto.randomUUID();
      transfer.onCheckpoint = ({ cursor }) => feedback.progress(`Deleting linked account records… ${cursor} records committed.`);
      const outcome = await feedback.execute(() => run(() => transfer.deleteAccount(account.id, { revision: account.revision, acceptPreview: preview.fingerprint, operationId, yes: true })), {
        progress: 'Preparing account deletion…', success: 'Account and linked history deleted.',
      });
      if (outcome.ok) await refresh();
      else if (outcome.error && recovery.isConnected) {
        confirmation.hidden = true; preview = undefined;
        recovery.replaceChildren(recoveryPanel({ transfer, operationId, complete: refresh, run }));
        if (focusRecovery) {
          const heading = recovery.querySelector('h2'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
        }
      }
    }, 'button danger');
    feedback = transferFeedback({ transfer, operationId: () => operationId, onState: (state) => {
      for (const control of [edit, toggle, remove, permanent, ...tabs, ...confirmation.querySelectorAll('button')]) control.disabled = state.pending;
    } });
    feedback.host.hidden = !account.archived;
    for (const control of [remove, permanent]) control.setAttribute('aria-describedby', feedback.host.id);
    permanent.setAttribute('aria-describedby', `${feedback.host.id} ${confirmation.id}`);
    const aggregate = account.archived ? null : aggregateAccount(ui.data.trades, account.id);
    return recordCard(account.name, el('div', { class: 'actions' }, account.archived ? null : edit, toggle, account.archived ? remove : null),
      el('p', { class: 'muted' }, `${account.currency} · ${account.archived ? 'Archived — excluded from journal and totals' : 'Active'} · ${account.hasTrades ? 'Reporting currency fixed' : 'Reporting currency editable'}`),
      aggregate ? el('div', { class: 'metrics' }, metric('Complete realized net', money(aggregate.total, account.currency)), metric('Incomplete trades excluded', String(aggregate.incomplete.length))) : null,
      feedback.host, confirmation, recovery);
  }
  select(archived);
  ui.show(el('div', {}, header('Accounts', 'Active accounts contribute to the journal. Archived accounts retain history until permanently deleted.', button('New account', () => ui.go('accountEditor'))), tablist, panel));
}

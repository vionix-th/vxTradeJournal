import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '../../src/ui/styles.css';
import { el, button } from '../../src/ui/components.js';
import { brand, projectInformation } from '../../src/ui/branding.js';
import { workspaceNavigation } from '../../src/ui/workspace-navigation.js';
import { workspaceShell } from '../../src/ui/workspace-shell.js';
import { skillDownloadPanel } from '../../src/ui/skill-download.js';
import { journalView, accountsView } from '../../src/ui/views.js';
import { normalizeAccount, normalizeInstrument, normalizeStrategy, createTrade } from '../../src/domain/journal.js';
import { prepareTrade } from '../../src/application/journal.js';

export function journalData(count = 1) {
  const account = normalizeAccount({ id: 'a', name: 'Long account identity for history comparison across narrow screens', currency: 'USD' });
  const instrument = normalizeInstrument({ id: 'i', name: 'Audit instrument', symbol: 'AUDIT', preset: 'equity', market: 'Equities', model: 'linear', currency: 'USD', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1' });
  const strategy = normalizeStrategy({ id: 'history-strategy', name: 'Long strategy identity for lifecycle and realized outcome review' });
  const trades = Array.from({ length: count }, (_, index) => {
    const trade = createTrade({ id: `journal-filter-${index}`, account, strategy: index ? strategy : null, instruments: [{ instrument, direction: 'long' }] });
    trade.createdAt = '2089-01-01T00:00:00Z'; trade.updatedAt = trade.createdAt;
    trade.tags = index ? [index % 2 ? 'blue' : 'red'] : [];
    return prepareTrade(trade, { accounts: [account], instruments: [instrument], strategies: [strategy] });
  });
  return { accounts: [account], instruments: [instrument], strategies: [strategy], trades, settings: { timezone: 'UTC', theme: 'light' } };
}

/** Mount real presentation modules; adapters only supply data and route observations. */
export function mountWorkspace(data = journalData()) {
  const content = el('div', { class: 'page-content' });
  const main = el('main', { id: 'main', tabindex: '-1' }, el('div', { class: 'workspace-bar' }, el('span', { class: 'workspace-name' }, 'Workspace / Trading journal')), content);
  const reload = button('Reload records', () => {}, 'session-action');
  const session = el('section', { class: 'sidebar-footer session-details', 'aria-label': 'Session' },
    el('div', { class: 'session-profile' }, el('p', {}, 'synthetic@example.test')), reload,
    button('Sign out', () => {}, 'session-action'), skillDownloadPanel({ compact: true }));
  const ui = { data, main, repo: { db: {}, uid: 'fixture' }, page: 1, filters: {}, show(node) { content.replaceChildren(node); }, date(value) { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: data.settings.timezone }).format(new Date(value)); },
    go(route) { this.journalFilterView?.dispose(); workspace.resetScroll(); if (route === 'journal') journalView(this); else if (route === 'accounts') accountsView(this); else this.show(el('h1', {}, route === 'trade' ? 'Trade details' : route)); } };
  const media = matchMedia('(min-width: 701px)');
  const navigation = workspaceNavigation((route) => ui.go(route), media.matches, session, reload);
  const sidebar = el('aside', { class: 'sidebar' }, brand(), el('span', { class: 'nav-label' }, 'Workspace'), navigation.nav, navigation.sessionSlot, navigation.projectActions);
  const workspace = workspaceShell(sidebar, main, navigation, media);
  document.getElementById('app').replaceChildren(workspace.shell);
  journalView(ui);
  window.fixtureUI = ui;
  return ui;
}

export function mountPublic() {
  document.getElementById('app').replaceChildren(el('main', { class: 'page-content' }, brand(), projectInformation()));
}
window.harness = { mountWorkspace, mountPublic, journalData };
mountPublic();

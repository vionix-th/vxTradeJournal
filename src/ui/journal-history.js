import { activeJournal } from '../application/accounts.js';
import { journalTimeline } from '../application/journal-timeline.js';
import { el, button, result, empty } from './components.js';
import { icon } from './icons.js';

/** History content only; heading, sort controls and live status stay mounted. */
export function journalHistoryContent(ui, list, changePage, timelines) {
  const content = el('div', { class: 'history-results' });
  const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: ui.data.settings.timezone });
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: ui.data.settings.timezone });
  const accountName = (trade) => ui.data.accounts.find((account) => account.id === trade.accountId)?.name || '—';
  const symbols = (trade) => trade.instruments.map((instrument) => instrument.symbol || instrument.name).join(' / ');
  const tags = (trade) => trade.tags.length ? el('ul', { class: 'history-tags', role: 'list', 'aria-label': 'Tags' },
    trade.tags.map((tag) => el('li', { class: 'history-tag' }, tag))) : null;
  const identity = (trade, { includeTags = true } = {}) => el('div', { class: 'history-identity' },
    el('div', { class: 'history-instrument' },
      el('strong', {}, symbols(trade)),
      el('span', { class: 'history-direction' }, trade.legs.length > 1 ? `Combination · ${trade.legs.length} legs` : trade.legs[0].direction === 'long' ? 'Long' : 'Short')),
    el('dl', { class: 'history-context' },
      el('div', {}, el('dt', { class: 'visually-hidden' }, 'Account'), el('dd', {}, accountName(trade))),
      el('div', {}, el('dt', { class: 'visually-hidden' }, 'Strategy'), el('dd', {}, trade.strategySnapshot?.name || 'No strategy'))),
    includeTags ? tags(trade) : null);
  const status = (trade) => el('span', { class: `badge status-${trade.status}` }, trade.status === 'open' ? 'Open' : 'Closed');
  const time = (value) => value ? el('time', { datetime: value, title: ui.date(value), class: 'history-time' },
    dateFormat.format(new Date(value)), el('span', {}, timeFormat.format(new Date(value)))) : el('span', { class: 'muted' }, '—');
  const dates = (trade) => timelines.get(trade.id) || journalTimeline(trade);
  const opening = (trade) => {
    const timeline = dates(trade);
    return el('div', { class: 'history-opening' }, timeline.entered === false ? el('span', { class: 'history-date-note' }, 'Created') : null,
      time(timeline.openedAt), timeline.entered === false ? el('span', { class: 'history-date-note' }, 'Not entered') : null);
  };
  const outcomeLabel = (trade) => trade.status === 'open' ? 'Realized so far' : 'Realized net';
  const outcome = (trade, { card = false } = {}) => el('div', { class: 'history-outcome' },
    el('span', { class: `history-result-label${card && trade.status === 'closed' ? ' visually-hidden' : ''}` }, outcomeLabel(trade)),
    trade.summary.complete && trade.summary.accountNet != null ? result(trade.summary.accountNet, trade.accountCurrency)
      : el('span', { class: 'muted' }, `Incomplete · ${trade.accountCurrency}`));
  const action = (trade) => button(['View details', icon('arrow', 16)], () => ui.go('trade', trade.id), 'button quiet history-details',
    { 'aria-label': `View details for ${symbols(trade)} in ${accountName(trade)}` });
  if (!list.items.length) content.append(activeJournal(ui.data).trades.length ? empty('No matching trades', 'Adjust filters to show records.') : empty('No trades yet', 'Configure instruments, then record first trading idea.'));
  else {
    const table = el('table', { class: 'journal-table', 'aria-label': 'Trades' }, el('colgroup', {},
      ['trade', 'status', 'opened', 'closed', 'net', 'action'].map((name) => el('col', { class: `history-column-${name}` }))),
    el('thead', {}, el('tr', {}, ['Trade', 'Status', 'Opened', 'Closed', 'Realized net', 'Action'].map((title, index) => el('th', { scope: 'col', class: index === 4 ? 'numeric' : '' }, title)))));
    table.append(el('tbody', {}, list.items.map((trade) => el('tr', { 'data-trade-id': trade.id },
      el('td', {}, identity(trade)), el('td', {}, status(trade)), el('td', {}, opening(trade)), el('td', {}, time(dates(trade).closedAt)),
      el('td', { class: 'numeric net-cell' }, outcome(trade)), el('td', { class: 'row-action' }, action(trade))))));
    content.append(el('div', { class: 'history-table-wrap' }, table));
    content.append(el('div', { class: 'history-cards' }, list.items.map((trade) => el('article', { class: 'history-card', 'data-trade-id': trade.id },
      el('div', { class: 'history-card-heading' }, identity(trade, { includeTags: false }), status(trade)),
      el('dl', { class: 'history-card-dates' },
        el('div', {}, el('dt', {}, 'Opened'), el('dd', {}, opening(trade))),
        el('div', {}, el('dt', {}, 'Closed'), el('dd', {}, time(dates(trade).closedAt)))),
      el('div', { class: 'history-card-footer' }, outcome(trade, { card: true }), action(trade)),
      tags(trade)))));
  }
  content.append(el('div', { class: 'pagination' },
    el('span', { class: 'muted' }, `${list.total} ${list.total === 1 ? 'trade' : 'trades'} · page ${list.page} of ${list.pages}`),
    el('div', { class: 'actions' },
      button('Previous', () => changePage(list.page - 1), 'button secondary', { disabled: list.page <= 1 ? true : null, 'data-page-action': 'previous' }),
      button('Next', () => changePage(list.page + 1), 'button secondary', { disabled: list.page >= list.pages ? true : null, 'data-page-action': 'next' }))));
  return content;
}

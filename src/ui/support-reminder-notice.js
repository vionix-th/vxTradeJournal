import { el, button } from './components.js';

/** Secondary floating notice; journal errors and editor locks own priority. */
export function supportReminderNotice({ support, postpone, disable }) {
  const element = el('section', { class: 'support-reminder', role: 'status', 'aria-live': 'polite', 'aria-label': 'Support reminder' },
    el('p', {}, 'Finding vxTradeJournal useful? Support its upkeep.'),
    el('div', { class: 'support-reminder-actions' },
      button('Support', support, 'button secondary'),
      button('Not now', postpone, 'button quiet'),
      button('Don’t remind me', disable, 'button quiet')));
  document.body.append(element);
  return { element, destroy: () => element.remove() };
}

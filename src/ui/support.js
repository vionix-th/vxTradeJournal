import { supportReminders } from './support-reminder-policy.js';
import { el, button } from './components.js';
import { icon } from './icons.js';
import { cryptoSupport } from './crypto-support.js';

export const SUPPORT_URL = 'https://ko-fi.com/vionixconsulting';
export const SUPPORT_EMBED_URL = `${SUPPORT_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;
let nextId = 0;

/** Resolve the return control at close so responsive navigation stays focusable. */
export function openSupportDialog(opener) {
  if (document.querySelector('dialog[open]')) return;
  void supportReminders.postpone();
  window.dispatchEvent(new Event('support-dialog-open'));
  const titleId = `support-title-${++nextId}`;
  const status = el('p', { role: 'status' }, 'Loading Ko-fi…');
  const fallback = el('a', { href: SUPPORT_URL, target: '_blank', rel: 'noopener noreferrer', hidden: true }, 'Open Ko-fi in new tab');
  const feedback = el('div', { class: 'support-feedback' }, status, fallback);
  const frame = el('iframe', {
    src: SUPPORT_EMBED_URL,
    title: 'Support Vionix Consulting on Ko-fi',
    referrerpolicy: 'no-referrer',
  });
  const close = button(el('span', { 'aria-hidden': 'true' }, '×'), () => dialog.close(), 'modal-close', { autofocus: true, 'aria-label': 'Close' });
  const kofiPanel = el('div', { id: `${titleId}-kofi-panel`, role: 'tabpanel', 'aria-labelledby': `${titleId}-kofi-tab`, class: 'support-kofi' },
    feedback, el('div', { class: 'support-panel' }, frame));
  const cryptoPanel = el('div', { id: `${titleId}-crypto-panel`, role: 'tabpanel', 'aria-labelledby': `${titleId}-crypto-tab`, hidden: true });
  let crypto;
  const tabs = ['Cash', 'Crypto'].map((name, index) => button([icon(index ? 'crypto' : 'cash', 16), el('span', {}, name)], () => selectMethod(index), 'support-method', {
    id: `${titleId}-${index ? 'crypto' : 'kofi'}-tab`, role: 'tab',
    'aria-controls': index ? cryptoPanel.id : kofiPanel.id,
    'aria-selected': index === 0, tabindex: index === 0 ? '0' : '-1',
  }));
  function selectMethod(index) {
    if (index === 1 && !crypto) {
      crypto = cryptoSupport(titleId);
      cryptoPanel.append(crypto.node);
    }
    tabs.forEach((tab, position) => {
      tab.setAttribute('aria-selected', position === index);
      tab.tabIndex = position === index ? 0 : -1;
    });
    kofiPanel.hidden = index !== 0;
    cryptoPanel.hidden = index !== 1;
  }
  const methods = el('div', { class: 'support-methods', role: 'tablist', 'aria-label': 'Donation method' }, tabs);
  methods.addEventListener('keydown', (event) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - current;
    selectMethod(next);
    tabs[next].focus();
  });
  const dialog = el('dialog', { class: 'support-dialog', 'aria-labelledby': titleId },
    el('header', { class: 'support-header' }, el('h2', { id: titleId }, 'Support vxTradeJournal'), close),
    methods, el('div', { class: 'support-body' }, kofiPanel, cryptoPanel));
  const timer = setTimeout(() => {
    status.textContent = 'Taking longer than expected.';
    fallback.hidden = false;
  }, 10_000);
  frame.addEventListener('load', () => {
    clearTimeout(timer);
    feedback.hidden = true;
  });
  dialog.addEventListener('close', () => {
    clearTimeout(timer);
    crypto?.dispose();
    dialog.remove();
    const control = typeof opener === 'function' ? opener() : opener;
    if (control instanceof HTMLElement && control.isConnected) control.focus();
  });
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}

export function supportButton(onClick = (event) => openSupportDialog(event.currentTarget)) {
  return button([icon('heart', 16), el('span', {}, 'Support')], onClick, 'button secondary support-trigger', { 'aria-label': 'Support this project' });
}

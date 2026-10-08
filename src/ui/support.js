import { el, button } from './components.js';

export const SUPPORT_URL = 'https://ko-fi.com/vionixconsulting';
export const SUPPORT_EMBED_URL = `${SUPPORT_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;
let nextId = 0;

function openSupportDialog(opener) {
  const titleId = `support-title-${++nextId}`;
  const status = el('p', { role: 'status' }, 'Loading Ko-fi…');
  const frame = el('iframe', {
    src: SUPPORT_EMBED_URL,
    title: 'Support Vionix Consulting on Ko-fi',
    referrerpolicy: 'no-referrer',
  });
  const close = button('Close', () => dialog.close(), 'button secondary', { autofocus: true });
  const dialog = el('dialog', { class: 'support-dialog', 'aria-labelledby': titleId },
    el('header', { class: 'support-header' }, el('h2', { id: titleId }, 'Support vxTradeJournal'), close),
    el('div', { class: 'support-body' },
      el('p', {}, 'Optional one-time or monthly support helps maintain vxTradeJournal and other free Vionix projects. Contributions go to Vionix Consulting through Ko-fi. Donating is not required to use this app.'),
      el('a', { href: SUPPORT_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Open Ko-fi in new tab'),
      status, frame));
  const timer = setTimeout(() => {
    status.textContent = 'Taking longer than expected. Try opening Ko-fi in a new tab.';
  }, 10_000);
  frame.addEventListener('load', () => {
    clearTimeout(timer);
    status.remove();
  });
  dialog.addEventListener('close', () => {
    clearTimeout(timer);
    dialog.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  });
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}

export function supportButton() {
  return button('Support this project', (event) => openSupportDialog(event.currentTarget), 'button secondary support-trigger');
}

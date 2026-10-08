import { el, button } from './components.js';

export const SUPPORT_URL = 'https://ko-fi.com/vionixconsulting';
export const SUPPORT_EMBED_URL = `${SUPPORT_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;
let nextId = 0;

export function openSupportDialog(opener) {
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
  const dialog = el('dialog', { class: 'support-dialog', 'aria-labelledby': titleId },
    el('header', { class: 'support-header' }, el('h2', { id: titleId }, 'Support vxTradeJournal'), close),
    el('div', { class: 'support-body' }, feedback, frame));
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
    dialog.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  });
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}

export function supportButton(onClick = (event) => openSupportDialog(event.currentTarget)) {
  return button('Support', onClick, 'button secondary support-trigger', { 'aria-label': 'Support this project' });
}

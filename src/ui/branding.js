import { el, button } from './components.js';
import { openSupportDialog, supportButton } from './support.js';

export const VIONIX_URL = 'https://vionix.cloud';
export const REPOSITORY_URL = 'https://github.com/vionix-th/vxTradeJournal';

function externalLink(label, href) {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);
}

export function publisherCredit() {
  const link = externalLink('', VIONIX_URL);
  link.className = 'publisher-credit';
  link.setAttribute('aria-label', 'By Vionix Consulting (opens in a new tab)');
  link.append(
    el('span', {}, 'By Vionix Consulting'),
  );
  return link;
}

export function projectInformation() {
  const about = button('About', () => openAbout(about), 'project-action', { 'aria-label': 'About vxTradeJournal' });
  return el('div', { class: 'project-actions' }, about, supportButton());
}

function openAbout(opener) {
  const close = button(el('span', { 'aria-hidden': 'true' }, '×'), () => dialog.close(), 'modal-close', { autofocus: true, 'aria-label': 'Close' });
  const dialog = el('dialog', { class: 'about-dialog', 'aria-labelledby': 'project-about-title' },
    el('header', { class: 'support-header' }, el('h2', { id: 'project-about-title' }, 'About vxTradeJournal'), close),
    el('div', { class: 'project-information-body' },
      el('p', {}, 'A private trading journal for recording instruments, executions, decisions, and historical results.'),
      externalLink('Created by Vionix Consulting', VIONIX_URL),
      el('nav', { class: 'project-links', 'aria-label': 'Project links' },
        externalLink('Project on GitHub', REPOSITORY_URL),
        externalLink('Report an issue', `${REPOSITORY_URL}/issues`),
        externalLink('Contact Vionix', `${VIONIX_URL}/#contact`)),
      el('p', { class: 'help' }, `App v${typeof __APP_VERSION__ === 'undefined' ? '0.2.0' : __APP_VERSION__}`),
      supportButton(() => dialog.close('support'))));
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (opener.isConnected) opener.focus();
    if (dialog.returnValue === 'support') openSupportDialog(opener);
  });
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}

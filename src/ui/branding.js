import { el, button } from './components.js';
import { icon } from './icons.js';
import { skillDownloadPanel } from './skill-download.js';
import { openSupportDialog, supportButton } from './support.js';

export const VIONIX_URL = 'https://vionix.cloud';
export const REPOSITORY_URL = 'https://github.com/vionix-th/vxTradeJournal';

function externalLink(label, href) {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);
}

export function brand() {
  const link = externalLink('', VIONIX_URL);
  link.className = 'brand';
  link.setAttribute('aria-label', 'vxTradeJournal by Vionix Consulting (opens in a new tab)');
  link.append(
    el('img', { class: 'brand-logo', src: `${import.meta.env.BASE_URL}vionix-logo.png`, alt: '', width: 36, height: 36 }),
    el('span', { class: 'brand-copy' }, el('strong', {}, 'vxTradeJournal'), el('span', { class: 'publisher-credit' }, 'By Vionix Consulting')),
  );
  return link;
}

export function projectInformation() {
  const about = button([icon('info', 16), el('span', {}, 'About')], () => openAbout(about), 'project-action', { 'aria-label': 'About vxTradeJournal' });
  return el('div', { class: 'project-actions' }, about, supportButton());
}

function projectResource(name, caption, href, glyph) {
  return el('a', { class: 'project-resource', href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${name} (opens in a new tab)` },
    el('span', { class: 'project-resource-icon' }, icon(glyph, 20)),
    el('span', { class: 'project-resource-copy' }, el('strong', {}, name), el('small', {}, caption)),
    icon('external', 14));
}

function openAbout(opener) {
  const close = button(el('span', { 'aria-hidden': 'true' }, '×'), () => dialog.close(), 'modal-close', { autofocus: true, 'aria-label': 'Close' });
  const dialog = el('dialog', { class: 'about-dialog', 'aria-labelledby': 'project-about-title' },
    el('header', { class: 'support-header' }, el('h2', { id: 'project-about-title' }, 'About', el('span', { class: 'visually-hidden' }, ' vxTradeJournal')), close),
    el('div', { class: 'project-information-body' },
      el('div', { class: 'about-identity' }, brand()),
      el('p', { class: 'about-description' }, 'Record your trading decisions, executions and results in one private workspace.'),
      el('nav', { class: 'project-links', 'aria-label': 'Project links' },
        projectResource('Project on GitHub', 'Browse the project', REPOSITORY_URL, 'github'),
        projectResource('Report an issue', 'Bugs and feedback', `${REPOSITORY_URL}/issues`, 'message'),
        projectResource('Contact Vionix', 'Get in touch with the publisher', `${VIONIX_URL}/#contact`, 'mail')),
      el('footer', { class: 'about-footer' },
        el('span', { class: 'about-version' }, `App v${typeof __APP_VERSION__ === 'undefined' ? '0.2.0' : __APP_VERSION__}`),
        supportButton(() => dialog.close('support')))));
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (opener.isConnected) opener.focus();
    if (dialog.returnValue === 'support') openSupportDialog(opener);
  });
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}

export function authFrame(card) {
  return el('main', {class:'auth-shell auth-layout'},
    el('aside', {class:'auth-story'}, brand(), el('div', {class:'auth-intro'}, el('span', {class:'eyebrow'}, 'A record behind every decision'), el('h2', {}, 'Trade with intention.\nReview with clarity.'), el('p', {}, 'One private workspace for your instruments, executions and trading decisions.'), el('div', {class:'auth-features'}, ...[['journal','Every execution, in context'],['accounts','Precise results, by account'],['lock','A journal that stays yours']].map(([name,text])=>el('div', {}, icon(name), text)))), el('p', {class:'auth-story-footer'}, 'vxTradeJournal · A clearer trading record')),
    el('div', {class:'auth-form-area'}, card, el('p', {class:'auth-footnote'}, 'Your process. Your record. Your perspective.'), skillDownloadPanel(), projectInformation()));
}

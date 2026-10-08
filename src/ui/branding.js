import { el } from './components.js';
import { supportButton } from './support.js';

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
    el('img', { src: `${import.meta.env.BASE_URL}vionix-logo.png`, alt: '', width: 24, height: 24 }),
    el('span', {}, 'By Vionix Consulting'),
  );
  return link;
}

export function projectInformation() {
  return el('details', { class: 'project-information' },
    el('summary', {}, 'About vxTradeJournal'),
    el('div', { class: 'project-information-body' },
      el('p', {}, 'A private trading journal for recording instruments, executions, decisions, and historical results. Created by Vionix Consulting.'),
      el('nav', { class: 'project-links', 'aria-label': 'Project links' },
        externalLink('Project on GitHub', REPOSITORY_URL),
        externalLink('Report an issue', `${REPOSITORY_URL}/issues`),
        externalLink('Contact Vionix', `${VIONIX_URL}/#contact`)),
      el('p', { class: 'help' }, `App v${typeof __APP_VERSION__ === 'undefined' ? '0.2.0' : __APP_VERSION__}`),
      supportButton()));
}

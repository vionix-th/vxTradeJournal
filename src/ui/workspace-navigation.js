import { el, button } from './components.js';
import { icon } from './icons.js';
import { projectInformation } from './branding.js';

/** One set of actions moves between the desktop rail and compact disclosure. */
export function workspaceNavigation(go, desktop, session, reload) {
  const nav = el('nav', { 'aria-label': 'Main navigation' });
  for (const [route, title] of Object.entries({ journal: 'Journal', instruments: 'Instruments', strategies: 'Strategies', accounts: 'Accounts' })) {
    nav.append(button([icon(route), el('span', {}, title)], () => go(route), 'nav-item', { 'data-route': route }));
  }
  const menuActions = el('div', { class: 'project-actions' });
  const menu = el('div', { id: 'workspace-more', class: 'more-menu', popover: 'auto', 'aria-label': 'More actions' }, menuActions);
  const more = button([icon('more'), el('span', {}, 'More')], () => {
    menu.style.top = `${more.getBoundingClientRect().bottom + 6}px`;
  }, 'nav-item more-trigger', { 'aria-controls': menu.id, 'aria-expanded': 'false', 'data-navigation-section': 'settings' });
  more.popoverTargetElement = menu;
  menu.addEventListener('beforetoggle', (event) => {
    more.setAttribute('aria-expanded', String(event.newState === 'open'));
  });
  menu.addEventListener('toggle', (event) => {
    if (event.newState !== 'open') return;
    const bounds = menu.getBoundingClientRect();
    menu.style.top = `${Math.max(16, Math.min(bounds.top, window.innerHeight - bounds.height - 16))}px`;
  });
  function close() {
    if (menu.matches(':popover-open')) menu.hidePopover();
  }
  const sessionSlot = el('div', { class: 'session-slot' }, session);
  const reloadNext = reload.nextSibling;
  reload.addEventListener('click', close, { capture: true });
  session.addEventListener('click', (event) => {
    if (event.target.closest('button, a')) close();
  }, { capture: true });
  const settings = button([icon('settings'), el('span', {}, 'Settings')], () => {
    close();
    go('settings');
  }, 'nav-item', { 'data-route': 'settings' });
  const projectActions = projectInformation({ beforeOpen: close, getOpener: (control) => desktop ? control : more });
  const actions = [...projectActions.children];
  nav.append(settings, more, menu);
  function setDesktop(value) {
    const focused = document.activeElement;
    const actionFocused = focused === settings || focused === reload || actions.includes(focused) || session.contains(focused);
    close();
    desktop = value;
    more.hidden = desktop;
    projectActions.hidden = !desktop;
    sessionSlot.hidden = !desktop;
    if (desktop) {
      nav.insertBefore(settings, more);
      projectActions.append(...actions);
      sessionSlot.append(session);
      session.insertBefore(reload, reloadNext);
    } else {
      menu.prepend(settings);
      menuActions.append(...actions);
      menu.append(session);
      menu.insertBefore(reload, menuActions);
    }
    if (actionFocused) (desktop ? focused : more).focus();
    else if (desktop && focused === more) settings.focus();
  }
  setDesktop(desktop);
  return { nav, projectActions, sessionSlot, more, setDesktop };
}

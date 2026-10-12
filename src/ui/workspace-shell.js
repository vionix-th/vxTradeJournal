import { el, button } from './components.js';
import { icon } from './icons.js';

const preferenceKey = 'vxTradeJournal.sidebar-collapsed';
let collapsed = false;
try { collapsed = localStorage.getItem(preferenceKey) === 'true'; } catch { /* Storage is optional. */ }

/** Own viewport presentation without rebuilding navigation or live editors. */
export function workspaceShell(sidebar, main, navigation, media) {
  const events = new AbortController();
  const options = { signal: events.signal };
  const shell = el('div', { class: 'shell' }, sidebar, main);
  const toggle = button([], () => {
    const mainScroll = main.scrollTop;
    const sidebarScroll = sidebar.scrollTop;
    collapsed = !collapsed;
    try { localStorage.setItem(preferenceKey, String(collapsed)); } catch { /* Keep in-memory preference. */ }
    update();
    main.scrollTop = mainScroll;
    sidebar.scrollTop = sidebarScroll;
  }, 'sidebar-toggle');
  const workspaceBar = main.querySelector(".workspace-bar");
  workspaceBar.prepend(el("div", { class: "workspace-heading" }, toggle, workspaceBar.querySelector(".workspace-name")));
  const tooltip = el('div', { class: 'sidebar-tooltip', role: 'tooltip', id: 'sidebar-tooltip', hidden: true });
  shell.append(tooltip);
  let tooltipControl;
  function dismiss() {
    tooltip.hidden = true;
    tooltipControl?.removeAttribute('aria-describedby');
    tooltipControl = null;
  }
  function update() {
    dismiss();
    shell.classList.toggle('sidebar-collapsed', collapsed);
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.replaceChildren(icon(collapsed ? 'expandSidebar' : 'collapseSidebar'));
  }
  // Keep accessible names independent of labels hidden by collapsed presentation.
  for (const control of sidebar.querySelectorAll('button, a')) {
    if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', control.textContent.trim());
  }
  function show(control) {
    if (!media.matches || !collapsed || !control || control.closest('.more-menu')) return;
    dismiss();
    tooltipControl = control;
    tooltip.textContent = control.getAttribute('aria-label');
    tooltip.hidden = false;
    control.setAttribute('aria-describedby', tooltip.id);
    const anchor = control.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(anchor.right + 8, window.innerWidth - bounds.width - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(anchor.top + (anchor.height - bounds.height) / 2, window.innerHeight - bounds.height - 8))}px`;
  }
  sidebar.addEventListener('pointerover', (event) => show(event.target.closest('button, a')), options);
  sidebar.addEventListener('pointerout', (event) => {
    if (tooltipControl && !tooltipControl.contains(event.relatedTarget) && document.activeElement !== tooltipControl) dismiss();
  }, options);
  sidebar.addEventListener('focusin', (event) => show(event.target.closest('button, a')), options);
  sidebar.addEventListener('focusout', dismiss, options);
  sidebar.addEventListener('click', dismiss, options);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') dismiss(); }, options);
  window.addEventListener('scroll', dismiss, { ...options, capture: true });
  window.addEventListener('resize', dismiss, options);

  let desktop = media.matches;
  let contentOffset = 0;
  function rememberScroll() {
    contentOffset = desktop ? main.scrollTop : Math.max(0, -main.getBoundingClientRect().top);
  }
  main.addEventListener('scroll', rememberScroll, options);
  window.addEventListener('scroll', rememberScroll, options);
  media.addEventListener('change', (event) => {
    const offset = contentOffset;
    const toggleFocused = document.activeElement === toggle;
    desktop = event.matches;
    dismiss();
    navigation.setDesktop(desktop);
    if (!desktop && toggleFocused) navigation.more.focus({ preventScroll: true });
    if (desktop) {
      window.scrollTo(0, 0);
      main.scrollTop = offset;
    } else {
      main.scrollTop = 0;
      window.scrollTo(0, main.getBoundingClientRect().top + window.scrollY + offset);
    }
    rememberScroll();
  }, options);
  update();
  return { shell, resetScroll() {
    if (media.matches) main.scrollTop = 0;
    else window.scrollTo(0, 0);
    contentOffset = 0;
  }, destroy() { dismiss(); events.abort(); } };
}

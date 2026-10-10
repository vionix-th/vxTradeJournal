import { el, button } from './components.js';
import { icon } from './icons.js';

/** Select-only combobox; a native popover keeps icon rows above the dialog's scroll area. */
export function donationNetworkSelector(id, networks, onChange) {
  let selected = 0;
  let active = 0;
  let search = '';
  let searchedAt = 0;
  const label = el('label', { id: `${id}-network-label`, for: `${id}-network` }, 'Network');
  const value = el('span', { id: `${id}-network-value`, class: 'donation-network-value' });
  const mark = el('span', { class: 'donation-network-icon', 'aria-hidden': 'true' });
  const menu = el('div', {
    id: `${id}-networks`, class: 'donation-network-menu', popover: 'auto',
    role: 'listbox', 'aria-labelledby': label.id,
  });
  const trigger = button([mark, value, icon('chevronDown', 16)], () => {
    if (menu.matches(':popover-open')) close();
    else open(selected);
  }, 'donation-network-trigger', {
    id: `${id}-network`, role: 'combobox', 'aria-haspopup': 'listbox',
    'aria-expanded': 'false', 'aria-controls': menu.id,
    'aria-labelledby': `${label.id} ${value.id}`,
  });
  const options = networks.map((network, index) => {
    const row = el('div', {
      id: `${id}-network-${network.id}`, role: 'option', 'aria-selected': index === selected,
      class: 'donation-network-option',
    }, icon(network.icon, 20), el('span', {}, network.name), icon('check', 16));
    row.addEventListener('pointerdown', (event) => { if (event.pointerType === 'mouse') event.preventDefault(); });
    row.addEventListener('click', () => choose(index));
    return row;
  });
  menu.append(...options);

  function position() {
    const bounds = trigger.getBoundingClientRect();
    const inset = 12;
    const gap = 6;
    const below = window.innerHeight - bounds.bottom - gap - inset;
    const above = bounds.top - gap - inset;
    const upward = below < 220 && above > below;
    const height = Math.max(0, Math.min(networks.length * 44 + 14, upward ? above : below));
    menu.style.width = `${Math.min(bounds.width, window.innerWidth - inset * 2)}px`;
    menu.style.maxHeight = `${height}px`;
    menu.style.left = `${Math.max(inset, Math.min(bounds.left, window.innerWidth - bounds.width - inset))}px`;
    menu.style.top = `${Math.max(inset, upward ? bounds.top - gap - height : bounds.bottom + gap)}px`;
  }
  function highlight(index) {
    active = Math.max(0, Math.min(networks.length - 1, index));
    options.forEach((row, index) => row.classList.toggle('is-active', index === active));
    trigger.setAttribute('aria-activedescendant', options[active].id);
    const row = options[active];
    if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight)
      menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight;
  }
  function open(index) {
    trigger.focus({ preventScroll: true });
    menu.showPopover();
    highlight(index);
  }
  function close() {
    if (menu.matches(':popover-open')) menu.hidePopover();
  }
  function renderSelection() {
    mark.replaceChildren(icon(networks[selected].icon, 20));
    value.textContent = networks[selected].name;
    options.forEach((row, index) => row.setAttribute('aria-selected', index === selected));
  }
  function choose(index, restoreFocus = true) {
    const changed = selected !== index;
    selected = index;
    renderSelection();
    close();
    if (restoreFocus) trigger.focus();
    if (changed) onChange(networks[selected]);
  }
  menu.addEventListener('beforetoggle', (event) => {
    const opened = event.newState === 'open';
    trigger.setAttribute('aria-expanded', opened);
    if (opened) {
      position();
      window.addEventListener('resize', position);
      window.addEventListener('scroll', position, true);
    } else {
      search = '';
      trigger.removeAttribute('aria-activedescendant');
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    }
  });
  trigger.addEventListener('keydown', (event) => {
    const opened = menu.matches(':popover-open');
    if (event.key === 'Tab') { if (opened) choose(active, false); return; }
    if (event.key === 'Escape') {
      if (opened) { event.preventDefault(); event.stopPropagation(); close(); }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Enter' || event.key === ' ') { if (opened) choose(active); else open(selected); }
      else if (event.key === 'Home') { if (!opened) open(0); else highlight(0); }
      else if (event.key === 'End') { if (!opened) open(networks.length - 1); else highlight(networks.length - 1); }
      else if (!opened) open(selected);
      else highlight(active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      search = (Date.now() - searchedAt < 700 ? search : '') + event.key.toLowerCase();
      searchedAt = Date.now();
      const match = networks.findIndex((network) => network.name.toLowerCase().startsWith(search));
      if (match >= 0) { if (opened) highlight(match); else open(match); }
    }
  });
  renderSelection();
  return {
    node: el('div', { class: 'field donation-network-field' }, label, trigger, menu),
    control: trigger,
    dispose() {
      close();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    },
  };
}

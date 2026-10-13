import { el } from './components.js';

export function journalTagCatalogue(trades) {
  return [...new Set(trades.flatMap((trade) => trade.tags).filter((tag) => tag !== ''))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0));
}
export function matchingTags(catalogue, query) {
  const needle = query.trim().toLowerCase();
  return catalogue.filter((tag) => tag.toLowerCase().includes(needle));
}

/** Editable combobox: virtual option focus never replaces the text input. */
export function tagAutocomplete(field, trades, onSelect) {
  const input = field.control;
  const catalogue = journalTagCatalogue(trades);
  const identifiers = new Map(catalogue.map((tag, index) => [tag, `${input.id}-tag-${index}`]));
  if (!input.placeholder) input.placeholder = "Type or choose a tag";
  const events = new AbortController();
  const options = { signal: events.signal };
  const list = el('div', { id: `${input.id}-tag-options`, role: 'listbox', 'aria-label': 'Tag suggestions' });
  const empty = el('p', { class: 'tag-suggestions-empty', role: 'status', hidden: true });
  const menu = el('div', { class: 'tag-suggestions', popover: 'auto' }, list, empty);
  field.node.append(menu);
  for (const [name, value] of Object.entries({ role: 'combobox', 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox', 'aria-controls': list.id, 'aria-expanded': 'false', autocomplete: 'off' })) input.setAttribute(name, value);
  let matches = [], active = -1, suppressOpen = false, disposed = false;
  const opened = () => menu.matches(':popover-open');
  function close() { if (opened()) menu.hidePopover(); }
  function position() {
    if (!opened()) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
    const anchor = input.getBoundingClientRect();
    if (anchor.bottom < top || anchor.top > top + height || anchor.right < left || anchor.left > left + width) { close(); return; }
    const inset = 8, gap = 6;
    const menuWidth = Math.max(0, Math.min(Math.max(240, anchor.width), width - inset * 2));
    const below = top + height - anchor.bottom - gap - inset;
    const above = anchor.top - top - gap - inset;
    const upward = below < 240 && above > below;
    menu.style.width = `${menuWidth}px`;
    menu.style.maxHeight = `${Math.max(0, Math.min(320, upward ? above : below))}px`;
    menu.style.left = `${Math.max(left + inset, Math.min(anchor.left, left + width - menuWidth - inset))}px`;
    const actualHeight = menu.getBoundingClientRect().height;
    menu.style.top = `${Math.max(top + inset, upward ? anchor.top - gap - actualHeight : anchor.bottom + gap)}px`;
  }
  function highlight(index) {
    active = Math.max(0, Math.min(matches.length - 1, index));
    const rows = [...list.children];
    rows.forEach((row, index) => { row.classList.toggle('is-active', index === active); row.setAttribute('aria-selected', String(index === active)); });
    const row = rows[active];
    if (!row) { input.removeAttribute('aria-activedescendant'); return; }
    input.setAttribute('aria-activedescendant', row.id);
    const bounds = row.getBoundingClientRect(), container = menu.getBoundingClientRect();
    if (bounds.top < container.top + 4) menu.scrollTop -= container.top + 4 - bounds.top;
    else if (bounds.bottom > container.bottom - 4) menu.scrollTop += bounds.bottom - container.bottom + 4;
  }
  function choose(index) {
    const tag = matches[index];
    if (tag === undefined) return;
    input.value = tag;
    suppressOpen = true;
    close(); input.focus({ preventScroll: true });
    suppressOpen = false;
    onSelect(tag);
  }
  function render() {
    matches = matchingTags(catalogue, input.value);
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren(...matches.map((tag, index) => el('div', {
      id: identifiers.get(tag), class: 'tag-suggestion', role: 'option',
      'data-match-index': index, 'aria-selected': String(tag === input.value),
    }, tag)));
    empty.hidden = matches.length > 0;
    empty.textContent = catalogue.length ? 'No matching tags' : 'No tags available';
    menu.scrollTop = 0;
  }
  function open() {
    if (disposed || suppressOpen || !input.isConnected) return;
    render();
    if (!opened()) menu.showPopover();
    position();
  }
  // Delegation avoids retaining discarded option rows through AbortSignal listeners.
  list.addEventListener('pointerdown', (event) => {
    if (event.button === 0 && event.target.closest('[role="option"]')) event.preventDefault();
  }, options);
  list.addEventListener('pointermove', (event) => {
    const row = event.target.closest('[role="option"]');
    if (row && event.pointerType === 'mouse') highlight(Number(row.dataset.matchIndex));
  }, options);
  list.addEventListener('click', (event) => {
    const row = event.target.closest('[role="option"]');
    if (row) choose(Number(row.dataset.matchIndex));
  }, options);
  menu.addEventListener('beforetoggle', (event) => {
    input.setAttribute('aria-expanded', String(event.newState === 'open'));
    if (event.newState === 'closed') { active = -1; input.removeAttribute('aria-activedescendant'); }
  }, options);
  input.addEventListener('focus', open, options);
  input.addEventListener('blur', close, options);
  input.addEventListener('click', () => { if (!opened()) open(); }, options);
  input.addEventListener('input', (event) => { if (!event.isComposing) open(); }, options);
  input.addEventListener('compositionend', open, options);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!opened()) open();
      if (matches.length) highlight(active < 0 ? event.key === 'ArrowDown' ? 0 : matches.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') {
      if (opened() && active >= 0) { event.preventDefault(); event.stopPropagation(); choose(active); }
      else close();
    } else if (event.key === 'Escape' && opened()) {
      event.preventDefault(); event.stopPropagation(); close();
    } else if (event.key === 'Tab') close();
  }, options);
  document.addEventListener('focusin', (event) => { if (event.target !== input && !menu.contains(event.target)) close(); }, options);
  document.addEventListener('change', (event) => { if (event.target !== input && !menu.contains(event.target)) close(); }, options);
  window.addEventListener('blur', close, options);
  window.addEventListener('resize', position, options);
  window.addEventListener('scroll', position, { ...options, capture: true });
  window.visualViewport?.addEventListener('resize', position, options);
  window.visualViewport?.addEventListener('scroll', position, options);
  const resize = new ResizeObserver(position); resize.observe(input);
  return { close, dispose() { disposed = true; close(); resize.disconnect(); events.abort(); } };
}

import { el } from './components.js';
const paths = {
  journal: ['M5 4h14v16H5z', 'M9 4v16', 'M12 8h4M12 12h4'],
  instruments: ['M6 3v18M18 3v18M3 8h6v7H3zM15 6h6v10h-6z'],
  strategies: ['m12 3 9 5-9 5-9-5 9-5Z', 'm3 12 9 5 9-5M3 16l9 5 9-5'],
  accounts: ['M4 5h14a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'M15 10h7v5h-7z'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'm9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h4l1-3 3-1v-3l2-2-2-3-3-1-1-3Z'],
  plus: ['M12 5v14M5 12h14'],
  arrow: ['M5 12h14m-6-6 6 6-6 6'],
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'm17 17 4 4'],
  lock: ['M6 10h12v11H6z', 'M8 10V7a4 4 0 0 1 8 0v3'],
  refresh: ['M20 7v5h-5', 'M20 12a8 8 0 1 0-2 5M4 12a8 8 0 0 1 14-5'],
  logout: ['M9 4H4v16h5M9 12h12m-4-4 4 4-4 4'],
  activity: ['M3 12h4l3-7 4 14 3-7h4'],
  check: ['m5 12 4 4L19 6'],
};
export function icon(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({viewBox:'0 0 24 24', width:size, height:size, fill:'none', stroke:'currentColor', 'stroke-width':1.7, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'aria-hidden':'true', focusable:'false'})) svg.setAttribute(key, value);
  for (const d of paths[name] || paths.journal) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
export function brand() {
  return el('div', {class:'brand'}, el('span', {class:'brand-mark'}, icon('activity', 23)), el('div', {}, el('strong', {}, 'vxTradeJournal'), el('span', {class:'brand-caption'}, 'Your trading workspace')));
}
export function authFrame(card) {
  return el('main', {class:'auth-shell auth-layout'},
    el('aside', {class:'auth-story'}, brand(), el('div', {class:'auth-intro'}, el('span', {class:'eyebrow'}, 'A record behind every decision'), el('h2', {}, 'Trade with intention.\nReview with clarity.'), el('p', {}, 'One private workspace for your instruments, executions and trading decisions.'), el('div', {class:'auth-features'}, ...[['journal','Every execution, in context'],['accounts','Precise results, by account'],['lock','A journal that stays yours']].map(([name,text])=>el('div', {}, icon(name), text)))), el('p', {class:'auth-story-footer'}, 'vxTradeJournal · A clearer trading record')),
    el('div', {class:'auth-form-area'}, card, el('p', {class:'auth-footnote'}, 'Your process. Your record. Your perspective.')));
}

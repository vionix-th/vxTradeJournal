const paths = {
  cash: ['M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'M6 12h.01M18 12h.01'],
  crypto: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'm12 7 4 5-4 5-4-5 4-5Z'],
  journal: ['M5 4h14v16H5z', 'M9 4v16', 'M12 8h4M12 12h4'],
  instruments: ['M6 3v18M18 3v18M3 8h6v7H3zM15 6h6v10h-6z'],
  strategies: ['m12 3 9 5-9 5-9-5 9-5Z', 'm3 12 9 5 9-5M3 16l9 5 9-5'],
  accounts: ['M4 5h14a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'M15 10h7v5h-7z'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'm9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h4l1-3 3-1v-3l2-2-2-3-3-1-1-3Z'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  plus: ['M12 5v14M5 12h14'],
  arrow: ['M5 12h14m-6-6 6 6-6 6'],
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'm17 17 4 4'],
  lock: ['M6 10h12v11H6z', 'M8 10V7a4 4 0 0 1 8 0v3'],
  refresh: ['M20 7v5h-5', 'M20 12a8 8 0 1 0-2 5M4 12a8 8 0 0 1 14-5'],
  logout: ['M9 4H4v16h5M9 12h12m-4-4 4 4-4 4'],
  activity: ['M3 12h4l3-7 4 14 3-7h4'],
  check: ['m5 12 4 4L19 6'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v6M12 7h.01'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
  copy: ['M9 9h12v12H9z', 'M15 9V3H3v12h6'],
  bitcoin: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M8 7h6a2.5 2.5 0 0 1 0 5H9h6a2.5 2.5 0 0 1 0 5H8M10 7v10M11 5v2m3-2v2M11 17v2m3-2v2'],
  ethereum: ['m12 2 7 10-7 4-7-4 7-10Z', 'm5 15 7 7 7-7-7 4-7-4Z', 'M12 2v14'],
  solana: ['m6 4-3 4h15l3-4H6Z', 'm3 10 3 4h15l-3-4H3Z', 'm6 16-3 4h15l3-4H6Z'],
  zcash: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M8 7h8L8 17h8M12 5v2m0 10v2'],
  monero: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M5 16V9l7 7 7-7v7M5 16h4m6 0h4'],
  tron: ['M4 3l17 5-8 13L4 3Z M4 3l10 7 7-2M14 10l-1 11'],
  dogecoin: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M9 7h3a5 5 0 0 1 0 10H9V7Z M7 12h7'],
  chevronDown: ['m6 9 6 6 6-6'],
  base: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M3 12h14'],
  arbitrum: ['m12 2 9 5v10l-9 5-9-5V7l9-5Z', 'm8 17 4-10 5 10M14 11l4 8'],
  optimism: ['M7 7a4 5 0 1 0 0 10 4 5 0 0 0 0-10Z', 'M15 17V7h3a3 3 0 0 1 0 6h-3'],
  polygon: ['m9 5 4 2.5v5L9 15l-4-2.5v-5L9 5Z', 'm15 9 4 2.5v5L15 19l-4-2.5v-5L15 9Z'],
  bnb: ['m12 8 4 4-4 4-4-4 4-4Z', 'm12 2 3 3-3 3-3-3 3-3ZM12 16l3 3-3 3-3-3 3-3ZM2 12l3-3 3 3-3 3-3-3ZM16 12l3-3 3 3-3 3-3-3Z'],
  github: ['M9 19c-4.5 1.4-4.5-2.3-6.3-2.8M15 22v-3.8a3.3 3.3 0 0 0-.9-2.5c3-.3 6.1-1.5 6.1-6.9A5.4 5.4 0 0 0 18.7 5a5 5 0 0 0-.1-3.7S17.4.9 15 2.6a13 13 0 0 0-6 0C6.6.9 5.4 1.3 5.4 1.3A5 5 0 0 0 5.3 5a5.4 5.4 0 0 0-1.5 3.8c0 5.4 3.1 6.6 6.1 6.9A3.3 3.3 0 0 0 9 18.2V22'],
  message: ['M21 11a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l2.4-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z'],
  mail: ['M3 5h18v14H3z', 'm3 5 9 7 9-7'],
  external: ['M15 3h6v6M21 3l-9 9', 'M10 3H3v18h18v-7'],
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

import qrcode from 'qrcode-generator';

/** Address-only QR; the donor must select the displayed network in their wallet. */
export function addressQRCode(address, label) {
  const qr = qrcode(0, 'M');
  qr.addData(address, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const quietZone = 4;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: `0 0 ${count + quietZone * 2} ${count + quietZone * 2}`,
    role: 'img', 'aria-label': label, class: 'donation-qr',
    'shape-rendering': 'crispEdges',
  })) svg.setAttribute(key, value);
  const background = document.createElementNS(svg.namespaceURI, 'rect');
  for (const [key, value] of Object.entries({ width: '100%', height: '100%', fill: '#fff' })) background.setAttribute(key, value);
  const modules = document.createElementNS(svg.namespaceURI, 'path');
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      if (qr.isDark(row, column)) path += `M${column + quietZone} ${row + quietZone}h1v1h-1z`;
    }
  }
  modules.setAttribute('d', path);
  modules.setAttribute('fill', '#111');
  svg.append(background, modules);
  return svg;
}

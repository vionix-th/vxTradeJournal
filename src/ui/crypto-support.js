import { el, button } from './components.js';
import { icon } from './icons.js';
import { donationNetworks, donationWalletUri } from './donation-config.js';
import { donationNetworkSelector } from './donation-network-selector.js';
import { addressQRCode } from './donation-qr.js';

export function cryptoSupport(id) {
  let destination = donationNetworks[0];
  let revision = 0;
  let disposed = false;
  let feedbackTimer;
  const feedback = el('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  function setCopyFeedback(message) {
    feedback.textContent = message;
  }
  function resetCopyFeedback() {
    clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
    copyLabel.textContent = 'Copy address';
    setCopyFeedback('');
  }
  const address = el('a', { id: `${id}-address`, class: 'donation-address', tabindex: '0' });
  const assets = el('p', { class: 'donation-assets' });
  const network = donationNetworkSelector(id, donationNetworks, (selected) => {
    destination = selected;
    updateDestination();
  });
  network.node.append(assets);
  const qrHost = el('div', { id: `${id}-qr`, class: 'donation-qr-host' });
  const qrToggle = button('Show QR code', () => {
    const expanded = qrToggle.getAttribute('aria-expanded') !== 'true';
    node.classList.toggle('qr-expanded', expanded);
    qrToggle.setAttribute('aria-expanded', expanded);
    qrToggle.textContent = expanded ? 'Hide QR code' : 'Show QR code';
  }, 'button quiet donation-qr-toggle', { 'aria-expanded': 'false', 'aria-controls': qrHost.id });
  const copyLabel = el('span', {}, 'Copy address');
  const copy = button([icon('copy', 16), copyLabel], async () => {
    const copyingRevision = revision;
    const copiedAddress = destination.address;
    resetCopyFeedback();
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(copiedAddress);
      if (!disposed && copyingRevision === revision) {
        copyLabel.textContent = 'Copied';
        setCopyFeedback('Address copied.');
        feedbackTimer = setTimeout(resetCopyFeedback, 2000);
      }
    } catch {
      if (!disposed && copyingRevision === revision) {
        copyLabel.textContent = 'Copy manually';
        setCopyFeedback('Could not copy. Select the address and copy it manually.');
        const range = document.createRange();
        range.selectNodeContents(address);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        address.focus();
      }
    } finally {
      if (!disposed && copyingRevision === revision) copy.disabled = false;
    }
  }, 'button donation-copy', { 'aria-describedby': address.id });

  function updateDestination() {
    revision++;
    copy.disabled = false;
    resetCopyFeedback();
    address.textContent = destination.address;
    address.href = donationWalletUri(destination);
    assets.textContent = destination.assets;
    qrHost.replaceChildren(addressQRCode(destination.address, `${destination.name} receiving address QR code`));
  }
  const node = el('div', { class: 'crypto-support' }, network.node,
    qrToggle, qrHost,
    el('div', { class: 'donation-receiving' },
      el('div', { class: 'donation-address-details' },
        el('span', { class: 'donation-address-label' }, 'Receiving address'), address),
      copy, feedback));
  updateDestination();
  return { node, dispose() { disposed = true; clearTimeout(feedbackTimer); network.dispose(); } };
}

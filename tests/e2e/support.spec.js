import { test, expect } from '@playwright/test';
import { setup } from './fixtures.js';
import jsQR from 'jsqr';

const addresses = {
  Bitcoin: 'bc1qesd92qv7h3mlh4qqs4grz3e32phvxj6spwkcyz',
  Ethereum: '0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2',
  Solana: '7oLWWpSrEG6aDKVZDAyuAjF3kDKEgAmnG3Q7JAb9uUXy',
};

const walletUris = [
  'bitcoin:bc1qesd92qv7h3mlh4qqs4grz3e32phvxj6spwkcyz',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@1',
  'solana:7oLWWpSrEG6aDKVZDAyuAjF3kDKEgAmnG3Q7JAb9uUXy',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@8453',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@42161',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@10',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@137',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@56',
];

async function openCrypto(page) {
  await page.getByRole('button', { name: 'Support this project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Support vxTradeJournal' });
  await dialog.getByRole('tab', { name: 'Crypto', exact: true }).click();
  return dialog;
}

async function selectNetwork(dialog, name) {
  await dialog.getByRole('combobox').click();
  await dialog.getByRole('option', { name, exact: true }).click();
  await expect(dialog.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
}

async function decodeQR(qr) {
  const screenshot = await qr.screenshot();
  const { pixels, size } = await qr.evaluate(async (_svg, png) => {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = `data:image/png;base64,${png}`;
    await loaded;
    const size = image.width;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, size, size);
    return { pixels: Array.from(context.getImageData(0, 0, size, size).data), size };
  }, screenshot.toString('base64'));
  return jsQR(new Uint8ClampedArray(pixels), size, size)?.data;
}

async function mockPanel(page) {
  const calls = [];
  await page.route('https://ko-fi.com/**', async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<button>One-time</button><button>Monthly</button>' });
  });
  return calls;
}

async function checkSupport(page, area, width) {
  await page.setViewportSize({ width, height: 900 });
  const url = page.url();
  const trigger = area.getByRole('button', { name: 'Support this project', exact: true }).first();
  const more = area.getByRole('button', { name: 'More', exact: true, includeHidden: true });
  const compact = width <= 700 && await more.count() > 0;
  if (await more.count()) {
    if (compact) await expect(more).toBeVisible();
    else await expect(more).toBeHidden();
  }
  if (compact) await more.click();
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Support vxTradeJournal' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await expect(dialog.locator('iframe')).toHaveAttribute('src', 'https://ko-fi.com/vionixconsulting/?hidefeed=true&widget=true&embed=true&preview=true');
  await expect(dialog.locator('iframe')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(dialog.getByRole('link', { name: 'Open Ko-fi in new tab' })).toBeHidden();
  await expect(dialog).not.toContainText('Optional one-time');
  const panelBounds = await dialog.locator('iframe').boundingBox();
  const panel = await dialog.locator('.support-panel').boundingBox();
  const left = panelBounds.x - panel.x;
  const right = panel.x + panel.width - panelBounds.x - panelBounds.width;
  const top = panelBounds.y - panel.y;
  const bottom = panel.y + panel.height - panelBounds.y - panelBounds.height;
  expect(left).toBeGreaterThanOrEqual(12);
  expect(top).toBeGreaterThanOrEqual(12);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
  expect(Math.abs(top - bottom)).toBeLessThanOrEqual(2);
  expect(panelBounds.height).toBeLessThanOrEqual(600);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/vionix-support-trade-${width}.png` });
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(compact ? more : trigger).toBeFocused();
  expect(page.url()).toBe(url);
  if (compact) await more.click();
  await trigger.click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
}

test('support preserves sign-in input', async ({ page }) => {
  const calls = await mockPanel(page);
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('support-smoke@example.test');
  expect(calls).toHaveLength(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  for (const width of [320, 390, 768, 949, 1440]) {
    await checkSupport(page, page.locator('.auth-shell'), width);
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('support-smoke@example.test');
  }
});

test('icon selector lists all networks and QR codes decode to supplied addresses', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const calls = await mockPanel(page);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  const dialog = await openCrypto(page);
  await expect(dialog.getByRole('tabpanel', { name: 'Cash', exact: true })).toBeHidden();
  await expect(dialog.getByRole('tab')).toHaveText(['Cash', 'Crypto']);
  expect(await dialog.getByRole('tab').evaluateAll((tabs) => tabs.every((tab) => tab.querySelector('svg')?.getAttribute('aria-hidden') === 'true'))).toBe(true);
  const network = dialog.getByRole('combobox');
  const networks = [
    ['Bitcoin', 'BTC', addresses.Bitcoin],
    ['Ethereum Mainnet', 'ETH, USDC, USDT and other tokens', addresses.Ethereum],
    ['Solana', 'SOL, USDC, USDT and other tokens', addresses.Solana],
    ['Base', 'ETH, USDC, USDT and other tokens', addresses.Ethereum],
    ['Arbitrum One', 'ETH, USDC, USDT and other tokens', addresses.Ethereum],
    ['Optimism', 'ETH, USDC, USDT and other tokens', addresses.Ethereum],
    ['Polygon PoS', 'POL, USDC, USDT and other tokens', addresses.Ethereum],
    ['BNB Smart Chain', 'BNB, USDC, USDT and other tokens', addresses.Ethereum],
  ];
  await network.click();
  const options = dialog.getByRole('option');
  await expect(options).toHaveText(networks.map(([name]) => name));
  expect(await options.evaluateAll((rows) => rows.every((row) => row.querySelector('svg')?.getAttribute('aria-hidden') === 'true'))).toBe(true);
  expect(await options.evaluateAll((rows) => rows.every((row) => getComputedStyle(row).borderTopWidth === '0px'))).toBe(true);
  await dialog.getByRole('heading').click();
  await expect(network).toHaveAttribute('aria-expanded', 'false');
  await expect(network).toContainText('Bitcoin');
  const initial = await dialog.boundingBox();
  for (const [index, [name, assets, address]] of networks.entries()) {
    await selectNetwork(dialog, name);
    await expect(network).toContainText(name);
    await expect(dialog.locator('.donation-network-icon svg')).toHaveCount(1);
    await expect(dialog.getByRole('option', { name, exact: true, includeHidden: true })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.locator('.donation-assets')).toHaveText(assets);
    const walletLink = dialog.getByRole('link', { name: address, exact: true });
    await expect(walletLink).toHaveText(address);
    await expect(walletLink).toHaveAttribute('href', walletUris[index]);
    // Observe native link activation without launching an external wallet in automation.
    await walletLink.evaluate((node) => node.addEventListener('click', (event) => {
      event.preventDefault();
      node.setAttribute('data-activated-uri', node.getAttribute('href'));
    }, { once: true }));
    await walletLink.focus();
    await page.keyboard.press('Enter');
    await expect(walletLink).toHaveAttribute('data-activated-uri', walletUris[index]);
    expect(await decodeQR(dialog.getByRole('img', { name: `${name} receiving address QR code` }))).toBe(address);
    expect(await dialog.boundingBox()).toEqual(initial);
  }
  await expect(dialog.locator('.donation-instruction')).toHaveCount(0);
  await dialog.getByRole('tab', { name: 'Cash', exact: true }).click();
  await expect(dialog.locator('iframe')).toBeVisible();
  await dialog.getByRole('tab', { name: 'Crypto', exact: true }).click();
  await expect(network).toContainText('BNB Smart Chain');
  expect(calls).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Support this project', exact: true }).click();
  await expect(dialog.getByRole('tab', { name: 'Cash', exact: true })).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('tab', { name: 'Crypto', exact: true }).click();
  await expect(dialog.getByRole('combobox')).toContainText('Bitcoin');
  expect(pageErrors).toEqual([]);
});

test('copy confirms clipboard success for two seconds without resizing and offers manual recovery', async ({ page, context }) => {
  await mockPanel(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.clock.install();
  const dialog = await openCrypto(page);
  const initial = await dialog.boundingBox();
  await dialog.getByRole('button', { name: 'Copy address', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Address copied.');
  await expect(dialog.getByRole('button', { name: 'Copied', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(addresses.Bitcoin);
  expect(await dialog.boundingBox()).toEqual(initial);
  await page.clock.fastForward(2100);
  await expect(dialog.getByRole('button', { name: 'Copy address', exact: true })).toBeVisible();
  await expect(dialog.getByRole('status')).toBeEmpty();
  expect(await dialog.boundingBox()).toEqual(initial);

  await dialog.getByRole('button', { name: 'Copy address', exact: true }).click();
  await page.clock.fastForward(1000);
  await selectNetwork(dialog, 'Ethereum Mainnet');
  await expect(dialog.getByRole('status')).toBeEmpty();
  await dialog.getByRole('button', { name: 'Copy address', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(addresses.Ethereum);
  await page.clock.fastForward(1100);
  await expect(dialog.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  await page.clock.fastForward(1100);
  await expect(dialog.getByRole('button', { name: 'Copy address', exact: true })).toBeVisible();

  await selectNetwork(dialog, 'Base');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new DOMException('Clipboard denied', 'NotAllowedError'); } });
  });
  await dialog.getByRole('button', { name: 'Copy address', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Could not copy. Select the address and copy it manually.');
  await expect(dialog.locator('.donation-address')).toBeFocused();
  expect(await page.evaluate(() => window.getSelection().toString())).toBe(addresses.Ethereum);
  await expect(dialog.getByRole('button', { name: 'Copy manually', exact: true })).toBeEnabled();
  expect(await dialog.boundingBox()).toEqual(initial);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.clock.fastForward(3000);
  await expect(dialog).toHaveCount(0);
});

test('pending clipboard completion cannot report success for a different destination', async ({ page }) => {
  await mockPanel(page);
  await page.goto('/');
  const dialog = await openCrypto(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => new Promise((resolve) => { window.finishDonationCopy = resolve; }) });
  });
  await dialog.getByRole('button', { name: 'Copy address', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Copy address', exact: true })).toBeDisabled();
  await selectNetwork(dialog, 'Solana');
  await page.evaluate(() => window.finishDonationCopy());
  await expect(dialog.getByRole('status')).toBeEmpty();
  await expect(dialog.getByRole('button', { name: 'Copy address', exact: true })).toBeEnabled();
});

test('a delayed Ko-fi load does not disable crypto copy feedback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('https://ko-fi.com/**', async (route) => {
    await held;
    await route.fulfill({ contentType: 'text/html', body: '<p>Payment fixture</p>' }).catch(() => {});
  });
  try {
    await page.goto('/');
    const dialog = await openCrypto(page);
    release();
    await expect(dialog.frameLocator('iframe').getByText('Payment fixture')).toHaveText('Payment fixture');
    await dialog.getByRole('button', { name: 'Copy address', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Address copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(addresses.Bitcoin);
  } finally { release(); }
});

test('crypto keyboard selection preserves draft and restores opener focus', async ({ page, request }) => {
  await mockPanel(page);
  await setup(page, request);
  await page.getByRole('button', { name: 'New trade', exact: true }).click();
  await page.getByLabel('Entry rationale', { exact: true }).fill('Crypto support must preserve this draft.');
  const url = page.url();
  const trigger = page.locator('.sidebar').getByRole('button', { name: 'Support this project', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Support vxTradeJournal' });
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('tab', { name: 'Cash', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('tab', { name: 'Crypto', exact: true })).toBeFocused();
  await expect(dialog.getByRole('tab', { name: 'Crypto', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(dialog.getByRole('tab', { name: 'Cash', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  const network = dialog.getByRole('combobox');
  await expect(network).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(network).toContainText('Ethereum Mainnet');
  await expect(network).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(network).toHaveAttribute('aria-expanded', 'false');
  await expect(network).toContainText('Ethereum Mainnet');
  await page.keyboard.type('sol');
  await page.keyboard.press('Enter');
  await expect(network).toContainText('Solana');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(network).toContainText('Bitcoin');
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  await expect(network).toContainText('BNB Smart Chain');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByLabel('Entry rationale', { exact: true })).toHaveValue('Crypto support must preserve this draft.');
  expect(page.url()).toBe(url);
});

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }, { width: 1440, height: 600 }]) {
  for (const theme of ['light', 'dark']) {
    test(`crypto layout at ${viewport.width}x${viewport.height} in ${theme} theme`, async ({ page }) => {
      await mockPanel(page);
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
      const dialog = await openCrypto(page);
      await selectNetwork(dialog, 'Ethereum Mainnet');
      const toggle = dialog.getByRole('button', { name: 'Show QR code', exact: true });
      const compact = viewport.width <= 420 || viewport.height <= 720;
      if (compact) {
        await expect(dialog.locator('.donation-qr')).toBeHidden();
        await expect(toggle).toBeVisible();
      } else {
        await expect(toggle).toBeHidden();
        await expect(dialog.locator('.donation-qr')).toBeVisible();
      }
      const layout = await dialog.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const body = node.querySelector('.support-body');
        const actions = [...node.querySelectorAll('.support-method, .donation-network-trigger, .donation-copy, .donation-qr-toggle')];
        return {
          inside: bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
          overflow: body.scrollWidth > body.clientWidth || document.documentElement.scrollWidth > innerWidth,
          targets: actions.filter((action) => action.getClientRects().length).map((action) => action.getBoundingClientRect().height),
        };
      });
      expect(layout.inside).toBe(true);
      expect(layout.overflow).toBe(false);
      expect(layout.targets.every((height) => height >= 44)).toBe(true);
      await expect(dialog.locator('.donation-address')).toHaveText(addresses.Ethereum);
      const baseline = await dialog.boundingBox();
      for (const name of ['Bitcoin', 'Solana', 'BNB Smart Chain', 'Ethereum Mainnet']) {
        await selectNetwork(dialog, name);
        expect(await dialog.boundingBox()).toEqual(baseline);
      }
      await dialog.getByRole('combobox').click();
      const menuBounds = await dialog.getByRole('listbox').boundingBox();
      expect(menuBounds.x).toBeGreaterThanOrEqual(0);
      expect(menuBounds.y).toBeGreaterThanOrEqual(0);
      expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(viewport.width);
      expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press('Escape');

      if (!compact) expect(await decodeQR(dialog.locator('.donation-qr'))).toBe(addresses.Ethereum);
      await page.screenshot({ path: `/tmp/vxj-crypto-${viewport.width}x${viewport.height}-${theme}.png` });
      await dialog.screenshot({ path: `/tmp/vxj-crypto-dialog-${viewport.width}x${viewport.height}-${theme}.png` });
      if (compact) {
        await toggle.click();
        await expect(dialog.locator('.donation-qr')).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Hide QR code', exact: true })).toHaveAttribute('aria-expanded', 'true');
        await dialog.getByRole('button', { name: 'Hide QR code', exact: true }).click();
        await expect(dialog.locator('.donation-qr')).toBeHidden();
      }
    });
  }
}

test('support preserves an unsaved trade in light and dark themes', async ({ page, request }) => {
  const calls = await mockPanel(page);
  await setup(page, request);
  await page.getByRole('button', { name: 'New trade', exact: true }).click();
  await page.getByLabel('Entry rationale', { exact: true }).fill('Support must preserve this unsaved rationale.');
  expect(calls).toHaveLength(0);
  for (const width of [320, 390, 768, 949, 1440]) {
    await page.evaluate((theme) => document.documentElement.dataset.theme = theme, width === 768 ? 'dark' : 'light');
    await checkSupport(page, page.locator('.sidebar'), width);
    await expect(page.getByLabel('Entry rationale', { exact: true })).toHaveValue('Support must preserve this unsaved rationale.');
  }
});

test('About support action and delayed loading keep an external fallback', async ({ page }) => {
  await page.clock.install();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('https://ko-fi.com/**', async (route) => {
    await held;
    await route.fulfill({ contentType: 'text/html', body: '<p>Payment fixture</p>' }).catch(() => {});
  });
  try {
    await page.goto('/');
    const aboutTrigger = page.getByRole('button', { name: 'About vxTradeJournal', exact: true });
    await aboutTrigger.click();
    const about = page.getByRole('dialog', { name: 'About vxTradeJournal' });
    const trigger = about.getByRole('button', { name: 'Support this project', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Support vxTradeJournal' });
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(dialog.getByRole('status')).toHaveText('Loading Ko-fi…');
    await page.clock.fastForward(10_000);
    await expect(dialog.getByRole('status')).toContainText('Taking longer than expected');
    await expect(dialog.getByRole('link', { name: 'Open Ko-fi in new tab' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(aboutTrigger).toBeFocused();
    await expect(page.locator('iframe')).toHaveCount(0);
  } finally { release(); }
});

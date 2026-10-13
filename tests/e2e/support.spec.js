import { test, expect, setup } from './fixtures.js';
import jsQR from 'jsqr';

export const addresses = {
  Bitcoin: 'bc1qesd92qv7h3mlh4qqs4grz3e32phvxj6spwkcyz',
  Ethereum: '0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2',
  Solana: '7oLWWpSrEG6aDKVZDAyuAjF3kDKEgAmnG3Q7JAb9uUXy',
  Zcash: 't1ffcdEs6WUZsK4iTpSg3fYM3STmZ8rfXjy',
  ZcashShielded: 'u1093sjwd5aleadm0j8jfzu0l7krkmv82yjrpk5j86j0vrkmy3eppkcv6e930qukvdy4p6nc8u0ttlwh6qu5gce84wht06xpzjzcqdwev0',
  TRON: 'TLq3NiF3QkwzcFwhZhvVDUSQ3shzbDf6fQ',
  Dogecoin: 'DLYUL5TuJPvQq71xFxdm337Ti5sZyP5BKk',
  Monero: '47XCwRMTyEvav4QMqeh8ChaLg4Ubt7ASSWvyW9BG8vB19wXUS4E7C1qWkFnyzFFoTcf8AAmrUDG11EE2B6GFgFAWArkriQd',
};

export const walletUris = [
  'bitcoin:bc1qesd92qv7h3mlh4qqs4grz3e32phvxj6spwkcyz',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@1',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@42161',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@8453',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@56',
  'dogecoin:DLYUL5TuJPvQq71xFxdm337Ti5sZyP5BKk',
  'monero:47XCwRMTyEvav4QMqeh8ChaLg4Ubt7ASSWvyW9BG8vB19wXUS4E7C1qWkFnyzFFoTcf8AAmrUDG11EE2B6GFgFAWArkriQd',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@10',
  'ethereum:0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2@137',
  'solana:7oLWWpSrEG6aDKVZDAyuAjF3kDKEgAmnG3Q7JAb9uUXy',
  'trust://send?asset=c195&address=TLq3NiF3QkwzcFwhZhvVDUSQ3shzbDf6fQ',
  'zcash:u1093sjwd5aleadm0j8jfzu0l7krkmv82yjrpk5j86j0vrkmy3eppkcv6e930qukvdy4p6nc8u0ttlwh6qu5gce84wht06xpzjzcqdwev0',
  'zcash:t1ffcdEs6WUZsK4iTpSg3fYM3STmZ8rfXjy',
];

export async function openCrypto(page) {
  await page.getByRole('button', { name: 'Support this project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Support vxTradeJournal' });
  await dialog.getByRole('tab', { name: 'Crypto', exact: true }).click();
  return dialog;
}

export async function selectNetwork(dialog, name) {
  await dialog.getByRole('combobox').click();
  await dialog.getByRole('option', { name, exact: true }).click();
  await expect(dialog.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
}

export async function decodeQR(qr) {
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

export async function mockPanel(page) {
  const calls = [];
  await page.route('https://ko-fi.com/**', async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<button>One-time</button><button>Monthly</button>' });
  });
  return calls;
}

export async function checkSupport(page, area, width) {
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
  await page.screenshot({ path: test.info().outputPath(`/tmp/vionix-support-trade-${width}.png`.split("/").pop()) });
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
  await expect(network).toContainText('Zcash Transparent');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByLabel('Entry rationale', { exact: true })).toHaveValue('Crypto support must preserve this draft.');
  expect(page.url()).toBe(url);
});



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

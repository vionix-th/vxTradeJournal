import { test, expect, setup } from './fixtures.js';

for (const width of [320, 838, 1440]) test(`active and archived account controls wrap at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 924 }); await setup(page);
  await page.evaluate(() => {
    const ui = window.fixtureUI;
    ui.data.accounts.push({ ...ui.data.accounts[0], id: 'archived', archived: true, name: 'Archived account with a long descriptive name' });
    ui.go('accounts');
  });
  await expect(page.getByRole('tab', { name: 'Active (1)', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Archived account with a long descriptive name', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Active (1)', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Archived (1)', exact: true })).toBeFocused();
  await expect(page.getByText('Complete realized net', { exact: true })).toHaveCount(0);
  for (const name of ['Restore account', 'Delete account']) {
    const control = page.getByRole('button', { name, exact: true });
    await expect(control).toBeVisible(); expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('accounts.png'), fullPage: true });
});

import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend({
  page: async ({ page }, use) => {
    const emulatorRequests = [];
    await page.route(/http:\/\/127\.0\.0\.1:(8280|9299)\//, (route) => { emulatorRequests.push(route.request().url()); return route.abort(); });
    await page.route('**/tests/browser/harness.html', (route) => route.continue());
    // Redirect old root navigation while keeping every production asset/module real.
    await page.route('http://127.0.0.1:5175/', (route) => route.fulfill({ status: 302, headers: { location: '/tests/browser/harness.html' } }));
    await use(page);
    expect(emulatorRequests, 'Isolated browser contracts must not contact emulators').toEqual([]);
  },
});
export async function setup(page) {
  await page.goto('/tests/browser/harness.html');
  await page.waitForFunction(() => !!window.harness);
  await page.evaluate(() => window.harness.mountWorkspace());
}
export async function publicFixture(page) {
  await page.goto('/tests/browser/harness.html');
  await page.waitForFunction(() => !!window.harness);
  await page.evaluate(() => window.harness.mountPublic());
}

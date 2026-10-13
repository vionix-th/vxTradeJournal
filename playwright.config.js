import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 4,
  projects: [
    { name: 'browser', testMatch: '**/browser/*.spec.js' },
    { name: 'journal', testMatch: '**/e2e/*.spec.js', testIgnore: '**/database-availability.spec.js', workers: 1, fullyParallel: false },
    { name: 'database', testMatch: '**/e2e/database-availability.spec.js', workers: 1, fullyParallel: false },
  ],
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  outputDir: `test-results/${process.env.VXJ_BROWSER_PHASE || 'browser'}`,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5175', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'VXJ_PROFILE=auto vite --host 127.0.0.1',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 90000,
  },
});

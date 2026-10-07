import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  projects: [
    { name: 'journal', testIgnore: '**/database-availability.spec.js' },
    { name: 'database', testMatch: '**/database-availability.spec.js', dependencies: ['journal'], fullyParallel: false },
  ],
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5175', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'VXJ_PROFILE=auto vite --host 127.0.0.1',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 90000,
  },
});

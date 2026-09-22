import { defineConfig, devices } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT ?? '3000';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  timeout: 90000, expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
  webServer: process.env.SAFETY_E2E_EXTERNAL_SERVER === '1' ? undefined : { command: `npm.cmd run start -- --port ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 180000 },
});

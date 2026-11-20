/* Browser tests for the web app (npm run e2e). Two builds: "full" (paywall off) and "free" (no subscription, paywall on),
   each tested at phone (390 px) and desktop (1280 px) size. */
import { defineConfig, devices } from '@playwright/test';

const phone = { viewport: { width: 390, height: 844 } };
const wide = { viewport: { width: 1280, height: 900 } };
const full = 'http://localhost:4310', free = 'http://localhost:4311';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'only-on-failure' },
  projects: [
    { name: 'full-phone', testMatch: /full|new-user|appearance/, use: { ...phone, baseURL: full } },
    { name: 'full-wide', testMatch: /full|new-user|appearance/, use: { ...wide, baseURL: full } },
    { name: 'free-phone', testMatch: /free/, use: { ...phone, baseURL: free } },
    { name: 'free-wide', testMatch: /free/, use: { ...wide, baseURL: free } },
  ],
  // One command builds both versions in turn, then serves them; the "free" port answers last.
  webServer: { command: 'node scripts/e2e-serve.mjs', url: free, timeout: 900_000, reuseExistingServer: !process.env.CI },
});

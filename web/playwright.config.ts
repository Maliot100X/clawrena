import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,     // arena runs share server state
  workers: 1,
  retries: 0,               // a retry would hide real flake
  reporter: [['list']],
  // Playwright owns a FRESH production server. Prevents the dev/prod chunk
  // collision that produced bogus 400s on static assets.
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3200',
    reuseExistingServer: false,
    timeout: 300_000,
  },
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://localhost:3200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});

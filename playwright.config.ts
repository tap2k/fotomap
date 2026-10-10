import { defineConfig } from '@playwright/test';

// A fresh database per run; the test reads the same env var to sign in.
process.env.E2E_DB ??= `file:.data/e2e-${Date.now()}.db`;
const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: `npx next start -p ${PORT}`, // migrations run on startup (instrumentation.ts)
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: process.env.E2E_DB, APP_URL: `http://localhost:${PORT}`, SECRET: 'e2e-secret' },
  },
});

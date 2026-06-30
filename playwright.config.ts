import { defineConfig } from '@playwright/test';

/**
 * SoulSanctuary — Playwright Electron Smoke Test Configuration
 *
 * Usage:
 *   npx playwright test tests/smoke.spec.ts --project=electron
 *   npx playwright test tests/smoke.spec.ts --project=electron --headed
 */

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 8000 },

  // Suppress worker teardown warnings from Electron process cleanup
  workers: 1,
  globalTeardown: undefined,

  // Screenshots on failure
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'electron',
      use: {
        // Electron-specific settings are handled in the test file
        // via electron.launch()
      },
    },
  ],

  // Output directories
  outputDir: 'tests/test-results',
});

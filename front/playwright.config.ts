import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: process.env.E2E_ALIAS_REGISTRY === '1' ? '**/registry.spec.ts' : '**/*.spec.ts', testIgnore: process.env.E2E_ALIAS_REGISTRY === '1' ? [] : ['**/registry.spec.ts'], fullyParallel: false, workers: 1,
  timeout: 60_000, expect: { timeout: 15_000 },
  use: { baseURL: process.env.E2E_BASE_URL, browserName: 'chromium', trace: 'retain-on-failure', serviceWorkers: 'block' },
  reporter: [['list'], ['html', { open: 'never' }]],
});

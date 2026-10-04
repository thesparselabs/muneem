import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './flows',
  outputDir: '../test-results/playwright',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: '../test-results/ui-report' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 10_000 },
});

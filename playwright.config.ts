import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Electron tests must run serially
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    trace: 'on-first-retry',
  },
  // TODO(phase-8): configure Electron launch via playwright-electron
  projects: [
    {
      name: 'electron',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

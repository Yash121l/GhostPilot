/**
 * Electron test fixture.
 * Launches the built app (out/main/index.js) and exposes the main window page.
 *
 * Usage:
 *   import { test, expect } from './fixtures/electron'
 *   test('my test', async ({ page, electronApp }) => { ... })
 *
 * Prerequisites:
 *   Run `npm run build` before running e2e tests.
 *   The app must be built to out/ for Playwright to launch it.
 */
import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'path'

export interface ElectronFixtures {
  electronApp: ElectronApplication
  page: Page
}

export const test = base.extend<ElectronFixtures>({
  // Launch Electron once per test, close after
  electronApp: async ({}, use) => {
    const appPath = resolve(__dirname, '../../../out/main/index.js')
    const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...env } = process.env

    const app = await electron.launch({
      args: [appPath],
      env: {
        ...env,
        // Use a temp directory for the test DB so tests don't pollute real data
        GHOSTPILOT_TEST_MODE: '1',
        NODE_ENV: 'test'
      },
      // Suppress Electron's default stderr noise in test output
      timeout: 15_000
    })

    await use(app)
    await app.close()
  },

  // Get the main renderer window
  page: async ({ electronApp }, use) => {
    // Wait for the first window to appear
    const win = await electronApp.firstWindow()

    // Wait for the app shell to be ready
    await win.waitForSelector('.app-shell', { timeout: 10_000 })

    await use(win)
  }
})

export { expect } from '@playwright/test'

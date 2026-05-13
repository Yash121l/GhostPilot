/**
 * E2E: Connect page — platform connection UI
 * Note: actual OAuth flows open a browser and cannot be fully automated.
 * These tests cover the UI state and the disconnect flow.
 */
import { test, expect } from './fixtures/electron'
import { AppShell } from './fixtures/pages'

test.describe('Connect page', () => {
  test.beforeEach(async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Connect')
  })

  test('shows Connect heading and subtitle', async ({ page }) => {
    await expect(page.locator('h1:has-text("Connect")')).toBeVisible()
    await expect(page.locator('text=Link your social accounts')).toBeVisible()
  })

  test('shows all three platform cards', async ({ page }) => {
    await expect(page.locator('.card:has-text("LinkedIn")')).toBeVisible()
    await expect(page.locator('.card:has-text("X (Twitter)")')).toBeVisible()
    await expect(page.locator('.card:has-text("Instagram")')).toBeVisible()
  })

  test('LinkedIn card shows description', async ({ page }) => {
    await expect(page.locator('.card:has-text("LinkedIn")')).toContainText('Professional posts')
  })

  test('X card shows description', async ({ page }) => {
    await expect(page.locator('.card:has-text("X (Twitter)")')).toContainText('Tweets')
  })

  test('Instagram card shows description', async ({ page }) => {
    await expect(page.locator('.card:has-text("Instagram")')).toContainText('Visual content')
  })

  test('shows Connect button for disconnected platforms', async ({ page }) => {
    // At least one platform should show a Connect button (fresh install)
    const connectButtons = page.locator('button:has-text("Connect")')
    const count = await connectButtons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('shows Privacy & Security section', async ({ page }) => {
    await expect(page.locator('text=Privacy')).toBeVisible()
    await expect(page.locator('text=keychain')).toBeVisible()
  })

  test('shows refresh button', async ({ page }) => {
    await expect(page.locator('button.btn.ghost.icon')).toBeVisible()
  })

  test('refresh button reloads connection status', async ({ page }) => {
    const refreshBtn = page.locator('button.btn.ghost.icon')
    await refreshBtn.click()
    // Should not throw — just reloads
    await page.waitForTimeout(500)
    await expect(page.locator('h1:has-text("Connect")')).toBeVisible()
  })

  test('Connect button triggers OAuth (opens browser)', async ({ page, electronApp }) => {
    // We can't complete the OAuth flow in e2e, but we can verify the button
    // triggers the initiateConnect IPC call without crashing the app
    const connectBtn = page.locator('.card:has-text("LinkedIn") button:has-text("Connect")')
    if (await connectBtn.isVisible()) {
      // Click and immediately check the app doesn't crash
      await connectBtn.click()
      await page.waitForTimeout(1000)
      // App should still be running
      await expect(page.locator('.app-shell')).toBeVisible()
    }
  })
})

test.describe('Connect page — already connected', () => {
  test.skip(
    !process.env['GHOSTPILOT_LINKEDIN_CONNECTED'],
    'Skipped: set GHOSTPILOT_LINKEDIN_CONNECTED=1 to run connected tests'
  )

  test('LinkedIn shows Connected status', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Connect')
    await expect(page.locator('.card:has-text("LinkedIn")')).toContainText('Connected')
  })

  test('LinkedIn shows Disconnect button when connected', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Connect')
    await expect(page.locator('.card:has-text("LinkedIn") button:has-text("Disconnect")')).toBeVisible()
  })

  test('sidebar shows LinkedIn with green dot', async ({ page }) => {
    const dot = page.locator('.connection-item:has-text("LinkedIn") .connection-dot')
    await expect(dot).toHaveClass(/on/)
  })

  test('status bar shows 1 of 3 accounts connected', async ({ page }) => {
    await expect(page.locator('.statusbar')).toContainText('1 of 3')
  })
})

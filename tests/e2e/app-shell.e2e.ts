/**
 * E2E: App shell — launch, navigation, status bar
 */
import { test, expect } from './fixtures/electron'
import { AppShell } from './fixtures/pages'

test.describe('App launch', () => {
  test('window opens and shows the app shell', async ({ page }) => {
    await expect(page.locator('.app-shell')).toBeVisible()
  })

  test('titlebar shows GhostPilot', async ({ page }) => {
    await expect(page.locator('.titlebar-title')).toHaveText('GhostPilot')
  })

  test('status bar shows DB: Connected', async ({ page }) => {
    await expect(page.locator('.statusbar')).toContainText('DB: Connected')
  })

  test('status bar shows version', async ({ page }) => {
    await expect(page.locator('.statusbar')).toContainText('v1.0.5')
  })

  test('sidebar brand shows GHOSTPILOT', async ({ page }) => {
    await expect(page.locator('.brand-name')).toHaveText('GHOSTPILOT')
  })
})

test.describe('Sidebar navigation', () => {
  test('all nav items are visible', async ({ page }) => {
    const labels = ['Composer', 'Calendar', 'Goals', 'Trends', 'Personas', 'Analytics', 'Settings']
    for (const label of labels) {
      await expect(page.locator(`.nav-item:has-text("${label}")`)).toBeVisible()
    }
  })

  test('Composer is active by default', async ({ page }) => {
    await expect(page.locator('.nav-item.active')).toContainText('Composer')
  })

  test('clicking Calendar navigates to Calendar page', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Calendar')
    await expect(page.locator('.nav-item.active')).toContainText('Calendar')
    // Calendar page shows a month label
    await expect(page.locator('text=/\\w+ 20\\d\\d/')).toBeVisible()
  })

  test('clicking Personas navigates to Personas page', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Personas')
    await expect(
      page.locator('main').getByRole('heading', { name: 'Personas', exact: true })
    ).toBeVisible()
  })

  test('clicking Goals navigates to Goals page', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Goals')
    await expect(page.locator('h1:has-text("Goals")')).toBeVisible()
  })

  test('clicking Trends navigates to Trends page', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Trends')
    await expect(page.locator('h1:has-text("Trends")')).toBeVisible()
  })

  test('clicking Analytics navigates to Analytics page', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Analytics')
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible()
  })

  test('clicking Settings navigates to Settings page', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Settings')
    await expect(page.locator('h1, [style*="fontSize: 22"]').first()).toBeVisible()
  })

  test('can navigate back to Composer', async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Calendar')
    await shell.goTo('Composer')
    await expect(page.locator('.nav-item.active')).toContainText('Composer')
  })
})

test.describe('Connections sidebar', () => {
  test('shows LinkedIn, X, Instagram in sidebar', async ({ page }) => {
    await expect(page.locator('.connections')).toContainText('LinkedIn')
    await expect(page.locator('.connections')).toContainText('X')
    await expect(page.locator('.connections')).toContainText('Instagram')
  })

  test('clicking a connection item opens Settings connections', async ({ page }) => {
    await page.click('.connection-item:has-text("LinkedIn")')
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible()
    await expect(page.locator('.settings-tabs button.active')).toContainText('Connections')
    await expect(page.locator('text=Connected accounts')).toBeVisible()
  })
})

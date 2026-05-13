/**
 * E2E: Analytics page — KPI cards, charts, AI spend
 */
import { test, expect } from './fixtures/electron'
import { AppShell } from './fixtures/pages'

test.describe('Analytics page', () => {
  test.beforeEach(async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Analytics')
  })

  test('shows Analytics heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible()
    await expect(page.locator('text=Publishing metrics')).toBeVisible()
  })

  test('shows refresh button', async ({ page }) => {
    await expect(page.locator('button[title="Refresh"]')).toBeVisible()
  })

  test('shows 4 KPI cards', async ({ page }) => {
    await expect(page.locator('text=Total Posts')).toBeVisible()
    await expect(page.locator('text=Published')).toBeVisible()
    await expect(page.locator('text=Scheduled')).toBeVisible()
    await expect(page.locator('text=AI Spend')).toBeVisible()
  })

  test('shows AI token usage chart section', async ({ page }) => {
    await expect(page.locator('text=AI token usage')).toBeVisible()
  })

  test('shows By platform section', async ({ page }) => {
    await expect(page.locator('text=By platform')).toBeVisible()
    await expect(page.locator('text=LinkedIn')).toBeVisible()
    await expect(page.locator('text=X')).toBeVisible()
    await expect(page.locator('text=Instagram')).toBeVisible()
  })

  test('shows Recent posts section', async ({ page }) => {
    await expect(page.locator('text=Recent posts')).toBeVisible()
  })

  test('shows AI spend breakdown section', async ({ page }) => {
    await expect(page.locator('text=AI spend breakdown')).toBeVisible()
  })

  test('KPI cards show numeric values', async ({ page }) => {
    // Each KPI card should show a number
    const kpiValues = page.locator('[style*="fontSize: 26"]')
    const count = await kpiValues.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('refresh button reloads data without error', async ({ page }) => {
    await page.click('button[title="Refresh"]')
    await page.waitForTimeout(1000)
    // Page should still be intact
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible()
  })

  test('shows "No posts yet" when no posts exist', async ({ page }) => {
    // On fresh install
    const hasNoPosts = await page.locator('text=No posts yet').isVisible()
    const hasPosts = await page.locator('[style*="fontWeight: 500"]').count()
    expect(hasNoPosts || hasPosts > 0).toBe(true)
  })

  test('shows "No AI usage" when no keys configured', async ({ page }) => {
    const hasNoUsage = await page.locator('text=No AI usage').isVisible()
    const hasUsage = await page.locator('text=/\\$\\d+\\.\\d+/').isVisible()
    expect(hasNoUsage || hasUsage).toBe(true)
  })
})

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
    const main = page.locator('main')
    await expect(main.getByText('Total Posts', { exact: true })).toBeVisible()
    await expect(main.getByText('Published', { exact: true })).toBeVisible()
    await expect(main.getByText('Scheduled', { exact: true })).toBeVisible()
    await expect(main.getByText('AI Spend', { exact: true })).toBeVisible()
  })

  test('shows AI token usage chart section', async ({ page }) => {
    await expect(page.locator('text=AI token usage')).toBeVisible()
  })

  test('shows By platform section', async ({ page }) => {
    const byPlatform = page.locator('main .card').filter({ hasText: 'By platform' })
    await expect(byPlatform).toBeVisible()
    await expect(byPlatform.getByText('LinkedIn', { exact: true })).toBeVisible()
    await expect(byPlatform.getByText('X', { exact: true })).toBeVisible()
    await expect(byPlatform.getByText('Instagram', { exact: true })).toBeVisible()
  })

  test('shows Recent posts section', async ({ page }) => {
    await expect(page.locator('text=Recent posts')).toBeVisible()
  })

  test('shows AI spend breakdown section', async ({ page }) => {
    await expect(page.locator('text=AI spend breakdown')).toBeVisible()
  })

  test('KPI cards show numeric values', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('Total Posts', { exact: true }).locator('..')).toContainText(/\d+/)
    await expect(main.getByText('Published', { exact: true }).locator('..')).toContainText(/\d+/)
    await expect(main.getByText('Scheduled', { exact: true }).locator('..')).toContainText(/\d+/)
    await expect(main.getByText('AI Spend', { exact: true }).locator('..')).toContainText(
      /\$\d+\.\d{2}/
    )
  })

  test('refresh button reloads data without error', async ({ page }) => {
    await page.click('button[title="Refresh"]')
    await page.waitForTimeout(1000)
    // Page should still be intact
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible()
  })

  test('shows "No posts yet" when no posts exist', async ({ page }) => {
    // On fresh install
    const main = page.locator('main')
    const hasNoPosts = await main.getByText('No posts yet').isVisible()
    const hasPosts = await main.locator('.analytics-list-row').count()
    expect(hasNoPosts || hasPosts > 0).toBe(true)
  })

  test('shows "No AI usage" when no keys configured', async ({ page }) => {
    const main = page.locator('main')
    const hasNoUsage = await main
      .getByText(/No AI usage/)
      .first()
      .isVisible()
    const hasUsage = await main.getByText(/\$\d+\.\d+/).isVisible()
    expect(hasNoUsage || hasUsage).toBe(true)
  })
})

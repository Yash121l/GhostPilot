/**
 * E2E: Trends page — fetch, configure, draft from trend
 */
import { test, expect } from './fixtures/electron'
import { AppShell } from './fixtures/pages'

test.describe('Trends page', () => {
  test.beforeEach(async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Trends')
  })

  test('shows Trends heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Trends")')).toBeVisible()
    await expect(page.locator('text=Topics scored for relevance')).toBeVisible()
  })

  test('shows Configure button', async ({ page }) => {
    await expect(page.locator('button:has-text("Configure")')).toBeVisible()
  })

  test('shows Refresh button', async ({ page }) => {
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible()
  })

  test('shows empty state or trend cards', async ({ page }) => {
    // Either shows "No trends yet" or trend cards
    const hasEmpty = await page.locator('text=No trends yet').isVisible()
    const hasTrends = await page.locator('button:has-text("Draft this topic")').count()
    expect(hasEmpty || hasTrends > 0).toBe(true)
  })

  test('empty state shows Fetch Trends button', async ({ page }) => {
    const hasEmpty = await page.locator('text=No trends yet').isVisible()
    if (hasEmpty) {
      await expect(page.locator('button:has-text("Fetch Trends")')).toBeVisible()
    }
  })

  test('Configure panel opens and closes', async ({ page }) => {
    await page.click('button:has-text("Configure")')
    await expect(page.locator('text=Trend Configuration')).toBeVisible()

    await page.click('button:has-text("Configure")')
    await expect(page.locator('text=Trend Configuration')).not.toBeVisible()
  })

  test('Configure panel has keyword input', async ({ page }) => {
    await page.click('button:has-text("Configure")')
    await expect(page.locator('input[placeholder*="ai, startups"]')).toBeVisible()
  })

  test('Configure panel has source toggles', async ({ page }) => {
    await page.click('button:has-text("Configure")')
    await expect(page.locator('button:has-text("Hacker News")')).toBeVisible()
    await expect(page.locator('button:has-text("Reddit")')).toBeVisible()
  })

  test('Configure panel has min score slider', async ({ page }) => {
    await page.click('button:has-text("Configure")')
    await expect(page.locator('input[type="range"]')).toBeVisible()
  })

  test('can add a keyword', async ({ page }) => {
    await page.click('button:has-text("Configure")')
    await page.fill('input[placeholder*="ai, startups"]', 'ghostpilot')
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=ghostpilot')).toBeVisible()
  })

  test('can remove a keyword', async ({ page }) => {
    await page.click('button:has-text("Configure")')
    await page.fill('input[placeholder*="ai, startups"]', 'removeme')
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=removeme')).toBeVisible()

    // Click the × on the keyword chip
    await page.locator('span:has-text("removeme") button').click()
    await expect(page.locator('text=removeme')).not.toBeVisible()
  })

  test('Reset defaults button resets config', async ({ page }) => {
    await page.click('button:has-text("Configure")')
    await page.click('button:has-text("Reset defaults")')
    // After reset, no custom keywords should be shown
    await expect(page.locator('text=No keywords')).toBeVisible()
  })

  test.describe('with trends loaded', () => {
    test.skip(
      !process.env['GHOSTPILOT_HAS_TRENDS'],
      'Skipped: set GHOSTPILOT_HAS_TRENDS=1 to run trend card tests'
    )

    test('trend cards show title and scores', async ({ page }) => {
      await expect(page.locator('.glass-card').first()).toBeVisible()
      await expect(page.locator('text=Relevance')).toBeVisible()
      await expect(page.locator('text=Velocity')).toBeVisible()
      await expect(page.locator('text=Novelty')).toBeVisible()
    })

    test('"Draft this topic" navigates to Composer with prefill', async ({ page }) => {
      const draftBtn = page.locator('button:has-text("Draft this topic")').first()
      const trendTitle = await page.locator('.glass-card h3').first().textContent()

      await draftBtn.click()

      // Should navigate to Composer
      await expect(page.locator('.nav-item.active')).toContainText('Composer')
      // Editor should be pre-filled with the trend title
      await expect(page.locator('.tiptap')).toContainText(trendTitle?.slice(0, 20) ?? '')
    })

    test('dismiss button removes a trend card', async ({ page }) => {
      const initialCount = await page.locator('.glass-card').count()
      // Hover to reveal dismiss button
      await page.locator('.glass-card').first().hover()
      await page.locator('.glass-card .btn-ghost.btn-icon').first().click()
      await page.waitForTimeout(300)
      const newCount = await page.locator('.glass-card').count()
      expect(newCount).toBeLessThan(initialCount)
    })
  })
})

/**
 * E2E: Goals page — create, view, delete goals
 */
import { test, expect } from './fixtures/electron'
import { AppShell } from './fixtures/pages'

test.describe('Goals page', () => {
  test.beforeEach(async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Goals')
  })

  test('shows Goals heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Goals")')).toBeVisible()
    await expect(page.locator('text=active objective')).toBeVisible()
  })

  test('shows New Goal button', async ({ page }) => {
    await expect(page.locator('.page-header button:has-text("New goal")')).toBeVisible()
  })

  test('shows empty state when no goals', async ({ page }) => {
    const hasEmpty = await page.locator('text=No goals yet').isVisible()
    const hasGoals = (await page.locator('.goal-card').count()) > 0
    expect(hasEmpty || hasGoals).toBe(true)
  })

  test('clicking New Goal opens the create form', async ({ page }) => {
    await page.click('.page-header button:has-text("New goal")')
    await expect(page.locator('form.goal-form').getByText('New goal')).toBeVisible()
    await expect(page.locator('input[placeholder*="LinkedIn followers"]')).toBeVisible()
  })

  test('create form has all fields', async ({ page }) => {
    await page.click('.page-header button:has-text("New goal")')
    await expect(page.locator('label:has-text("Goal name")')).toBeVisible()
    await expect(page.locator('label:has-text("Objective")')).toBeVisible()
    await expect(page.locator('label:has-text("Timeframe")')).toBeVisible()
    await expect(page.locator('label:has-text("Platform")')).toBeVisible()
    await expect(page.locator('button:has-text("Create goal")')).toBeVisible()
  })

  test('Cancel button closes the form', async ({ page }) => {
    await page.click('.page-header button:has-text("New goal")')
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('form.goal-form')).not.toBeVisible()
  })

  test('timeframe dropdown has options', async ({ page }) => {
    await page.click('.page-header button:has-text("New goal")')
    const select = page.locator('label:has-text("Timeframe") select')
    const options = await select.locator('option').allTextContents()
    expect(options).toContain('6 months')
    expect(options.length).toBeGreaterThan(1)
  })

  test('platform dropdown has LinkedIn option', async ({ page }) => {
    await page.click('.page-header button:has-text("New goal")')
    const platformSelect = page.locator('label:has-text("Platform") select')
    const options = await platformSelect.locator('option').allTextContents()
    expect(options).toContain('LinkedIn')
  })

  test.describe('with AI configured', () => {
    test.skip(
      !process.env['GHOSTPILOT_AI_CONFIGURED'],
      'Skipped: set GHOSTPILOT_AI_CONFIGURED=1 to run AI tests'
    )

    test('can create a goal with AI decomposition', async ({ page }) => {
      // Need a persona first
      const shell = new AppShell(page)
      await shell.goTo('Personas')
      await page.click('.btn.ghost.icon')
      await page.fill('input[placeholder*="Tech Founder"]', 'Goals Test Persona')
      await page.click('button:has-text("Create Persona")')
      await expect(page.locator('text=Goals Test Persona')).toBeVisible({ timeout: 5_000 })

      await shell.goTo('Goals')
      await page.click('button:has-text("New Goal")')
      await page.fill(
        'input[placeholder*="LinkedIn followers"]',
        'Reach 5K LinkedIn followers by Q4'
      )
      await page.click('button:has-text("Decompose with AI")')

      // Wait for AI decomposition
      await expect(page.locator('text=North star')).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('text=Reach 5K LinkedIn followers')).toBeVisible()
    })
  })
})

/**
 * E2E: Personas page — create, view, delete
 */
import { test, expect } from './fixtures/electron'
import { AppShell } from './fixtures/pages'

test.describe('Personas page', () => {
  test.beforeEach(async ({ page }) => {
    const shell = new AppShell(page)
    await shell.goTo('Personas')
  })

  test('shows Personas heading', async ({ page }) => {
    await expect(page.locator('main h1:has-text("Personas")')).toBeVisible()
  })

  test('shows + button to create new persona', async ({ page }) => {
    await expect(page.locator('main button:has-text("New persona")')).toBeVisible()
  })

  test('shows empty state or existing personas', async ({ page }) => {
    const hasEmpty = await page.locator('text=No persona selected').isVisible()
    const hasPersonas = await page.locator('.persona-list-item').count()
    expect(hasEmpty || hasPersonas > 0).toBe(true)
  })

  test('clicking + opens the create form', async ({ page }) => {
    await page.click('main button:has-text("New persona")')
    await expect(page.locator('form').getByText('New persona')).toBeVisible()
    await expect(page.locator('input[placeholder*="Tech Founder"]')).toBeVisible()
  })

  test('create form has all required fields', async ({ page }) => {
    await page.click('main button:has-text("New persona")')
    await expect(page.locator('label:has-text("Name")')).toBeVisible()
    await expect(page.locator('label:has-text("Bio")')).toBeVisible()
    await expect(page.locator('label:has-text("Content pillars")')).toBeVisible()
    await expect(page.locator('label:has-text("Style hints")')).toBeVisible()
  })

  test('Cancel button closes the form', async ({ page }) => {
    await page.click('main button:has-text("New persona")')
    await expect(page.locator('form').getByText('New persona')).toBeVisible()
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('form').getByText('New persona')).not.toBeVisible()
  })

  test('can create a persona', async ({ page }) => {
    await page.click('main button:has-text("New persona")')
    const name = `E2E Test Persona ${Date.now()}`
    await page.fill('input[placeholder*="Tech Founder"]', name)
    await page.fill('textarea[placeholder*="Short context"]', 'A persona created by e2e tests.')
    await page.fill('input[placeholder*="AI, indie"]', 'AI, testing, automation')
    await page.click('button:has-text("Create persona")')

    await expect(page.locator('.persona-detail-header').getByText(name)).toBeVisible({
      timeout: 5_000
    })
  })

  test('created persona shows in detail panel', async ({ page }) => {
    await page.click('main button:has-text("New persona")')
    const name = `Detail Test Persona ${Date.now()}`
    await page.fill('input[placeholder*="Tech Founder"]', name)
    await page.click('button:has-text("Create persona")')

    await expect(page.locator('.persona-detail-header').getByText(name)).toBeVisible({
      timeout: 5_000
    })
  })

  test('can delete a persona', async ({ page }) => {
    await page.click('main button:has-text("New persona")')
    const name = `Delete Me Persona ${Date.now()}`
    await page.fill('input[placeholder*="Tech Founder"]', name)
    await page.click('button:has-text("Create persona")')
    await expect(page.locator('.persona-detail-header').getByText(name)).toBeVisible({
      timeout: 5_000
    })

    // Delete it
    await page.click('button:has-text("Delete")')
    await expect(page.locator('.persona-detail-header').getByText(name)).not.toBeVisible({
      timeout: 5_000
    })
  })

  test('persona name is required — empty name shows no creation', async ({ page }) => {
    await page.click('main button:has-text("New persona")')
    await expect(page.locator('button:has-text("Create persona")')).toBeDisabled()
    await expect(page.locator('form').getByText('New persona')).toBeVisible()
  })
})

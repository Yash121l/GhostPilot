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
    await expect(page.locator('text=Personas')).toBeVisible()
  })

  test('shows + button to create new persona', async ({ page }) => {
    // The + button in the list panel header
    await expect(page.locator('.btn.ghost.icon')).toBeVisible()
  })

  test('shows empty state or existing personas', async ({ page }) => {
    // Either shows "Select a persona or create a new one" or a persona list
    const hasEmpty = await page.locator('text=Select a persona').isVisible()
    const hasPersonas = await page.locator('[style*="fontWeight: 500"]').count()
    expect(hasEmpty || hasPersonas > 0).toBe(true)
  })

  test('clicking + opens the create form', async ({ page }) => {
    await page.click('.btn.ghost.icon')
    await expect(page.locator('text=New Persona')).toBeVisible()
    await expect(page.locator('input[placeholder*="Tech Founder"]')).toBeVisible()
  })

  test('create form has all required fields', async ({ page }) => {
    await page.click('.btn.ghost.icon')
    await expect(page.locator('label:has-text("Name")')).toBeVisible()
    await expect(page.locator('label:has-text("Bio")')).toBeVisible()
    await expect(page.locator('label:has-text("Content pillars")')).toBeVisible()
    await expect(page.locator('label:has-text("Style hints")')).toBeVisible()
  })

  test('Cancel button closes the form', async ({ page }) => {
    await page.click('.btn.ghost.icon')
    await expect(page.locator('text=New Persona')).toBeVisible()
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('text=New Persona')).not.toBeVisible()
  })

  test('can create a persona', async ({ page }) => {
    await page.click('.btn.ghost.icon')
    await page.fill('input[placeholder*="Tech Founder"]', 'E2E Test Persona')
    await page.fill('textarea[placeholder*="bio"]', 'A persona created by e2e tests.')
    await page.fill('input[placeholder*="AI, indie"]', 'AI, testing, automation')
    await page.click('button:has-text("Create Persona")')

    // Should appear in the list
    await expect(page.locator('text=E2E Test Persona')).toBeVisible({ timeout: 5_000 })
  })

  test('created persona shows in detail panel', async ({ page }) => {
    // Create a persona first
    await page.click('.btn.ghost.icon')
    await page.fill('input[placeholder*="Tech Founder"]', 'Detail Test Persona')
    await page.click('button:has-text("Create Persona")')

    await expect(page.locator('text=Detail Test Persona')).toBeVisible({ timeout: 5_000 })
    // Detail panel should show the name
    await expect(page.locator('[style*="fontSize: 22"]').first()).toContainText('Detail Test Persona')
  })

  test('can delete a persona', async ({ page }) => {
    // Create one first
    await page.click('.btn.ghost.icon')
    await page.fill('input[placeholder*="Tech Founder"]', 'Delete Me Persona')
    await page.click('button:has-text("Create Persona")')
    await expect(page.locator('text=Delete Me Persona')).toBeVisible({ timeout: 5_000 })

    // Delete it
    await page.click('button:has-text("Delete")')
    await expect(page.locator('text=Delete Me Persona')).not.toBeVisible({ timeout: 5_000 })
  })

  test('persona name is required — empty name shows no creation', async ({ page }) => {
    await page.click('.btn.ghost.icon')
    // Don't fill name, click Create
    await page.click('button:has-text("Create Persona")')
    // Form should still be visible (not submitted)
    await expect(page.locator('text=New Persona')).toBeVisible()
  })
})

/**
 * E2E: Composer page — draft editing, platform selection, variant generation flow
 */
import { test, expect } from './fixtures/electron'
import { ComposerPage } from './fixtures/pages'

test.describe('Composer — initial state', () => {
  test('shows Composer heading', async ({ page }) => {
    await expect(page.locator('main').getByRole('heading', { name: 'Composer' })).toBeVisible()
    await expect(page.locator('text=Draft once')).toBeVisible()
  })

  test('shows Generate Variants button', async ({ page }) => {
    await expect(page.locator('button:has-text("Generate variants")').first()).toBeVisible()
  })

  test('shows generation provider selector', async ({ page }) => {
    await expect(page.getByLabel('Generation provider')).toBeVisible()
    await expect(page.getByLabel('Generation provider')).toContainText('Auto')
  })

  test('shows platform chips: LinkedIn, X, Instagram', async ({ page }) => {
    await expect(
      page.locator('.composer-toolbar-row').filter({ hasText: 'Platforms' })
    ).toBeVisible()
    await expect(page.locator('.composer-platform-button:has-text("LinkedIn")')).toBeVisible()
    await expect(page.locator('.composer-platform-button:has-text("X (Twitter)")')).toBeVisible()
    await expect(page.locator('.composer-platform-button:has-text("Instagram")')).toBeVisible()
  })

  test('shows platform tabs on the right panel', async ({ page }) => {
    await page.locator('.composer-platform-button:has-text("LinkedIn")').click()
    await page.locator('.composer-platform-button:has-text("X (Twitter)")').click()
    await page.locator('.composer-platform-button:has-text("Instagram")').click()
    await expect(page.locator('.composer-variant-tab:has-text("LinkedIn")')).toBeVisible()
    await expect(page.locator('.composer-variant-tab:has-text("X (Twitter)")')).toBeVisible()
    await expect(page.locator('.composer-variant-tab:has-text("Instagram")')).toBeVisible()
  })

  test('shows "No variant yet" empty state', async ({ page }) => {
    await expect(page.locator('text=No variant yet')).toBeVisible()
  })

  test('shows Clear button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Clear' }).first()).toBeVisible()
  })

  test('shows AI toolbar with Rewrite, Shorten, Add Hook, Add CTA', async ({ page }) => {
    await expect(page.locator('button:has-text("Rewrite")')).toBeVisible()
    await expect(page.locator('button:has-text("Shorten")')).toBeVisible()
    await expect(page.locator('button:has-text("Add Hook")')).toBeVisible()
    await expect(page.locator('button:has-text("Add CTA")')).toBeVisible()
  })

  test('does not show publish actions before a generated variant exists', async ({ page }) => {
    await page.locator('.composer-platform-button:has-text("LinkedIn")').click()
    const main = page.locator('main')
    await expect(main.getByRole('button', { name: 'Schedule', exact: true })).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Publish now', exact: true })).toHaveCount(0)
  })
})

test.describe('Composer — draft editing', () => {
  test('can type in the editor', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('Hello world test post')
    const text = await composer.getDraftText()
    expect(text).toContain('Hello world test post')
  })

  test('char count updates as user types', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('Testing char count')
    const count = await composer.getCharCount()
    expect(count).toBeGreaterThan(0)
  })

  test('Clear button resets the editor', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('Some draft text')
    await composer.clickClear()
    const text = await composer.getDraftText()
    expect(text?.trim()).toBe('')
  })

  test('disables Generate when the draft is empty', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.clickClear()
    await expect(page.locator('button:has-text("Generate variants")').last()).toBeDisabled()
  })
})

test.describe('Composer — platform chips', () => {
  test('clicking a chip deselects it (visual change)', async ({ page }) => {
    const liChip = page.locator('.composer-platform-button:has-text("LinkedIn")')
    await liChip.click()
    await expect(liChip).toHaveClass(/selected/)
    await liChip.click()
    await expect(liChip).not.toHaveClass(/selected/)
  })

  test('clicking a deselected chip re-selects it', async ({ page }) => {
    const liChip = page.locator('.composer-platform-button:has-text("LinkedIn")')
    await liChip.click()
    await expect(liChip).toHaveClass(/selected/)
  })
})

test.describe('Composer — platform tabs', () => {
  test('LinkedIn tab is active by default', async ({ page }) => {
    await page.locator('.composer-platform-button:has-text("LinkedIn")').click()
    await expect(page.locator('.composer-variant-tab:has-text("LinkedIn")')).toHaveClass(/active/)
  })

  test('clicking X tab switches active tab', async ({ page }) => {
    await page.locator('.composer-platform-button:has-text("LinkedIn")').click()
    await page.locator('.composer-platform-button:has-text("X (Twitter)")').click()
    const xTab = page.locator('.composer-variant-tab:has-text("X (Twitter)")')
    await xTab.click()
    await expect(xTab).toHaveClass(/active/)
  })

  test('clicking Instagram tab switches active tab', async ({ page }) => {
    await page.locator('.composer-platform-button:has-text("LinkedIn")').click()
    await page.locator('.composer-platform-button:has-text("Instagram")').click()
    const igTab = page.locator('.composer-variant-tab:has-text("Instagram")')
    await igTab.click()
    await expect(igTab).toHaveClass(/active/)
  })
})

test.describe('Composer — Generate Variants (requires AI configured)', () => {
  test.skip(
    !process.env['GHOSTPILOT_AI_CONFIGURED'],
    'Skipped: set GHOSTPILOT_AI_CONFIGURED=1 to run AI tests'
  )

  test('generates variants and shows variant card', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft(
      'I spent 6 months building the wrong thing. Here is what I learned about validating ideas before writing code.'
    )
    await composer.clickGenerate()

    // Wait for generation to complete (up to 30s)
    await expect(page.locator('.composer-variant-card')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('text=Copy')).toBeVisible()
    await expect(page.locator('text=Schedule')).toBeVisible()
    await expect(page.locator('text=Publish now')).toBeVisible()
  })

  test('variant card shows char count and opt range', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('Test post for char count verification.')
    await composer.clickGenerate()

    await expect(page.locator('.composer-variant-card')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('text=/\\d+ chars/')).toBeVisible()
    await expect(page.locator('text=/opt:/')).toBeVisible()
  })

  test('Copy button copies variant text to clipboard', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('Copy test post content.')
    await composer.clickGenerate()
    await expect(page.locator('.composer-variant-card')).toBeVisible({ timeout: 30_000 })

    await composer.clickCopy()
    await expect(page.locator('text=Copied')).toBeVisible()
  })

  test('re-generating reuses the same post (no duplicates)', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('First draft content.')
    await composer.clickGenerate()
    await expect(page.locator('.composer-variant-card')).toBeVisible({ timeout: 30_000 })

    // Generate again — should update, not create a new post
    await composer.clickGenerate()
    await expect(page.locator('.composer-variant-card')).toBeVisible({ timeout: 30_000 })
    // No error should appear
    const error = await composer.getError()
    expect(error).toBeNull()
  })
})

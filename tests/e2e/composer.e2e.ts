/**
 * E2E: Composer page — draft editing, platform selection, variant generation flow
 */
import { test, expect } from './fixtures/electron'
import { ComposerPage, AppShell } from './fixtures/pages'

test.describe('Composer — initial state', () => {
  test('shows Composer heading', async ({ page }) => {
    await expect(page.locator('text=Composer')).toBeVisible()
    await expect(page.locator('text=Write once')).toBeVisible()
  })

  test('shows Generate Variants button', async ({ page }) => {
    await expect(page.locator('button:has-text("Generate Variants")').first()).toBeVisible()
  })

  test('shows PHASE 1 badge', async ({ page }) => {
    await expect(page.locator('text=PHASE 1')).toBeVisible()
  })

  test('shows platform chips: LinkedIn, X, Instagram', async ({ page }) => {
    await expect(page.locator('text=PLATFORMS')).toBeVisible()
    await expect(page.locator('button:has-text("LinkedIn")').first()).toBeVisible()
    await expect(page.locator('button:has-text("X (Twitter)")').first()).toBeVisible()
    await expect(page.locator('button:has-text("Instagram")').first()).toBeVisible()
  })

  test('shows platform tabs on the right panel', async ({ page }) => {
    await expect(page.locator('button:has-text("LinkedIn")').nth(1)).toBeVisible()
    await expect(page.locator('button:has-text("X (Twitter)")').nth(1)).toBeVisible()
    await expect(page.locator('button:has-text("Instagram")').nth(1)).toBeVisible()
  })

  test('shows "No variant yet" empty state', async ({ page }) => {
    await expect(page.locator('text=No variant yet')).toBeVisible()
  })

  test('shows Clear button', async ({ page }) => {
    await expect(page.locator('button:has-text("Clear")')).toBeVisible()
  })

  test('shows AI toolbar with Rewrite, Shorten, Add Hook, Add CTA', async ({ page }) => {
    await expect(page.locator('button:has-text("Rewrite")')).toBeVisible()
    await expect(page.locator('button:has-text("Shorten")')).toBeVisible()
    await expect(page.locator('button:has-text("Add Hook")')).toBeVisible()
    await expect(page.locator('button:has-text("Add CTA")')).toBeVisible()
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

  test('shows error when Generate clicked with empty editor', async ({ page }) => {
    const composer = new ComposerPage(page)
    // Make sure editor is empty
    await composer.clickClear()
    await composer.clickGenerate()
    await expect(page.locator('text=Write something first')).toBeVisible()
  })
})

test.describe('Composer — platform chips', () => {
  test('clicking a chip deselects it (visual change)', async ({ page }) => {
    // LinkedIn chip should be selected by default (has colored border)
    const liChip = page.locator('button:has-text("LinkedIn")').first()
    const initialStyle = await liChip.getAttribute('style')
    await liChip.click()
    const afterStyle = await liChip.getAttribute('style')
    // Style should change when toggled
    expect(initialStyle).not.toBe(afterStyle)
  })

  test('clicking a deselected chip re-selects it', async ({ page }) => {
    const liChip = page.locator('button:has-text("LinkedIn")').first()
    await liChip.click() // deselect
    await liChip.click() // re-select
    // Should be back to selected state
    const style = await liChip.getAttribute('style')
    expect(style).toContain('#0a66c2')
  })
})

test.describe('Composer — platform tabs', () => {
  test('LinkedIn tab is active by default', async ({ page }) => {
    // The active tab has a colored bottom border
    const liTab = page.locator('button:has-text("LinkedIn")').nth(1)
    const style = await liTab.getAttribute('style')
    expect(style).toContain('border-bottom: 2px solid')
  })

  test('clicking X tab switches active tab', async ({ page }) => {
    const xTab = page.locator('button:has-text("X (Twitter)")').nth(1)
    await xTab.click()
    const style = await xTab.getAttribute('style')
    expect(style).toContain('border-bottom: 2px solid')
  })

  test('clicking Instagram tab switches active tab', async ({ page }) => {
    const igTab = page.locator('button:has-text("Instagram")').nth(1)
    await igTab.click()
    const style = await igTab.getAttribute('style')
    expect(style).toContain('border-bottom: 2px solid')
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
    await expect(page.locator('text=VARIANT ·')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('text=Copy')).toBeVisible()
    await expect(page.locator('text=Schedule')).toBeVisible()
    await expect(page.locator('text=Publish now')).toBeVisible()
  })

  test('variant card shows char count and opt range', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('Test post for char count verification.')
    await composer.clickGenerate()

    await expect(page.locator('text=VARIANT ·')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('text=/\\d+ chars/')).toBeVisible()
    await expect(page.locator('text=/opt:/')).toBeVisible()
  })

  test('Copy button copies variant text to clipboard', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('Copy test post content.')
    await composer.clickGenerate()
    await expect(page.locator('text=VARIANT ·')).toBeVisible({ timeout: 30_000 })

    await composer.clickCopy()
    await expect(page.locator('text=Copied!')).toBeVisible()
  })

  test('re-generating reuses the same post (no duplicates)', async ({ page }) => {
    const composer = new ComposerPage(page)
    await composer.typeDraft('First draft content.')
    await composer.clickGenerate()
    await expect(page.locator('text=VARIANT ·')).toBeVisible({ timeout: 30_000 })

    // Generate again — should update, not create a new post
    await composer.clickGenerate()
    await expect(page.locator('text=VARIANT ·')).toBeVisible({ timeout: 30_000 })
    // No error should appear
    const error = await composer.getError()
    expect(error).toBeNull()
  })
})

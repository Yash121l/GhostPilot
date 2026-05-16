/**
 * E2E: responsive workspace smoke tests.
 */
import { test, expect } from './fixtures/electron'
import { AppShell } from './fixtures/pages'
import type { Page } from '@playwright/test'

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 900, height: 700 },
  { width: 390, height: 844 }
]

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(2)
}

test.describe('Responsive workspace', () => {
  for (const viewport of viewports) {
    test(`Composer has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      const shell = new AppShell(page)
      await shell.goTo('Composer')
      await page.setViewportSize(viewport)
      await expect(page.locator('.composer-workspace')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })

    test(`Trends has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      const shell = new AppShell(page)
      await shell.goTo('Trends')
      await page.setViewportSize(viewport)
      await expect(page.locator('main h1:has-text("Trends")')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })

    test(`Calendar has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      const shell = new AppShell(page)
      await shell.goTo('Calendar')
      await page.setViewportSize(viewport)
      await expect(page.locator('.calendar-workspace')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  }
})

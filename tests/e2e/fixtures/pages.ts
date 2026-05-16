/**
 * Page Object Models for GhostPilot e2e tests.
 * Each class wraps a page/section of the app with typed helper methods.
 */
import type { Page } from '@playwright/test'

// ─── App Shell ────────────────────────────────────────────────────────────────

export class AppShell {
  constructor(private page: Page) {}

  /** Navigate to a sidebar page by label */
  async goTo(
    label: 'Composer' | 'Calendar' | 'Goals' | 'Trends' | 'Personas' | 'Analytics' | 'Settings'
  ) {
    await this.page.click(`.nav-item:has-text("${label}")`)
    await this.page.waitForTimeout(200) // allow page transition
  }

  /** Get the status bar DB status text */
  async dbStatus() {
    return this.page.locator('.statusbar').textContent()
  }

  /** Get the AI status from the status bar */
  async aiStatus() {
    const bar = this.page.locator('.statusbar')
    return bar.textContent()
  }

  /** Get the connections count text from status bar */
  async connectionsText() {
    return this.page.locator('.statusbar').textContent()
  }

  /** Check if a sidebar connection dot is green (connected) */
  async isConnected(platform: 'LinkedIn' | 'X' | 'Instagram') {
    const dot = this.page.locator(`.connection-item:has-text("${platform}") .connection-dot`)
    return dot.evaluate((el) => el.classList.contains('on'))
  }
}

// ─── Composer Page ────────────────────────────────────────────────────────────

export class ComposerPage {
  constructor(private page: Page) {}

  /** Type text into the draft editor */
  async typeDraft(text: string) {
    const editor = this.page.locator('.tiptap')
    await editor.click()
    await editor.fill(text)
  }

  /** Clear the editor and reset the composer */
  async clickClear() {
    await this.page.click('button:has-text("Clear")')
  }

  /** Click Generate Variants (bottom button) */
  async clickGenerate() {
    // Use the bottom Generate Variants button (not the header one)
    await this.page.locator('button:has-text("Generate variants")').last().click()
  }

  /** Get the current draft text */
  async getDraftText() {
    return this.page.locator('.tiptap').textContent()
  }

  /** Get the char count shown in the footer */
  async getCharCount() {
    const text = await this.page.locator('text=/\\d+ chars/').first().textContent()
    return parseInt(text?.match(/(\d+)/)?.[1] ?? '0', 10)
  }

  /** Get the active platform tab label */
  async getActivePlatformTab() {
    return this.page.locator('.composer-variant-tab.active').first().textContent()
  }

  /** Click a platform tab on the right panel */
  async clickPlatformTab(platform: 'LinkedIn' | 'X (Twitter)' | 'Instagram') {
    await this.page.click(`button:has-text("${platform}")`)
  }

  /** Get the variant body text for the active platform */
  async getVariantBody() {
    return this.page.locator('.composer-variant-body').textContent()
  }

  /** Check if a variant card is visible */
  async hasVariant() {
    return this.page.locator('.composer-variant-card').isVisible()
  }

  /** Click the Publish now button */
  async clickPublishNow() {
    await this.page.click('button:has-text("Publish now")')
  }

  /** Click the Schedule button */
  async clickSchedule() {
    await this.page.click('button:has-text("Schedule")')
  }

  /** Set the schedule datetime */
  async setScheduleTime(isoString: string) {
    // datetime-local input expects YYYY-MM-DDTHH:MM format
    const local = isoString.slice(0, 16)
    await this.page.fill('input[type="datetime-local"]', local)
  }

  /** Click Confirm to finalize scheduling */
  async clickConfirm() {
    await this.page.click('button:has-text("Confirm")')
  }

  /** Click Copy button */
  async clickCopy() {
    await this.page.click('button:has-text("Copy")')
  }

  /** Get the error message if shown */
  async getError() {
    const el = this.page.locator('.composer-error').first()
    if (await el.isVisible()) return el.textContent()
    return null
  }

  /** Get the persona name shown in the footer */
  async getPersonaName() {
    const footer = this.page.locator('text=/Persona:/')
    if (await footer.isVisible()) return footer.textContent()
    return null
  }

  /** Toggle a platform chip */
  async togglePlatform(platform: 'LinkedIn' | 'X (Twitter)' | 'Instagram') {
    await this.page.click(`button:has-text("${platform}")`)
  }
}

// ─── Personas Page ────────────────────────────────────────────────────────────

export class PersonasPage {
  constructor(private page: Page) {}

  /** Click the + button to create a new persona */
  async clickNew() {
    await this.page
      .click('button[title], button:has-text("+")')
      .catch(() => this.page.click('.btn.ghost.icon'))
  }

  /** Fill in the persona creation form */
  async fillForm(opts: { name: string; bio?: string; pillars?: string; style?: string }) {
    await this.page.fill('input[placeholder*="Tech Founder"]', opts.name)
    if (opts.bio) await this.page.fill('textarea[placeholder*="bio"]', opts.bio)
    if (opts.pillars) await this.page.fill('input[placeholder*="AI, indie"]', opts.pillars)
    if (opts.style) await this.page.fill('textarea[placeholder*="Casual"]', opts.style)
  }

  /** Click Create Persona */
  async clickCreate() {
    await this.page.click('button:has-text("Create Persona")')
  }

  /** Get all persona names in the list */
  async getPersonaNames() {
    return this.page.locator('.nav-item, [style*="fontWeight: 500"]').allTextContents()
  }

  /** Click a persona in the list */
  async selectPersona(name: string) {
    await this.page.click(`text=${name}`)
  }

  /** Click Delete on the current persona */
  async clickDelete() {
    await this.page.click('button:has-text("Delete")')
  }
}

// ─── Settings Connections Section ─────────────────────────────────────────────

export class ConnectPage {
  constructor(private page: Page) {}

  /** Get the connection status for a platform */
  async getStatus(platform: 'LinkedIn' | 'X (Twitter)' | 'Instagram') {
    const card = this.page.locator(`.settings-card:has-text("${platform}")`)
    return card.textContent()
  }

  /** Check if a platform shows as connected */
  async isConnected(platform: 'LinkedIn' | 'X (Twitter)' | 'Instagram') {
    const card = this.page.locator(`.settings-card:has-text("${platform}")`)
    return card.locator('text=Connected').isVisible()
  }

  /** Click Connect for a platform */
  async clickConnect(platform: 'LinkedIn' | 'X (Twitter)' | 'Instagram') {
    const card = this.page.locator(`.settings-card:has-text("${platform}")`)
    await card.locator('button:has-text("Connect")').click()
  }

  /** Click Disconnect for a platform */
  async clickDisconnect(platform: 'LinkedIn' | 'X (Twitter)' | 'Instagram') {
    const card = this.page.locator(`.settings-card:has-text("${platform}")`)
    await card.locator('button:has-text("Disconnect")').click()
  }
}

// ─── Calendar Page ────────────────────────────────────────────────────────────

export class CalendarPage {
  constructor(private page: Page) {}

  /** Get the day header text */
  async getDayHeader() {
    return this.page.locator('[style*="fontSize: 28"]').first().textContent()
  }

  /** Get the count of scheduled posts shown */
  async getScheduledCount() {
    const text = await this.page.locator('text=/\\d+ scheduled/').textContent()
    return parseInt(text?.match(/(\d+)/)?.[1] ?? '0', 10)
  }

  /** Click the × delete button on a post row */
  async deletePost(index = 0) {
    const buttons = this.page.locator('button:has-text("×")')
    await buttons.nth(index).click()
  }

  /** Get all post titles visible on the selected day */
  async getPostTitles() {
    return this.page.locator('[style*="fontWeight: 500"]').allTextContents()
  }

  /** Click a day number in the mini calendar */
  async clickDay(day: number) {
    await this.page.click(`button:has-text("${day}")`)
  }

  /** Navigate to next month */
  async nextMonth() {
    await this.page.click('button:has(svg[data-lucide="chevron-right"])')
  }

  /** Navigate to previous month */
  async prevMonth() {
    await this.page.click('button:has(svg[data-lucide="chevron-left"])')
  }
}

// ─── Goals Page ───────────────────────────────────────────────────────────────

export class GoalsPage {
  constructor(private page: Page) {}

  async clickNewGoal() {
    await this.page.click('button:has-text("New Goal")')
  }

  async fillNorthStar(text: string) {
    await this.page.fill('input[placeholder*="LinkedIn followers"]', text)
  }

  async clickDecompose() {
    await this.page.click('button:has-text("Decompose with AI")')
  }

  async getGoalTitles() {
    return this.page.locator('[style*="fontSize: 18"][style*="fontWeight: 700"]').allTextContents()
  }
}

// ─── Settings / AI Providers Page ────────────────────────────────────────────

export class AIProvidersPage {
  constructor(private page: Page) {}

  async clickAddKey() {
    await this.page.click('button:has-text("Add Key")')
  }

  async selectProvider(provider: string) {
    await this.page.selectOption('select', provider)
  }

  async fillLabel(label: string) {
    await this.page.fill('input[placeholder*="label"]', label)
  }

  async fillSecret(secret: string) {
    await this.page.fill('input[type="password"]', secret)
  }

  async clickSave() {
    await this.page.click('button:has-text("Save")')
  }

  async getProviderCount() {
    const items = await this.page.locator('[data-provider]').count()
    return items
  }
}

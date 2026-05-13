/**
 * @module intent
 * Goal / intent types aligned to the OKR decomposition engine.
 */

/** A high-level user goal. */
export interface Intent {
  id: string
  personaId: string
  title: string
  description: string
  /** Target horizon (e.g. "Q3 2025"). */
  horizon: string
  keyResults: KeyResult[]
  createdAt: Date
  updatedAt: Date
}

/** A measurable key result under an Intent. */
export interface KeyResult {
  id: string
  intentId: string
  title: string
  /** Numeric target (e.g. 10000 followers). */
  target: number
  current: number
  unit: string
  /** Weekly content quota derived from this KR. */
  weeklyQuota: ContentQuota
}

/** How many posts of each type the user should publish per week. */
export interface ContentQuota {
  postsPerWeek: number
  /** Platform-specific breakdown. */
  breakdown: Record<string, number>
}

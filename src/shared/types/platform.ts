/**
 * @module platform
 * Platform enum and related constants shared across main and renderer.
 */

/** All supported social platforms. */
export enum Platform {
  LINKEDIN = 'linkedin',
  TWITTER = 'twitter',
  INSTAGRAM = 'instagram'
}

/** Ordered array of all platforms — use for iteration, never hardcode. */
export const PLATFORMS = Object.values(Platform) as Platform[]

/** Human-readable display name for each platform. */
export const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.INSTAGRAM]: 'Instagram'
}

/** Character limits per platform. */
export const PLATFORM_CHAR_LIMITS: Record<Platform, number> = {
  [Platform.LINKEDIN]: 3000,
  [Platform.TWITTER]: 280,
  [Platform.INSTAGRAM]: 2200
}

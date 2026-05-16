import { describe, it, expect } from 'vitest'
import {
  Platform,
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_CHAR_LIMITS
} from '../../../src/shared/types/platform'

describe('Platform enum', () => {
  it('has correct string values', () => {
    expect(Platform.LINKEDIN).toBe('linkedin')
    expect(Platform.TWITTER).toBe('twitter')
    expect(Platform.INSTAGRAM).toBe('instagram')
  })

  it('PLATFORMS array contains exactly 3 platforms', () => {
    expect(PLATFORMS).toHaveLength(3)
    expect(PLATFORMS).toContain(Platform.LINKEDIN)
    expect(PLATFORMS).toContain(Platform.TWITTER)
    expect(PLATFORMS).toContain(Platform.INSTAGRAM)
  })

  it('PLATFORM_LABELS has a non-empty string for every platform', () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_LABELS[p]).toBeTypeOf('string')
      expect(PLATFORM_LABELS[p].length).toBeGreaterThan(0)
    }
  })

  it('PLATFORM_CHAR_LIMITS has positive limits for every platform', () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_CHAR_LIMITS[p]).toBeGreaterThan(0)
    }
  })

  it('Twitter char limit is exactly 280', () => {
    expect(PLATFORM_CHAR_LIMITS[Platform.TWITTER]).toBe(280)
  })

  it('LinkedIn char limit is 3000', () => {
    expect(PLATFORM_CHAR_LIMITS[Platform.LINKEDIN]).toBe(3000)
  })

  it('Instagram char limit is 2200', () => {
    expect(PLATFORM_CHAR_LIMITS[Platform.INSTAGRAM]).toBe(2200)
  })
})

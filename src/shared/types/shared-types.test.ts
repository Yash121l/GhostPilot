import { describe, it, expect } from 'vitest'
import { Platform, PLATFORMS, PLATFORM_LABELS, PLATFORM_CHAR_LIMITS } from './platform'
import { AITask, ModelHint } from './ai'
import { PostStatus } from './post'

describe('Platform', () => {
  it('has all expected platforms', () => {
    expect(Platform.LINKEDIN).toBe('linkedin')
    expect(Platform.TWITTER).toBe('twitter')
    expect(Platform.INSTAGRAM).toBe('instagram')
  })

  it('PLATFORMS array contains all platforms', () => {
    expect(PLATFORMS).toHaveLength(3)
    expect(PLATFORMS).toContain(Platform.LINKEDIN)
    expect(PLATFORMS).toContain(Platform.TWITTER)
    expect(PLATFORMS).toContain(Platform.INSTAGRAM)
  })

  it('PLATFORM_LABELS has an entry for every platform', () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_LABELS[p]).toBeTypeOf('string')
    }
  })

  it('PLATFORM_CHAR_LIMITS has positive limits for every platform', () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_CHAR_LIMITS[p]).toBeGreaterThan(0)
    }
  })

  it('Twitter limit is 280', () => {
    expect(PLATFORM_CHAR_LIMITS[Platform.TWITTER]).toBe(280)
  })
})

describe('AITask', () => {
  it('has expected task keys', () => {
    expect(AITask.DRAFT_POST).toBe('draft_post')
    expect(AITask.ADAPT_VARIANT).toBe('adapt_variant')
    expect(AITask.MODERATION).toBe('moderation')
  })
})

describe('ModelHint', () => {
  it('has economy, premium, local hints', () => {
    expect(ModelHint.ECONOMY).toBe('economy')
    expect(ModelHint.PREMIUM).toBe('premium')
    expect(ModelHint.LOCAL).toBe('local')
  })
})

describe('PostStatus', () => {
  it('has full lifecycle states', () => {
    expect(PostStatus.DRAFT).toBe('draft')
    expect(PostStatus.PUBLISHED).toBe('published')
    expect(PostStatus.FAILED).toBe('failed')
    expect(PostStatus.ARCHIVED).toBe('archived')
  })
})

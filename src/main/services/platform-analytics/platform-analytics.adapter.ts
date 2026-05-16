import type {
  HashtagInsight,
  PlatformAccountSummary,
  PlatformPostInsight
} from '../../../shared/ipc-types'
import type { Platform } from '../../../shared/types/platform'

export interface PlatformAnalyticsAdapter {
  platform: Platform
  summary(): Promise<Partial<PlatformAccountSummary>>
  topPosts(window: '24h' | '7d' | '30d'): Promise<PlatformPostInsight[]>
  hashtags(tag?: string): Promise<HashtagInsight>
}

export function unavailableSummary(
  platform: Platform,
  reason: string
): Partial<PlatformAccountSummary> {
  return {
    platform,
    accountId: platform,
    displayName: platform,
    fetchedAt: new Date().toISOString(),
    unavailableReason: reason
  }
}

export function unavailableHashtag(
  platform: Platform,
  tag: string | undefined,
  reason: string
): HashtagInsight {
  return {
    platform,
    tag: tag ?? '',
    fetchedAt: new Date().toISOString(),
    unavailableReason: reason
  }
}

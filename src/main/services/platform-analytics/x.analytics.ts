import { Platform } from '../../../shared/types/platform'
import type {
  HashtagInsight,
  PlatformAccountSummary,
  PlatformPostInsight
} from '../../../shared/ipc-types'
import {
  unavailableHashtag,
  unavailableSummary,
  type PlatformAnalyticsAdapter
} from './platform-analytics.adapter'

const REASON =
  'X post metrics require X API v2 access with user-authenticated metrics permissions for impressions, clicks, and engagement data.'

export class XAnalyticsAdapter implements PlatformAnalyticsAdapter {
  platform = Platform.TWITTER

  async summary(): Promise<Partial<PlatformAccountSummary>> {
    return unavailableSummary(this.platform, REASON)
  }

  async topPosts(): Promise<PlatformPostInsight[]> {
    return []
  }

  async hashtags(tag?: string): Promise<HashtagInsight> {
    return unavailableHashtag(this.platform, tag, REASON)
  }
}

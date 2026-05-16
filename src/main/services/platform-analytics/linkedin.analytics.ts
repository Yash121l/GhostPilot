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
  'LinkedIn analytics require approved Community Management API access and organization/share statistics scopes.'

export class LinkedInAnalyticsAdapter implements PlatformAnalyticsAdapter {
  platform = Platform.LINKEDIN

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

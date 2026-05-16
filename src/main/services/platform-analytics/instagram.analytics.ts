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
  'Instagram Insights require a business or creator account plus approved Meta permissions for account and media insights.'

export class InstagramAnalyticsAdapter implements PlatformAnalyticsAdapter {
  platform = Platform.INSTAGRAM

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

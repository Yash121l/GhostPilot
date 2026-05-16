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
  'Threads Insights require Meta Threads permissions for own-post and user-level metrics. Threads is not enabled as a GhostPilot publishing platform yet.'

export class ThreadsAnalyticsAdapter implements PlatformAnalyticsAdapter {
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

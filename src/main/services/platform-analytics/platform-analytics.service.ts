import { Platform, PLATFORMS } from '../../../shared/types/platform'
import { PostStatus } from '../../../shared/types/post'
import { getRawDb } from '../../infrastructure/db/connection'
import type {
  HashtagInsight,
  PlatformAccountSummary,
  PlatformPostInsight
} from '../../../shared/ipc-types'
import type { OAuthManager } from '../social/oauth-manager'
import type { PostService } from '../post/post.service'
import { InstagramAnalyticsAdapter } from './instagram.analytics'
import { LinkedInAnalyticsAdapter } from './linkedin.analytics'
import type { PlatformAnalyticsAdapter } from './platform-analytics.adapter'
import { XAnalyticsAdapter } from './x.analytics'

export class PlatformAnalyticsService {
  private readonly adapters: PlatformAnalyticsAdapter[] = [
    new LinkedInAnalyticsAdapter(),
    new XAnalyticsAdapter(),
    new InstagramAnalyticsAdapter()
  ]

  constructor(
    private readonly oauthManager: OAuthManager,
    private readonly postService: PostService
  ) {}

  private adapterFor(platform: Platform): PlatformAnalyticsAdapter | undefined {
    return this.adapters.find((adapter) => adapter.platform === platform)
  }

  async summary(): Promise<PlatformAccountSummary[]> {
    const statuses = await this.oauthManager.getStatus()
    const posts = await this.postService.list({ limit: 500 })
    const now = new Date().toISOString()

    return Promise.all(
      PLATFORMS.map(async (platform) => {
        const apiSummary = await this.adapterFor(platform)?.summary()
        const status = statuses.find((item) => item.platform === platform)
        const published = posts.filter(
          (post) => post.status === PostStatus.PUBLISHED && post.platforms.includes(platform)
        )
        return {
          platform,
          accountId: status?.displayName || apiSummary?.accountId || platform,
          displayName: status?.displayName || apiSummary?.displayName || platform,
          posts: published.length,
          fetchedAt: now,
          unavailableReason: status?.connected
            ? apiSummary?.unavailableReason
            : 'Connect this account to collect analytics.'
        }
      })
    )
  }

  async topPosts(
    platform?: Platform,
    window: '24h' | '7d' | '30d' = '24h'
  ): Promise<PlatformPostInsight[]> {
    const posts = await this.postService.list({ limit: 500 })
    const cutoffMs =
      window === '24h'
        ? 24 * 60 * 60 * 1000
        : window === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000
    const since = Date.now() - cutoffMs
    return posts
      .filter((post) => post.status === PostStatus.PUBLISHED)
      .filter((post) => !platform || post.platforms.includes(platform))
      .filter((post) => (post.publishedAt ? new Date(post.publishedAt).getTime() >= since : true))
      .slice(0, 20)
      .map((post) => ({
        platform: (platform ?? post.platforms[0] ?? Platform.LINKEDIN) as Platform,
        externalId: post.id,
        bodyPreview: post.body.slice(0, 140) || '(empty)',
        publishedAt: post.publishedAt?.toISOString(),
        fetchedAt: new Date().toISOString()
      }))
  }

  async hashtags(platform?: Platform, tag?: string): Promise<HashtagInsight[]> {
    const targets = platform ? [platform] : PLATFORMS
    return Promise.all(
      targets.map(async (p) => {
        const adapterResult = await this.adapterFor(p)?.hashtags(tag)
        return (
          adapterResult ?? {
            platform: p,
            tag: tag ?? '',
            fetchedAt: new Date().toISOString(),
            unavailableReason:
              'Hashtag discovery depends on platform-specific search/insights permissions and is unavailable until the connected account grants those scopes.'
          }
        )
      })
    )
  }

  async sync(): Promise<void> {
    const db = getRawDb()
    const now = Date.now()
    const summaries = await this.summary()
    const topPosts = await this.topPosts(undefined, '30d')
    const hashtags = await this.hashtags()

    const insertSummary = db.prepare(`
      INSERT INTO platform_account_snapshots (
        id, platform, account_id, display_name, followers, following, posts,
        impressions, views, likes, comments, shares, clicks, fetched_at, unavailable_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertPost = db.prepare(`
      INSERT INTO platform_post_insights (
        id, platform, external_id, url, body_preview, published_at, impressions,
        views, likes, comments, shares, saves, clicks, engagement_rate, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertHashtag = db.prepare(`
      INSERT INTO platform_hashtag_insights (
        id, platform, tag, post_count, top_posts_json, recent_posts_json, fetched_at, unavailable_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    db.transaction(() => {
      for (const item of summaries) {
        insertSummary.run(
          `${item.platform}:${item.accountId}:${now}`,
          item.platform,
          item.accountId,
          item.displayName,
          item.followers ?? null,
          item.following ?? null,
          item.posts ?? null,
          item.impressions ?? null,
          item.views ?? null,
          item.likes ?? null,
          item.comments ?? null,
          item.shares ?? null,
          item.clicks ?? null,
          new Date(item.fetchedAt).getTime(),
          item.unavailableReason ?? null
        )
      }
      for (const item of topPosts) {
        insertPost.run(
          `${item.platform}:${item.externalId}:${now}`,
          item.platform,
          item.externalId,
          item.url ?? null,
          item.bodyPreview,
          item.publishedAt ? new Date(item.publishedAt).getTime() : null,
          item.impressions ?? null,
          item.views ?? null,
          item.likes ?? null,
          item.comments ?? null,
          item.shares ?? null,
          item.saves ?? null,
          item.clicks ?? null,
          item.engagementRate ?? null,
          new Date(item.fetchedAt).getTime()
        )
      }
      for (const item of hashtags) {
        insertHashtag.run(
          `${item.platform}:${item.tag || 'default'}:${now}`,
          item.platform,
          item.tag,
          item.postCount ?? null,
          JSON.stringify(item.topPosts ?? []),
          JSON.stringify(item.recentPosts ?? []),
          new Date(item.fetchedAt).getTime(),
          item.unavailableReason ?? null
        )
      }
    })()
  }
}

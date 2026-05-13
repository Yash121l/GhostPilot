import type {
  SocialConnector,
  ConnectionResult,
  OAuthTokens,
  PreparedPost,
  PublishResult,
  AnalyticsData,
  RateLimitState,
  PlatformEvent,
} from './interface'
import { Platform } from '../../../shared/types/platform'
import { createLogger } from '../../infrastructure/logger/logger'

const logger = createLogger('InstagramConnector')

const APP_ID = process.env['META_APP_ID'] ?? ''
const APP_SECRET = process.env['META_APP_SECRET'] ?? ''
const REDIRECT_URI = 'ghostpilot://oauth/callback'
const GRAPH = 'https://graph.facebook.com/v20.0'

// Instagram limits: 50 API-triggered posts per 24h window; 160 DMs per hour
const POST_LIMIT_24H = 50
const DM_LIMIT_1H = 160

export class InstagramConnector implements SocialConnector {
  readonly platform = Platform.INSTAGRAM

  private _postRate = {
    remaining: POST_LIMIT_24H,
    limit: POST_LIMIT_24H,
    resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }

  private _dmRate = {
    remaining: DM_LIMIT_1H,
    limit: DM_LIMIT_1H,
    resetsAt: new Date(Date.now() + 60 * 60 * 1000),
  }

  // Track subscribed webhook intervals for cleanup
  private _pollIntervals: NodeJS.Timeout[] = []

  // ─── OAuth ──────────────────────────────────────────────────────────────────

  getAuthURL(state: string, _codeVerifier: string): string {
    const params = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      scope: [
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_comments',
        'instagram_manage_messages',
        'pages_show_list',
        'pages_manage_metadata',
      ].join(','),
      response_type: 'code',
      state,
    })
    return `https://www.facebook.com/dialog/oauth?${params}`
  }

  async handleCallback(code: string, _codeVerifier: string): Promise<ConnectionResult> {
    // Exchange short-lived code for short-lived token
    const shortRes = await this.gfetch('/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: REDIRECT_URI, code }),
    })
    if (!shortRes.ok) throw new Error(`Instagram token exchange failed: ${await shortRes.text()}`)
    const shortData = (await shortRes.json()) as { access_token: string }

    // Exchange for long-lived (60-day) token
    const longRes = await this.gfetch(
      `/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortData.access_token}`,
    )
    if (!longRes.ok) throw new Error(`Instagram long-lived token exchange failed: ${await longRes.text()}`)
    const longData = (await longRes.json()) as { access_token: string; expires_in?: number }

    const profileRes = await this.gfetch(`/me?fields=id,name&access_token=${longData.access_token}`)
    const profile = (await profileRes.json()) as { id: string; name: string }

    return {
      platformUserId: profile.id,
      displayName: profile.name,
      tokens: {
        accessToken: longData.access_token,
        expiresAt: longData.expires_in
          ? new Date(Date.now() + longData.expires_in * 1000)
          : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments'],
      },
    }
  }

  async refreshTokens(accessToken: string): Promise<OAuthTokens> {
    // Long-lived tokens are refreshed by calling the refresh endpoint
    const res = await this.gfetch(
      `/oauth/access_token?grant_type=ig_refresh_token&access_token=${accessToken}`,
    )
    if (!res.ok) throw new Error(`Instagram token refresh failed: ${await res.text()}`)
    const data = (await res.json()) as { access_token: string; expires_in: number }
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: ['instagram_basic', 'instagram_content_publish'],
    }
  }

  async revokeConnection(tokens: OAuthTokens): Promise<void> {
    // Best-effort — deauth the app
    await fetch(`${GRAPH}/me/permissions?access_token=${tokens.accessToken}`, { method: 'DELETE' })
  }

  // ─── Publishing ─────────────────────────────────────────────────────────────

  async publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult> {
    const rl = this.rateLimitState()
    if (rl.exceeded) {
      throw new Error(`Instagram post rate limit exceeded — resets at ${rl.resetsAt.toLocaleTimeString()}`)
    }

    const igId = await this.getIgBusinessId(tokens.accessToken)

    // Carousel if multiple images
    if (post.carouselItems?.length && post.carouselItems.length > 1) {
      return this.publishCarousel(igId, post, tokens)
    }

    // Single image or caption-only
    const containerParams: Record<string, string> = {
      caption: post.body,
      access_token: tokens.accessToken,
    }

    if (post.mediaUrls?.[0]) {
      containerParams['image_url'] = post.mediaUrls[0]
      containerParams['media_type'] = 'IMAGE'
    } else {
      // Caption-only (allowed for Business accounts with linked Facebook page)
      containerParams['media_type'] = 'IMAGE'
    }

    const containerRes = await this.gfetch(`/${igId}/media`, {
      method: 'POST',
      body: new URLSearchParams(containerParams),
    })
    if (!containerRes.ok) throw new Error(`Instagram container creation failed: ${await containerRes.text()}`)
    const container = (await containerRes.json()) as { id: string }

    // Wait for container to be ready
    await this.pollContainerStatus(container.id, tokens.accessToken)

    const publishRes = await this.gfetch(`/${igId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: container.id, access_token: tokens.accessToken }),
    })
    if (!publishRes.ok) throw new Error(`Instagram publish failed: ${await publishRes.text()}`)
    const published = (await publishRes.json()) as { id: string }

    this.decrementPostRate()
    logger.info({ msg: 'Instagram post published', id: published.id })
    return { externalId: published.id, url: `https://www.instagram.com/p/${published.id}` }
  }

  /** Publish an Instagram carousel (up to 10 items). */
  private async publishCarousel(
    igId: string,
    post: PreparedPost,
    tokens: OAuthTokens,
  ): Promise<PublishResult> {
    const items = post.carouselItems!.slice(0, 10)
    const childIds: string[] = []

    for (const item of items) {
      const childRes = await this.gfetch(`/${igId}/media`, {
        method: 'POST',
        body: new URLSearchParams({
          image_url: item.imageUrl,
          media_type: 'IMAGE',
          is_carousel_item: 'true',
          access_token: tokens.accessToken,
          ...(item.caption ? { caption: item.caption } : {}),
        }),
      })
      if (!childRes.ok) {
        logger.warn({ msg: 'Carousel child creation failed', error: await childRes.text() })
        continue
      }
      const child = (await childRes.json()) as { id: string }
      await this.pollContainerStatus(child.id, tokens.accessToken)
      childIds.push(child.id)
    }

    if (!childIds.length) throw new Error('No carousel children could be uploaded')

    const carouselRes = await this.gfetch(`/${igId}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: post.body,
        access_token: tokens.accessToken,
      }),
    })
    if (!carouselRes.ok) throw new Error(`Instagram carousel container failed: ${await carouselRes.text()}`)
    const carousel = (await carouselRes.json()) as { id: string }

    await this.pollContainerStatus(carousel.id, tokens.accessToken)

    const publishRes = await this.gfetch(`/${igId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: carousel.id, access_token: tokens.accessToken }),
    })
    if (!publishRes.ok) throw new Error(`Instagram carousel publish failed: ${await publishRes.text()}`)
    const published = (await publishRes.json()) as { id: string }

    this.decrementPostRate()
    return {
      externalId: published.id,
      url: `https://www.instagram.com/p/${published.id}`,
      extras: { carouselItems: childIds.length },
    }
  }

  async deletePost(externalId: string, tokens: OAuthTokens): Promise<void> {
    const res = await this.gfetch(`/${externalId}?access_token=${tokens.accessToken}`, {
      method: 'DELETE',
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`Instagram delete failed (${res.status}): ${await res.text()}`)
    }
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async fetchAnalytics(externalId: string, tokens: OAuthTokens): Promise<AnalyticsData> {
    const metrics = 'impressions,reach,likes,comments,shares,saved,profile_visits'
    const res = await this.gfetch(
      `/${externalId}/insights?metric=${metrics}&period=lifetime&access_token=${tokens.accessToken}`,
    )

    if (!res.ok) {
      logger.warn({ msg: 'Instagram analytics fetch failed', status: res.status })
      return this.emptyAnalytics(externalId)
    }

    const data = (await res.json()) as { data: { name: string; values: { value: number }[] }[] }
    const byName = Object.fromEntries(data.data.map((d) => [d.name, d.values[0]?.value ?? 0]))

    return {
      externalId,
      impressions: byName['impressions'] ?? 0,
      likes: byName['likes'] ?? 0,
      comments: byName['comments'] ?? 0,
      shares: byName['shares'] ?? 0,
      clicks: byName['profile_visits'] ?? 0,
      fetchedAt: new Date(),
    }
  }

  // ─── Events (comments + DM webhook via polling) ──────────────────────────────

  async subscribeEvents(
    tokens: OAuthTokens,
    onEvent: (event: PlatformEvent) => void,
  ): Promise<() => void> {
    const igId = await this.getIgBusinessId(tokens.accessToken).catch(() => null)
    if (!igId) return () => {}

    let lastCommentTs = Date.now()

    const commentInterval = setInterval(async () => {
      try {
        const since = Math.floor(lastCommentTs / 1000)
        const res = await this.gfetch(
          `/${igId}/mentioned_media?fields=id,comments{id,text,from,timestamp},timestamp&since=${since}&access_token=${tokens.accessToken}`,
        )
        if (!res.ok) return

        const data = (await res.json()) as {
          data: {
            id: string
            comments?: { data: { id: string; text: string; from?: { id: string; username: string }; timestamp: string }[] }
          }[]
        }

        for (const media of data.data) {
          for (const comment of media.comments?.data ?? []) {
            const ts = new Date(comment.timestamp).getTime()
            if (ts > lastCommentTs) {
              onEvent({
                type: 'comment',
                platformEventId: comment.id,
                fromUserId: comment.from?.id ?? '',
                fromDisplayName: comment.from?.username ?? 'Unknown',
                content: comment.text,
                parentPostId: media.id,
                receivedAt: new Date(comment.timestamp),
              })
              lastCommentTs = Math.max(lastCommentTs, ts)
            }
          }
        }
      } catch (e) {
        logger.warn({ msg: 'Instagram comment poll failed', error: String(e) })
      }
    }, 60_000) // poll every 60s

    this._pollIntervals.push(commentInterval)

    return () => {
      clearInterval(commentInterval)
      this._pollIntervals = this._pollIntervals.filter((i) => i !== commentInterval)
    }
  }

  rateLimitState(): RateLimitState {
    const now = Date.now()

    if (now > this._postRate.resetsAt.getTime()) {
      this._postRate = {
        remaining: POST_LIMIT_24H,
        limit: POST_LIMIT_24H,
        resetsAt: new Date(now + 24 * 60 * 60 * 1000),
      }
    }

    return {
      platform: this.platform,
      remaining: this._postRate.remaining,
      limit: this._postRate.limit,
      resetsAt: this._postRate.resetsAt,
      exceeded: this._postRate.remaining <= 0,
    }
  }

  // ─── DM funnel ───────────────────────────────────────────────────────────────

  /** Send a Messenger DM to a Facebook user ID (Instagram DM funnel). */
  async sendDM(recipientId: string, message: string, pageAccessToken: string): Promise<void> {
    if (this._dmRate.remaining <= 0) {
      throw new Error(`Instagram DM rate limit exceeded — ${DM_LIMIT_1H}/hour hard cap reached`)
    }

    const res = await this.gfetch('/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: pageAccessToken,
      }),
    })

    if (!res.ok) throw new Error(`Instagram DM send failed: ${await res.text()}`)

    // Update DM rate
    const now = Date.now()
    if (now > this._dmRate.resetsAt.getTime()) {
      this._dmRate = { remaining: DM_LIMIT_1H, limit: DM_LIMIT_1H, resetsAt: new Date(now + 60 * 60 * 1000) }
    }
    this._dmRate.remaining = Math.max(0, this._dmRate.remaining - 1)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async getIgBusinessId(accessToken: string): Promise<string> {
    const pagesRes = await this.gfetch(`/me/accounts?access_token=${accessToken}`)
    if (!pagesRes.ok) throw new Error('Failed to fetch Facebook Pages')
    const pages = (await pagesRes.json()) as { data: { id: string; access_token: string }[] }
    if (!pages.data.length) throw new Error('No linked Facebook Pages found')

    const pageId = pages.data[0].id
    const igRes = await this.gfetch(
      `/${pageId}?fields=instagram_business_account&access_token=${pages.data[0].access_token}`,
    )
    const igData = (await igRes.json()) as { instagram_business_account?: { id: string } }
    const igId = igData.instagram_business_account?.id
    if (!igId) throw new Error('No Instagram Business account linked to Facebook Page')
    return igId
  }

  /** Poll until the media container is ready (FINISHED status). */
  private async pollContainerStatus(containerId: string, accessToken: string): Promise<void> {
    const maxAttempts = 15
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const res = await this.gfetch(
        `/${containerId}?fields=status_code,status&access_token=${accessToken}`,
      )
      if (!res.ok) continue
      const data = (await res.json()) as { status_code?: string; status?: string }
      if (data.status_code === 'FINISHED') return
      if (data.status_code === 'ERROR' || data.status === 'ERROR') {
        throw new Error(`Instagram container error: ${JSON.stringify(data)}`)
      }
    }
    throw new Error('Instagram container did not become ready in time')
  }

  private decrementPostRate(): void {
    this._postRate.remaining = Math.max(0, this._postRate.remaining - 1)
  }

  private emptyAnalytics(externalId: string): AnalyticsData {
    return { externalId, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, fetchedAt: new Date() }
  }

  private gfetch(path: string, init?: RequestInit): Promise<Response> {
    const url = path.startsWith('http') ? path : `${GRAPH}${path}`
    return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  }
}

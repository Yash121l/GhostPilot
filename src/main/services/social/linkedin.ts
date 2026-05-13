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

const logger = createLogger('LinkedInConnector')

const CLIENT_ID = process.env['LINKEDIN_CLIENT_ID'] ?? ''
const CLIENT_SECRET = process.env['LINKEDIN_CLIENT_SECRET'] ?? ''
const REDIRECT_URI = 'ghostpilot://oauth/callback'

// LinkedIn REST API v202404+
const API_BASE = 'https://api.linkedin.com'
const SCOPES = ['openid', 'profile', 'w_member_social', 'r_basicprofile']

// LinkedIn rate limits: 500 API calls / day per member token (approximate)
const DAILY_LIMIT = 500
const WINDOW_MS = 24 * 60 * 60 * 1000

export class LinkedInConnector implements SocialConnector {
  readonly platform = Platform.LINKEDIN

  private _rateLimit: { remaining: number; limit: number; resetsAt: Date } = {
    remaining: DAILY_LIMIT,
    limit: DAILY_LIMIT,
    resetsAt: new Date(Date.now() + WINDOW_MS),
  }

  // ─── OAuth ──────────────────────────────────────────────────────────────────

  getAuthURL(state: string, _codeVerifier: string): string {
    // LinkedIn uses standard OAuth 2.0 (PKCE not supported as of 2024)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state,
      scope: SCOPES.join(' '),
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`
  }

  async handleCallback(code: string, _codeVerifier: string): Promise<ConnectionResult> {
    const res = await this.fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }).toString(),
    })

    if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${await res.text()}`)

    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      scope: string
      refresh_token?: string
      refresh_token_expires_in?: number
    }

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(' '),
    }

    const profile = await this.getUserInfo(data.access_token)
    return { platformUserId: profile.sub, displayName: profile.name ?? 'LinkedIn User', tokens }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    // LinkedIn supports refresh tokens for members who granted the refresh_token scope
    const res = await this.fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }).toString(),
    })

    if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${await res.text()}`)

    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
      scope: string
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(' '),
    }
  }

  async revokeConnection(tokens: OAuthTokens): Promise<void> {
    // LinkedIn doesn't have a revoke endpoint for member tokens; best-effort log
    logger.info({ msg: 'LinkedIn connection revoked (local only)', token_prefix: tokens.accessToken.slice(0, 8) })
  }

  // ─── Publishing ─────────────────────────────────────────────────────────────

  async publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult> {
    this.decrementRate()

    const authorUrn = await this.getMemberUrn(tokens.accessToken)

    // Build the post body for the new LinkedIn REST API (/rest/posts)
    const body: Record<string, unknown> = {
      author: authorUrn,
      commentary: post.body,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    // Attach media if provided
    if (post.mediaUrls?.length) {
      const uploadedAssets = await this.uploadImages(post.mediaUrls, tokens.accessToken, authorUrn)
      body['content'] = {
        media: {
          title: '',
          id: uploadedAssets[0],
        },
      }
    }

    const res = await this.fetch(`${API_BASE}/rest/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202404',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`LinkedIn publish failed (${res.status}): ${await res.text()}`)

    // The post URN is returned in the X-RestLi-Id header
    const postUrn = res.headers.get('x-restli-id') ?? res.headers.get('X-RestLi-Id') ?? ''
    const url = `https://www.linkedin.com/feed/update/${postUrn}`

    // Post first comment if provided
    if (post.firstComment) {
      await this.postFirstComment(postUrn, post.firstComment, tokens.accessToken, authorUrn)
    }

    logger.info({ msg: 'LinkedIn post published', postUrn, url })
    return { externalId: postUrn, url }
  }

  async deletePost(externalId: string, tokens: OAuthTokens): Promise<void> {
    this.decrementRate()
    const encodedUrn = encodeURIComponent(externalId)
    const res = await this.fetch(`${API_BASE}/rest/posts/${encodedUrn}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'LinkedIn-Version': '202404',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`LinkedIn delete failed (${res.status}): ${await res.text()}`)
    }
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async fetchAnalytics(externalId: string, tokens: OAuthTokens): Promise<AnalyticsData> {
    this.decrementRate()
    const encodedUrn = encodeURIComponent(externalId)
    const res = await this.fetch(
      `${API_BASE}/rest/socialActions/${encodedUrn}?fields=likesSummary,commentsSummary,sharesSummary`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'LinkedIn-Version': '202404',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    )

    if (!res.ok) {
      logger.warn({ msg: 'LinkedIn analytics fetch failed', status: res.status })
      return this.emptyAnalytics(externalId)
    }

    const data = (await res.json()) as {
      likesSummary?: { totalLikes: number }
      commentsSummary?: { totalFirstLevelComments: number }
      sharesSummary?: { totalShares: number }
    }

    // Impressions require the Analytics API (different scope — degrade gracefully)
    return {
      externalId,
      impressions: 0,
      likes: data.likesSummary?.totalLikes ?? 0,
      comments: data.commentsSummary?.totalFirstLevelComments ?? 0,
      shares: data.sharesSummary?.totalShares ?? 0,
      clicks: 0,
      fetchedAt: new Date(),
    }
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  async subscribeEvents(
    _tokens: OAuthTokens,
    _onEvent: (event: PlatformEvent) => void,
  ): Promise<() => void> {
    // LinkedIn webhooks require a verified Partner app; poll-based fallback not practical
    // Return a no-op unsubscribe
    logger.info({ msg: 'LinkedIn event subscription skipped — requires Partner app' })
    return () => {}
  }

  rateLimitState(): RateLimitState {
    // Reset window if expired
    if (Date.now() > this._rateLimit.resetsAt.getTime()) {
      this._rateLimit = {
        remaining: DAILY_LIMIT,
        limit: DAILY_LIMIT,
        resetsAt: new Date(Date.now() + WINDOW_MS),
      }
    }
    return {
      platform: this.platform,
      remaining: this._rateLimit.remaining,
      limit: this._rateLimit.limit,
      resetsAt: this._rateLimit.resetsAt,
      exceeded: this._rateLimit.remaining <= 0,
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async getUserInfo(accessToken: string): Promise<{ sub: string; name: string }> {
    const res = await this.fetch(`${API_BASE}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.json() as Promise<{ sub: string; name: string }>
  }

  private async getMemberUrn(accessToken: string): Promise<string> {
    const profile = await this.getUserInfo(accessToken)
    return `urn:li:person:${profile.sub}`
  }

  private async postFirstComment(
    postUrn: string,
    comment: string,
    accessToken: string,
    authorUrn: string,
  ): Promise<void> {
    try {
      const encodedUrn = encodeURIComponent(postUrn)
      await this.fetch(`${API_BASE}/rest/socialActions/${encodedUrn}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202404',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          actor: authorUrn,
          object: postUrn,
          message: { text: comment },
        }),
      })
    } catch (e) {
      // First comment failure is non-fatal
      logger.warn({ msg: 'LinkedIn first comment failed', error: String(e) })
    }
  }

  private async uploadImages(
    imageUrls: string[],
    accessToken: string,
    authorUrn: string,
  ): Promise<string[]> {
    const assetUrns: string[] = []

    for (const imageUrl of imageUrls.slice(0, 20)) {
      try {
        // Step 1: Register upload
        const registerRes = await this.fetch(`${API_BASE}/rest/images?action=initializeUpload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'LinkedIn-Version': '202404',
          },
          body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
        })

        if (!registerRes.ok) continue
        const registerData = (await registerRes.json()) as {
          value: { uploadUrl: string; image: string }
        }

        // Step 2: Upload binary
        const imageRes = await fetch(imageUrl)
        const blob = await imageRes.arrayBuffer()
        await fetch(registerData.value.uploadUrl, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/jpeg' },
          body: blob,
        })

        assetUrns.push(registerData.value.image)
      } catch (e) {
        logger.warn({ msg: 'LinkedIn image upload failed', url: imageUrl, error: String(e) })
      }
    }

    return assetUrns
  }

  private decrementRate(): void {
    const state = this.rateLimitState()
    if (state.exceeded) throw new Error('LinkedIn rate limit exceeded — try again tomorrow')
    this._rateLimit.remaining = Math.max(0, this._rateLimit.remaining - 1)
  }

  private emptyAnalytics(externalId: string): AnalyticsData {
    return { externalId, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, fetchedAt: new Date() }
  }

  private fetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  }
}

import { createHash, createHmac } from 'crypto'
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

const logger = createLogger('XTwitterConnector')

// Read at call time so .env loaded in main/index.ts is always picked up
const clientId = (): string => process.env['TWITTER_CLIENT_ID'] ?? ''
const clientSecret = (): string => process.env['TWITTER_CLIENT_SECRET'] ?? ''
const consumerKey = (): string => process.env['TWITTER_CONSUMER_KEY'] ?? ''
const consumerSecret = (): string => process.env['TWITTER_CONSUMER_SECRET'] ?? ''

const API_V2 = 'https://api.twitter.com/2'
const _API_V1 = 'https://api.twitter.com/1.1'
const UPLOAD_API = 'https://upload.twitter.com/1.1'

// X Basic tier: 100 user tweets per 24-hour rolling window per user
const DAILY_TWEET_LIMIT = 100
const WINDOW_MS = 24 * 60 * 60 * 1000

export class XTwitterConnector implements SocialConnector {
  readonly platform = Platform.TWITTER

  private _rateLimit = {
    remaining: DAILY_TWEET_LIMIT,
    limit: DAILY_TWEET_LIMIT,
    resetsAt: new Date(Date.now() + WINDOW_MS),
  }

  // ─── OAuth 2.0 PKCE ─────────────────────────────────────────────────────────

  getAuthURL(state: string, codeVerifier: string, redirectUri: string): string {
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId(),
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: 'tweet.read tweet.write tweet.moderate.write users.read offline.access',
    })
    return `https://twitter.com/i/oauth2/authorize?${params}`
  }

  async handleCallback(code: string, codeVerifier: string, redirectUri: string): Promise<ConnectionResult> {
    const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')
    const res = await this.fetch(`${API_V2}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    })

    if (!res.ok) throw new Error(`X token exchange failed: ${await res.text()}`)

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope: string
    }

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope.split(' '),
    }

    const profileRes = await this.fetch(`${API_V2}/users/me?user.fields=username,name`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    const profile = (await profileRes.json()) as { data: { id: string; name: string; username: string } }

    return {
      platformUserId: profile.data.id,
      displayName: `${profile.data.name} (@${profile.data.username})`,
      tokens,
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')
    const res = await this.fetch(`${API_V2}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
    })

    if (!res.ok) throw new Error(`X token refresh failed: ${await res.text()}`)

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope: string
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope.split(' '),
    }
  }

  async revokeConnection(tokens: OAuthTokens): Promise<void> {
    const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')
    await this.fetch(`${API_V2}/oauth2/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ token: tokens.accessToken }).toString(),
    })
  }

  // ─── Publishing ─────────────────────────────────────────────────────────────

  async publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult> {
    const rl = this.rateLimitState()
    if (rl.exceeded) {
      throw new Error(`X rate limit exceeded — resets at ${rl.resetsAt.toLocaleTimeString()}`)
    }

    // If threadParts provided, publish as thread; otherwise single tweet
    if (post.threadParts?.length && post.threadParts.length > 1) {
      return this.publishThread(post.threadParts, post.mediaUrls ?? [], tokens)
    }

    // Upload media if provided
    let mediaIds: string[] | undefined
    if (post.mediaUrls?.length) {
      mediaIds = await this.uploadMedia(post.mediaUrls, tokens)
    }

    const body: Record<string, unknown> = { text: post.body.slice(0, 280) }
    if (mediaIds?.length) body['media'] = { media_ids: mediaIds }

    const res = await this.fetch(`${API_V2}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    this.parseRateLimitHeaders(res.headers)
    if (!res.ok) throw new Error(`X publish failed (${res.status}): ${await res.text()}`)

    const data = (await res.json()) as { data: { id: string; text: string } }
    this.decrementRate()

    logger.info({ msg: 'Tweet published', id: data.data.id })
    return {
      externalId: data.data.id,
      url: `https://x.com/i/web/status/${data.data.id}`,
    }
  }

  /** Publish a thread by chaining tweets with reply_to. Returns the root tweet. */
  private async publishThread(
    parts: string[],
    _mediaUrls: string[],
    tokens: OAuthTokens,
  ): Promise<PublishResult> {
    let replyToId: string | undefined
    let rootResult: PublishResult | undefined

    for (const part of parts) {
      const body: Record<string, unknown> = { text: part.slice(0, 280) }
      if (replyToId) body['reply'] = { in_reply_to_tweet_id: replyToId }

      const res = await this.fetch(`${API_V2}/tweets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      this.parseRateLimitHeaders(res.headers)
      if (!res.ok) throw new Error(`X thread tweet failed (${res.status}): ${await res.text()}`)

      const data = (await res.json()) as { data: { id: string } }
      this.decrementRate()

      if (!replyToId) {
        rootResult = {
          externalId: data.data.id,
          url: `https://x.com/i/web/status/${data.data.id}`,
        }
      }
      replyToId = data.data.id
    }

    if (!rootResult) throw new Error('Thread had no parts')
    return rootResult
  }

  async deletePost(externalId: string, tokens: OAuthTokens): Promise<void> {
    const res = await this.fetch(`${API_V2}/tweets/${externalId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`X delete failed (${res.status}): ${await res.text()}`)
    }
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async fetchAnalytics(externalId: string, tokens: OAuthTokens): Promise<AnalyticsData> {
    const fields = 'public_metrics,non_public_metrics,organic_metrics'
    const res = await this.fetch(`${API_V2}/tweets/${externalId}?tweet.fields=${fields}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })

    if (!res.ok) {
      logger.warn({ msg: 'X analytics fetch failed', status: res.status })
      return this.emptyAnalytics(externalId)
    }

    const data = (await res.json()) as {
      data: {
        public_metrics?: { like_count: number; retweet_count: number; reply_count: number; impression_count: number }
        non_public_metrics?: { impression_count: number; url_link_clicks: number }
        organic_metrics?: { impression_count: number }
      }
    }

    const pub = data.data.public_metrics
    const priv = data.data.non_public_metrics

    return {
      externalId,
      impressions: priv?.impression_count ?? pub?.impression_count ?? 0,
      likes: pub?.like_count ?? 0,
      comments: pub?.reply_count ?? 0,
      shares: pub?.retweet_count ?? 0,
      clicks: priv?.url_link_clicks ?? 0,
      fetchedAt: new Date(),
    }
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  async subscribeEvents(
    _tokens: OAuthTokens,
    _onEvent: (event: PlatformEvent) => void,
  ): Promise<() => void> {
    // X Filtered Stream requires Elevated access — skip for Basic tier
    logger.info({ msg: 'X event subscription skipped — requires Elevated API access' })
    return () => {}
  }

  rateLimitState(): RateLimitState {
    if (Date.now() > this._rateLimit.resetsAt.getTime()) {
      this._rateLimit = {
        remaining: DAILY_TWEET_LIMIT,
        limit: DAILY_TWEET_LIMIT,
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

  // ─── Media upload (v1.1 — OAuth 1.0a required) ────────────────────────────

  private async uploadMedia(imageUrls: string[], tokens: OAuthTokens): Promise<string[]> {
    // Media upload uses v1.1 API with OAuth 1.0a if consumer creds available,
    // else fall back to user access token (works for simple image uploads)
    const mediaIds: string[] = []

    for (const url of imageUrls.slice(0, 4)) {
      try {
        const imgRes = await fetch(url)
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const b64 = buf.toString('base64')

        const authHeader = consumerKey()
          ? this.oauth1Header('POST', `${UPLOAD_API}/media/upload.json`, tokens)
          : `Bearer ${tokens.accessToken}`

        const uploadRes = await fetch(`${UPLOAD_API}/media/upload.json`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ media_data: b64 }).toString(),
        })

        if (!uploadRes.ok) {
          logger.warn({ msg: 'X media upload failed', status: uploadRes.status })
          continue
        }

        const data = (await uploadRes.json()) as { media_id_string: string }
        mediaIds.push(data.media_id_string)
      } catch (e) {
        logger.warn({ msg: 'X media upload error', error: String(e) })
      }
    }

    return mediaIds
  }

  /** Generate an OAuth 1.0a Authorization header for the given request. */
  private oauth1Header(method: string, url: string, tokens: OAuthTokens): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey(),
      oauth_nonce: Math.random().toString(36).slice(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: tokens.accessToken,
      oauth_version: '1.0',
    }

    const paramStr = Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const sigBase = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(paramStr)].join('&')
    const sigKey = `${encodeURIComponent(consumerSecret())}&${encodeURIComponent(tokens.refreshToken ?? '')}`
    const signature = createHmac('sha1', sigKey).update(sigBase).digest('base64')

    oauthParams['oauth_signature'] = signature

    const headerParts = Object.entries(oauthParams)
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(', ')

    return `OAuth ${headerParts}`
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private parseRateLimitHeaders(headers: Headers): void {
    const remaining = headers.get('x-user-limit-24hour-remaining')
    const limit = headers.get('x-user-limit-24hour-limit')
    const reset = headers.get('x-user-limit-24hour-reset')

    if (remaining !== null) this._rateLimit.remaining = parseInt(remaining, 10)
    if (limit !== null) this._rateLimit.limit = parseInt(limit, 10)
    if (reset !== null) this._rateLimit.resetsAt = new Date(parseInt(reset, 10) * 1000)
  }

  private decrementRate(): void {
    this._rateLimit.remaining = Math.max(0, this._rateLimit.remaining - 1)
  }

  private emptyAnalytics(externalId: string): AnalyticsData {
    return { externalId, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, fetchedAt: new Date() }
  }

  private fetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  }
}

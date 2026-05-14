import type { Platform } from '../../../shared/types/platform'

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes: string[]
}

export interface ConnectionResult {
  platformUserId: string
  displayName: string
  tokens: OAuthTokens
}

export interface CarouselItem {
  imageUrl: string
  caption?: string
}

export interface MediaBuffer {
  data: Buffer
  mimeType: string
  /** Original public URL — used by Instagram which requires HTTP URLs. */
  originalUrl?: string
}

export interface PreparedPost {
  body: string
  /** Public HTTP(S) URLs — used when local files are not available (e.g. Instagram). */
  mediaUrls?: string[]
  /** Raw file buffers — used for direct binary upload (LinkedIn, Twitter). */
  mediaBuffers?: MediaBuffer[]
  /** Sequential parts for a thread (X/Twitter). When set, publish as thread. */
  threadParts?: string[]
  /** Items for an Instagram carousel (up to 10). */
  carouselItems?: CarouselItem[]
  /** For LinkedIn: text to post as the first comment. */
  firstComment?: string
}

export interface PublishResult {
  externalId: string
  url: string
  extras?: Record<string, unknown>
}

export interface AnalyticsData {
  externalId: string
  impressions: number
  likes: number
  comments: number
  shares: number
  clicks: number
  fetchedAt: Date
}

export interface RateLimitState {
  platform: Platform
  remaining: number
  limit: number
  resetsAt: Date
  exceeded: boolean
}

export interface PlatformEvent {
  type: 'comment' | 'mention' | 'dm' | 'reaction'
  platformEventId: string
  fromUserId: string
  fromDisplayName: string
  content?: string
  parentPostId?: string
  receivedAt: Date
}

export interface SocialConnector {
  readonly platform: Platform

  /** Generate the OAuth authorization URL. `redirectUri` is the localhost callback URL. */
  getAuthURL(state: string, codeVerifier: string, redirectUri: string): string

  /** Exchange the callback code for tokens. `redirectUri` must match the one used in getAuthURL. */
  handleCallback(code: string, codeVerifier: string, redirectUri: string): Promise<ConnectionResult>

  /** Use a refresh token to get a new access token. */
  refreshTokens(refreshToken: string): Promise<OAuthTokens>

  /** Revoke the connection on the platform side (best-effort). */
  revokeConnection(tokens: OAuthTokens): Promise<void>

  /** Publish a post. Returns the platform post ID + URL. */
  publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult>

  /** Delete a previously published post. */
  deletePost(externalId: string, tokens: OAuthTokens): Promise<void>

  /** Fetch engagement analytics for a published post. */
  fetchAnalytics(externalId: string, tokens: OAuthTokens): Promise<AnalyticsData>

  /**
   * Subscribe to platform events (webhook or long-poll).
   * Returns an unsubscribe function.
   */
  subscribeEvents(tokens: OAuthTokens, onEvent: (event: PlatformEvent) => void): Promise<() => void>

  /** Current rate-limit window state (in-memory, updated on every API call). */
  rateLimitState(): RateLimitState
}

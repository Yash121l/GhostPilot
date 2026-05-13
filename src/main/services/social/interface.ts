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

export interface PreparedPost {
  body: string
  mediaUrls?: string[]
}

export interface PublishResult {
  externalId: string
  url: string
}

export interface SocialConnector {
  readonly platform: Platform

  /** Generate the OAuth authorization URL. */
  getAuthURL(state: string, codeVerifier: string): string

  /** Exchange the callback code for tokens. */
  handleCallback(code: string, codeVerifier: string): Promise<ConnectionResult>

  /** Use a refresh token to get a new access token. */
  refreshTokens(refreshToken: string): Promise<OAuthTokens>

  /** Publish a post. Returns the platform post ID + URL. */
  publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult>
}

import { createHash } from 'crypto'
import type { SocialConnector, ConnectionResult, OAuthTokens, PreparedPost, PublishResult } from './interface'
import { Platform } from '../../../shared/types/platform'

const CLIENT_ID = process.env['TWITTER_CLIENT_ID'] ?? ''
const CLIENT_SECRET = process.env['TWITTER_CLIENT_SECRET'] ?? ''
const REDIRECT_URI = 'ghostpilot://oauth/callback'

export class XTwitterConnector implements SocialConnector {
  readonly platform = Platform.TWITTER

  getAuthURL(state: string, codeVerifier: string): string {
    // Twitter uses OAuth 2.0 with PKCE
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: 'tweet.read tweet.write users.read offline.access',
    })
    return `https://twitter.com/i/oauth2/authorize?${params}`
  }

  async handleCallback(code: string, codeVerifier: string): Promise<ConnectionResult> {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    })

    if (!res.ok) {
      throw new Error(`X token exchange failed: ${await res.text()}`)
    }

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

    const profileRes = await fetch('https://api.twitter.com/2/users/me', {
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
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
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

  async publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult> {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: post.body.slice(0, 280) }),
    })

    if (!res.ok) {
      throw new Error(`X publish failed: ${await res.text()}`)
    }

    const data = (await res.json()) as { data: { id: string } }
    return {
      externalId: data.data.id,
      url: `https://x.com/i/web/status/${data.data.id}`,
    }
  }
}

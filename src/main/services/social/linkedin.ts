import { randomBytes } from 'crypto'
import type { SocialConnector, ConnectionResult, OAuthTokens, PreparedPost, PublishResult } from './interface'
import { Platform } from '../../../shared/types/platform'

const CLIENT_ID = process.env['LINKEDIN_CLIENT_ID'] ?? ''
const CLIENT_SECRET = process.env['LINKEDIN_CLIENT_SECRET'] ?? ''
const REDIRECT_URI = 'ghostpilot://oauth/callback'
const SCOPES = ['openid', 'profile', 'w_member_social']

export class LinkedInConnector implements SocialConnector {
  readonly platform = Platform.LINKEDIN

  getAuthURL(state: string, _codeVerifier: string): string {
    // LinkedIn uses standard OAuth 2.0 (not PKCE), but we include state for CSRF protection
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
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    })

    if (!res.ok) {
      throw new Error(`LinkedIn token exchange failed: ${await res.text()}`)
    }

    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      scope: string
    }

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope.split(','),
    }

    // Fetch user profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    const profile = (await profileRes.json()) as { sub: string; name: string }

    return {
      platformUserId: profile.sub,
      displayName: profile.name ?? 'LinkedIn User',
      tokens,
    }
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    // LinkedIn doesn't support refresh tokens for basic tier — re-auth required
    throw new Error('LinkedIn requires re-authentication to refresh tokens')
  }

  async publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult> {
    // First get the member URN
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    const profile = (await profileRes.json()) as { sub: string }
    const authorUrn = `urn:li:person:${profile.sub}`

    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.body },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`LinkedIn publish failed: ${await res.text()}`)
    }

    const postId = res.headers.get('x-restli-id') ?? nanoid()
    return {
      externalId: postId,
      url: `https://www.linkedin.com/feed/update/${postId}`,
    }
  }
}

function nanoid(): string {
  return randomBytes(8).toString('hex')
}

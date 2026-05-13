import type { SocialConnector, ConnectionResult, OAuthTokens, PreparedPost, PublishResult } from './interface'
import { Platform } from '../../../shared/types/platform'

const APP_ID = process.env['META_APP_ID'] ?? ''
const APP_SECRET = process.env['META_APP_SECRET'] ?? ''
const REDIRECT_URI = 'ghostpilot://oauth/callback'

export class InstagramConnector implements SocialConnector {
  readonly platform = Platform.INSTAGRAM

  getAuthURL(state: string, _codeVerifier: string): string {
    const params = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'instagram_basic,instagram_content_publish,instagram_manage_comments,pages_show_list',
      response_type: 'code',
      state,
    })
    return `https://www.facebook.com/dialog/oauth?${params}`
  }

  async handleCallback(code: string, _codeVerifier: string): Promise<ConnectionResult> {
    // Exchange code for short-lived token
    const res = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    })

    if (!res.ok) throw new Error(`Instagram token exchange failed: ${await res.text()}`)
    const data = (await res.json()) as { access_token: string; token_type: string }

    // Exchange for long-lived token
    const longRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${data.access_token}`,
    )
    const longData = (await longRes.json()) as { access_token: string; expires_in?: number }

    // Get user info
    const profileRes = await fetch(
      `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${longData.access_token}`,
    )
    const profile = (await profileRes.json()) as { id: string; name: string }

    return {
      platformUserId: profile.id,
      displayName: profile.name,
      tokens: {
        accessToken: longData.access_token,
        expiresAt: longData.expires_in ? new Date(Date.now() + longData.expires_in * 1000) : undefined,
        scopes: ['instagram_basic', 'instagram_content_publish'],
      },
    }
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('Instagram tokens are long-lived; re-authentication needed when they expire')
  }

  async publish(post: PreparedPost, tokens: OAuthTokens): Promise<PublishResult> {
    // Step 1: Get Instagram Business account ID
    const pagesRes = await fetch(
      `https://graph.facebook.com/v20.0/me/accounts?access_token=${tokens.accessToken}`,
    )
    const pages = (await pagesRes.json()) as { data: { id: string; access_token: string }[] }
    if (!pages.data.length) throw new Error('No linked Facebook Pages found')

    const page = pages.data[0]
    const igRes = await fetch(
      `https://graph.facebook.com/v20.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
    )
    const igData = (await igRes.json()) as { instagram_business_account?: { id: string } }
    const igId = igData.instagram_business_account?.id
    if (!igId) throw new Error('No Instagram Business account linked to Facebook Page')

    // Step 2: Create media container
    const containerRes = await fetch(`https://graph.facebook.com/v20.0/${igId}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        caption: post.body,
        media_type: 'IMAGE',
        ...(post.mediaUrls?.[0] ? { image_url: post.mediaUrls[0] } : {}),
        access_token: tokens.accessToken,
      }),
    })
    const container = (await containerRes.json()) as { id: string }

    // Step 3: Publish container
    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${igId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({
        creation_id: container.id,
        access_token: tokens.accessToken,
      }),
    })
    const published = (await publishRes.json()) as { id: string }

    return {
      externalId: published.id,
      url: `https://www.instagram.com/p/${published.id}`,
    }
  }
}

import { describe, it, expect, vi } from 'vitest'
import { Platform } from '../../../src/shared/types/platform'
import { mockTokens } from '../../helpers/mocks'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

const { LinkedInConnector } = await import('../../../src/main/services/social/linkedin')

describe('LinkedInConnector.getAuthURL()', () => {
  it('returns a valid LinkedIn OAuth URL', () => {
    process.env['LINKEDIN_CLIENT_ID'] = 'test-client-id'
    const connector = new LinkedInConnector()
    const url = connector.getAuthURL(
      'state-123',
      'verifier',
      'https://ghostpilot.yashlunawat.com/oauth/callback'
    )

    expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('state=state-123')
    expect(url).toContain('redirect_uri=')
  })

  it('encodes scopes with %20 not +', () => {
    process.env['LINKEDIN_CLIENT_ID'] = 'test-client-id'
    const connector = new LinkedInConnector()
    const url = connector.getAuthURL('state-abc', 'verifier', 'https://example.com/callback')

    // Scopes must be space-separated with %20, not +
    expect(url).toContain('scope=openid%20profile%20w_member_social')
    expect(url).not.toContain('scope=openid+profile')
  })

  it('includes all required scopes', () => {
    process.env['LINKEDIN_CLIENT_ID'] = 'test-client-id'
    const connector = new LinkedInConnector()
    const url = connector.getAuthURL('s', 'v', 'https://example.com/cb')

    expect(url).toContain('openid')
    expect(url).toContain('profile')
    expect(url).toContain('w_member_social')
  })

  it('URL-encodes the redirect URI', () => {
    process.env['LINKEDIN_CLIENT_ID'] = 'test-client-id'
    const connector = new LinkedInConnector()
    const redirectUri = 'https://ghostpilot.yashlunawat.com/oauth/callback'
    const url = connector.getAuthURL('s', 'v', redirectUri)

    expect(url).toContain(encodeURIComponent(redirectUri))
  })

  it('has platform = LINKEDIN', () => {
    const connector = new LinkedInConnector()
    expect(connector.platform).toBe(Platform.LINKEDIN)
  })
})

describe('LinkedInConnector.rateLimitState()', () => {
  it('returns initial state with full remaining', () => {
    const connector = new LinkedInConnector()
    const state = connector.rateLimitState()

    expect(state.platform).toBe(Platform.LINKEDIN)
    expect(state.remaining).toBe(500)
    expect(state.limit).toBe(500)
    expect(state.exceeded).toBe(false)
    expect(state.resetsAt).toBeInstanceOf(Date)
    expect(state.resetsAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('resets window when expired', () => {
    const connector = new LinkedInConnector()
    // Manually expire the window
    ;(connector as any)._rateLimit = {
      remaining: 0,
      limit: 500,
      resetsAt: new Date(Date.now() - 1000) // expired
    }

    const state = connector.rateLimitState()
    expect(state.remaining).toBe(500) // reset
    expect(state.exceeded).toBe(false)
  })

  it('reports exceeded when remaining is 0', () => {
    const connector = new LinkedInConnector()
    ;(connector as any)._rateLimit = {
      remaining: 0,
      limit: 500,
      resetsAt: new Date(Date.now() + 86400 * 1000) // not expired
    }

    const state = connector.rateLimitState()
    expect(state.exceeded).toBe(true)
  })
})

describe('LinkedInConnector.revokeConnection()', () => {
  it('resolves without error (no-op)', async () => {
    const connector = new LinkedInConnector()
    await expect(connector.revokeConnection(mockTokens())).resolves.toBeUndefined()
  })
})

describe('LinkedInConnector.subscribeEvents()', () => {
  it('returns an unsubscribe function without throwing', async () => {
    const connector = new LinkedInConnector()
    const unsub = await connector.subscribeEvents(mockTokens(), vi.fn())
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })
})

describe('LinkedInConnector.publish() — rate limit guard', () => {
  it('throws when rate limit is exceeded', async () => {
    const connector = new LinkedInConnector()
    ;(connector as any)._rateLimit = {
      remaining: 0,
      limit: 500,
      resetsAt: new Date(Date.now() + 86400 * 1000)
    }

    await expect(connector.publish({ body: 'test' }, mockTokens())).rejects.toThrow(
      'rate limit exceeded'
    )
  })
})

/**
 * Shared mock factories for GhostPilot tests.
 */
import { vi } from 'vitest'
import type { AuditService } from '../../src/main/application/audit/audit.service'
import type { AIGateway } from '../../src/main/services/ai-gateway/index'
import type {
  SocialConnector,
  OAuthTokens,
  ConnectionResult,
  PublishResult
} from '../../src/main/services/social/interface'
import { Platform } from '../../src/shared/types/platform'

// ─── Audit mock ───────────────────────────────────────────────────────────────

export function mockAudit(): AuditService {
  return {
    write: vi.fn(),
    query: vi.fn().mockResolvedValue([])
  } as unknown as AuditService
}

// ─── AI Gateway mock ──────────────────────────────────────────────────────────

export function mockAIGateway(overrides: Partial<AIGateway> = {}): AIGateway {
  return {
    complete: vi.fn().mockResolvedValue({
      text: 'Generated post content for testing purposes.',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      usage: { promptTokens: 100, completionTokens: 50, estimatedCostUsd: 0.001 }
    }),
    reload: vi.fn().mockResolvedValue(undefined),
    listKeys: vi.fn().mockResolvedValue([]),
    addKey: vi.fn(),
    deleteKey: vi.fn(),
    setDefault: vi.fn(),
    testKey: vi.fn().mockResolvedValue({ latencyMs: 120, model: 'gpt-4o-mini' }),
    ollamaStatus: vi.fn().mockResolvedValue({ available: false, models: [] }),
    ...overrides
  } as unknown as AIGateway
}

// ─── OAuth tokens ─────────────────────────────────────────────────────────────

export function mockTokens(overrides: Partial<OAuthTokens> = {}): OAuthTokens {
  return {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 3600 * 1000),
    scopes: ['openid', 'profile', 'w_member_social'],
    ...overrides
  }
}

// ─── Social connector mock ────────────────────────────────────────────────────

export function mockConnector(platform: Platform = Platform.LINKEDIN): SocialConnector {
  return {
    platform,
    getAuthURL: vi.fn().mockReturnValue(`https://example.com/oauth?platform=${platform}`),
    handleCallback: vi.fn().mockResolvedValue({
      platformUserId: 'user-123',
      displayName: 'Test User',
      tokens: mockTokens()
    } as ConnectionResult),
    refreshTokens: vi.fn().mockResolvedValue(mockTokens()),
    revokeConnection: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue({
      externalId: 'urn:li:share:123456',
      url: 'https://www.linkedin.com/feed/update/urn:li:share:123456'
    } as PublishResult),
    deletePost: vi.fn().mockResolvedValue(undefined),
    fetchAnalytics: vi.fn().mockResolvedValue({
      externalId: 'urn:li:share:123456',
      impressions: 0,
      likes: 5,
      comments: 2,
      shares: 1,
      clicks: 0,
      fetchedAt: new Date()
    }),
    subscribeEvents: vi.fn().mockResolvedValue(() => {}),
    rateLimitState: vi.fn().mockReturnValue({
      platform,
      remaining: 499,
      limit: 500,
      resetsAt: new Date(Date.now() + 86400 * 1000),
      exceeded: false
    })
  }
}

// ─── Keychain mock ────────────────────────────────────────────────────────────

export function mockKeychain() {
  const store = new Map<string, string>()
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve()
    }),
    delete: vi.fn((key: string) => {
      store.delete(key)
      return Promise.resolve()
    }),
    _store: store
  }
}

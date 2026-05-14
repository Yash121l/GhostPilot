import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestDb, clearTestDb, closeTestDb } from '../../helpers/db'
import { mockAudit, mockConnector } from '../../helpers/mocks'
import { Platform } from '../../../src/shared/types/platform'
import { ErrorCode } from '../../../src/shared/types/error'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}))

let db: ReturnType<typeof createTestDb>

vi.mock('../../../src/main/infrastructure/db/connection', () => ({
  getDb: () => db,
  getRawDb: () => { throw new Error('not available') },
}))

// vi.mock is hoisted above module-level declarations, so use vi.hoisted() to
// define keychainStore before the factory runs. vi.fn() is available here.
const keychainStore = vi.hoisted(() => {
  const store = new Map<string, string>()
  const get = vi.fn((key: string) => Promise.resolve(store.get(key) ?? null))
  const set = vi.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve() })
  const del = vi.fn((key: string) => { store.delete(key); return Promise.resolve() })
  return { get, set, delete: del, _store: store }
})
vi.mock('../../../src/main/infrastructure/keychain/keychain.service', () => ({
  KeychainService: class {
    get = keychainStore.get
    set = keychainStore.set
    delete = keychainStore.delete
  },
}))

const { OAuthManager } = await import('../../../src/main/services/social/oauth-manager')

beforeAll(() => { db = createTestDb() })
beforeEach(() => {
  clearTestDb()
  keychainStore._store.clear()
  vi.clearAllMocks()
})
afterAll(() => closeTestDb())

describe('OAuthManager.register() / getConnector()', () => {
  it('registers and retrieves a connector', () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    expect(mgr.getConnector(Platform.LINKEDIN)).toBe(connector)
  })

  it('returns undefined for unregistered platform', () => {
    const mgr = new OAuthManager(mockAudit())
    expect(mgr.getConnector(Platform.TWITTER)).toBeUndefined()
  })
})

describe('OAuthManager.getAuthURL()', () => {
  it('returns auth URL from connector', async () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    const url = await mgr.getAuthURL(Platform.LINKEDIN)
    expect(url).toContain('https://example.com/oauth')
    expect(connector.getAuthURL).toHaveBeenCalledOnce()
  })

  it('throws OAUTH_FAILED for unregistered platform', async () => {
    const mgr = new OAuthManager(mockAudit())
    await expect(mgr.getAuthURL(Platform.TWITTER)).rejects.toMatchObject({
      code: ErrorCode.OAUTH_FAILED,
    })
  })

  it('stores state in pendingStates', async () => {
    const mgr = new OAuthManager(mockAudit())
    mgr.register(mockConnector(Platform.LINKEDIN))
    await mgr.getAuthURL(Platform.LINKEDIN)

    expect((mgr as any).pendingStates.size).toBe(1)
  })
})

describe('OAuthManager.handleCallback() — error cases', () => {
  it('throws OAUTH_FAILED when error param present', async () => {
    const mgr = new OAuthManager(mockAudit())
    await expect(
      mgr.handleCallback('ghostpilot://oauth/callback?error=access_denied&error_description=User+denied')
    ).rejects.toMatchObject({ code: ErrorCode.OAUTH_FAILED })
  })

  it('throws OAUTH_FAILED when code is missing', async () => {
    const mgr = new OAuthManager(mockAudit())
    await expect(
      mgr.handleCallback('ghostpilot://oauth/callback?state=abc123')
    ).rejects.toMatchObject({ code: ErrorCode.OAUTH_FAILED })
  })

  it('throws OAUTH_STATE_MISMATCH for unknown state', async () => {
    const mgr = new OAuthManager(mockAudit())
    await expect(
      mgr.handleCallback('ghostpilot://oauth/callback?code=abc&state=unknown-state')
    ).rejects.toMatchObject({ code: ErrorCode.OAUTH_STATE_MISMATCH })
  })

  it('throws OAUTH_STATE_MISMATCH for expired state', async () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    // Manually inject an expired state
    const expiredState = 'expired-state-xyz'
    ;(mgr as any).pendingStates.set(expiredState, {
      state: expiredState,
      codeVerifier: 'verifier',
      platform: Platform.LINKEDIN,
      createdAt: Date.now() - 11 * 60 * 1000, // 11 minutes ago (TTL is 10 min)
    })

    await expect(
      mgr.handleCallback(`ghostpilot://oauth/callback?code=code123&state=${expiredState}`)
    ).rejects.toMatchObject({ code: ErrorCode.OAUTH_STATE_MISMATCH })
  })
})

describe('OAuthManager.handleCallback() — success path', () => {
  it('stores tokens in keychain and DB on valid callback', async () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    // Inject a valid pending state
    const validState = 'valid-state-abc'
    ;(mgr as any).pendingStates.set(validState, {
      state: validState,
      codeVerifier: 'verifier',
      platform: Platform.LINKEDIN,
      createdAt: Date.now(),
    })

    await mgr.handleCallback(`ghostpilot://oauth/callback?code=auth-code&state=${validState}`)

    // Keychain should have the token
    expect(keychainStore.set).toHaveBeenCalledOnce()
    const [keychainKey, tokenJson] = (keychainStore.set as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(keychainKey).toContain('ghostpilot:social:linkedin:')
    const tokens = JSON.parse(tokenJson)
    expect(tokens.accessToken).toBe('test-access-token')

    // DB should have the connection
    const { socialConnections } = await import('../../../src/main/infrastructure/db/schema')
    const rows = await db.select().from(socialConnections)
    expect(rows).toHaveLength(1)
    expect(rows[0].platform).toBe(Platform.LINKEDIN)
    expect(rows[0].displayName).toBe('Test User')
  })

  it('replaces existing connection for same platform', async () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    // First connection
    const state1 = 'state-1'
    ;(mgr as any).pendingStates.set(state1, {
      state: state1, codeVerifier: 'v1', platform: Platform.LINKEDIN, createdAt: Date.now(),
    })
    await mgr.handleCallback(`ghostpilot://oauth/callback?code=code1&state=${state1}`)

    // Second connection (re-auth)
    const state2 = 'state-2'
    ;(mgr as any).pendingStates.set(state2, {
      state: state2, codeVerifier: 'v2', platform: Platform.LINKEDIN, createdAt: Date.now(),
    })
    await mgr.handleCallback(`ghostpilot://oauth/callback?code=code2&state=${state2}`)

    const { socialConnections } = await import('../../../src/main/infrastructure/db/schema')
    const rows = await db.select().from(socialConnections)
    expect(rows).toHaveLength(1) // only one connection per platform
  })
})

describe('OAuthManager.getStatus()', () => {
  it('returns all 3 platforms as disconnected when no connections', async () => {
    const mgr = new OAuthManager(mockAudit())
    const status = await mgr.getStatus()

    expect(status).toHaveLength(3)
    for (const s of status) {
      expect(s.connected).toBe(false)
    }
    const platforms = status.map((s) => s.platform)
    expect(platforms).toContain(Platform.LINKEDIN)
    expect(platforms).toContain(Platform.TWITTER)
    expect(platforms).toContain(Platform.INSTAGRAM)
  })

  it('shows connected=true after successful callback', async () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    const state = 'status-test-state'
    ;(mgr as any).pendingStates.set(state, {
      state, codeVerifier: 'v', platform: Platform.LINKEDIN, createdAt: Date.now(),
    })
    await mgr.handleCallback(`ghostpilot://oauth/callback?code=c&state=${state}`)

    const status = await mgr.getStatus()
    const li = status.find((s) => s.platform === Platform.LINKEDIN)
    expect(li?.connected).toBe(true)
    expect(li?.displayName).toBe('Test User')
  })
})

describe('OAuthManager.disconnect()', () => {
  it('removes connection from DB and keychain', async () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    const state = 'disconnect-state'
    ;(mgr as any).pendingStates.set(state, {
      state, codeVerifier: 'v', platform: Platform.LINKEDIN, createdAt: Date.now(),
    })
    await mgr.handleCallback(`ghostpilot://oauth/callback?code=c&state=${state}`)

    await mgr.disconnect(Platform.LINKEDIN)

    const { socialConnections } = await import('../../../src/main/infrastructure/db/schema')
    const rows = await db.select().from(socialConnections)
    expect(rows).toHaveLength(0)
    expect(keychainStore.delete).toHaveBeenCalledOnce()
  })
})

describe('OAuthManager.getTokens()', () => {
  it('returns null when not connected', async () => {
    const mgr = new OAuthManager(mockAudit())
    const tokens = await mgr.getTokens(Platform.LINKEDIN)
    expect(tokens).toBeNull()
  })

  it('returns tokens after connection', async () => {
    const mgr = new OAuthManager(mockAudit())
    const connector = mockConnector(Platform.LINKEDIN)
    mgr.register(connector)

    const state = 'tokens-state'
    ;(mgr as any).pendingStates.set(state, {
      state, codeVerifier: 'v', platform: Platform.LINKEDIN, createdAt: Date.now(),
    })
    await mgr.handleCallback(`ghostpilot://oauth/callback?code=c&state=${state}`)

    const tokens = await mgr.getTokens(Platform.LINKEDIN)
    expect(tokens).not.toBeNull()
    expect(tokens?.accessToken).toBe('test-access-token')
  })
})

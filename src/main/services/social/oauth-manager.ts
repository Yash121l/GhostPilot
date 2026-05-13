import { randomBytes } from 'crypto'
import { shell } from 'electron'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { getDb } from '../../infrastructure/db/connection'
import { socialConnections } from '../../infrastructure/db/schema'
import { AuditAction } from '../../infrastructure/db/schema'
import type { AuditService } from '../../application/audit/audit.service'
import { KeychainService } from '../../infrastructure/keychain/keychain.service'
import type { SocialConnector, OAuthTokens } from './interface'
import type { Platform } from '../../../shared/types/platform'
import { AppError, ErrorCode } from '../../../shared/types/error'
import { createLogger } from '../../infrastructure/logger/logger'
import { OAUTH_STATE_TTL_MS, OAUTH_REDIRECT_URI } from '../../../shared/constants'
import type { AuthStatusOutput } from '../../../shared/ipc-types'

const logger = createLogger('OAuthManager')

interface OAuthState {
  state: string
  codeVerifier: string
  platform: Platform
  createdAt: number
}

export class OAuthManager {
  private pendingStates = new Map<string, OAuthState>()
  private connectors = new Map<string, SocialConnector>()
  private keychain = new KeychainService()

  constructor(private readonly audit: AuditService) {}

  register(connector: SocialConnector): void {
    this.connectors.set(connector.platform, connector)
  }

  getConnector(platform: Platform): SocialConnector | undefined {
    return this.connectors.get(platform)
  }

  /**
   * Build the OAuth URL for a platform without opening the browser.
   * Used by the CONNECTIONS_GET_AUTH_URL IPC handler.
   */
  async getAuthURL(platform: Platform): Promise<string> {
    const connector = this.connectors.get(platform)
    if (!connector) {
      throw new AppError({
        code: ErrorCode.OAUTH_FAILED,
        message: `No connector registered for platform: ${platform}`,
      })
    }
    const state = nanoid(32)
    const codeVerifier = randomBytes(32).toString('base64url')
    this.pendingStates.set(state, { state, codeVerifier, platform, createdAt: Date.now() })
    return connector.getAuthURL(state, codeVerifier, OAUTH_REDIRECT_URI)
  }

  /**
   * Open the browser for OAuth.
   * The platform redirects to ghostpilot.yashlunawat.com/oauth/callback,
   * which deep-links back via ghostpilot://oauth/callback — caught by handleCallback().
   */
  async initiateConnect(platform: Platform): Promise<void> {
    const connector = this.connectors.get(platform)
    if (!connector) {
      throw new AppError({
        code: ErrorCode.OAUTH_FAILED,
        message: `No connector registered for platform: ${platform}`,
      })
    }

    const state = nanoid(32)
    const codeVerifier = randomBytes(32).toString('base64url')

    this.pendingStates.set(state, { state, codeVerifier, platform, createdAt: Date.now() })

    const authURL = connector.getAuthURL(state, codeVerifier, OAUTH_REDIRECT_URI)
    logger.info({ msg: 'Opening OAuth URL', platform })

    this.audit.write({
      actor: 'user',
      action: AuditAction.OAUTH_INITIATED,
      entityType: 'social_connections',
      outcome: 'success',
      details: { platform },
    })

    await shell.openExternal(authURL)
  }

  /**
   * Handle the deep-link callback: ghostpilot://oauth/callback?code=...&state=...
   * Called from app.on('open-url') in main/index.ts.
   */
  async handleCallback(callbackURL: string): Promise<void> {
    const url = new URL(callbackURL)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    if (error) {
      throw new AppError({
        code: ErrorCode.OAUTH_FAILED,
        message: `OAuth error: ${error}${errorDescription ? ` — ${errorDescription}` : ''}`,
      })
    }
    if (!code || !state) {
      throw new AppError({ code: ErrorCode.OAUTH_FAILED, message: 'Missing code or state in OAuth callback' })
    }

    const pending = this.pendingStates.get(state)
    if (!pending) {
      throw new AppError({ code: ErrorCode.OAUTH_STATE_MISMATCH, message: 'Unknown or expired OAuth state' })
    }
    if (Date.now() - pending.createdAt > OAUTH_STATE_TTL_MS) {
      this.pendingStates.delete(state)
      throw new AppError({ code: ErrorCode.OAUTH_STATE_MISMATCH, message: 'OAuth state expired' })
    }

    this.pendingStates.delete(state)

    const connector = this.connectors.get(pending.platform)!
    // Pass the same redirect URI used when building the auth URL
    const result = await connector.handleCallback(code, pending.codeVerifier, OAUTH_REDIRECT_URI)

    const connectionId = nanoid()
    const keychainKey = `ghostpilot:social:${pending.platform}:${connectionId}`
    await this.keychain.set(keychainKey, JSON.stringify(result.tokens))

    const db = getDb()
    const now = new Date()

    await db.delete(socialConnections).where(eq(socialConnections.platform, pending.platform))

    await db.insert(socialConnections).values({
      id: connectionId,
      platform: pending.platform,
      platformUserId: result.platformUserId,
      displayName: result.displayName,
      keychainKey,
      expiresAt: result.tokens.expiresAt,
      scopes: JSON.stringify(result.tokens.scopes),
      createdAt: now,
      updatedAt: now,
    })

    this.audit.write({
      actor: 'user',
      action: AuditAction.OAUTH_CALLBACK,
      entityType: 'social_connections',
      entityId: connectionId,
      outcome: 'success',
      details: { platform: pending.platform, displayName: result.displayName },
    })

    logger.info({ msg: 'OAuth complete', platform: pending.platform, displayName: result.displayName })
  }

  async disconnect(platform: Platform): Promise<void> {
    const db = getDb()
    const rows = await db.select().from(socialConnections).where(eq(socialConnections.platform, platform))

    for (const row of rows) {
      await this.keychain.delete(row.keychainKey)
    }

    await db.delete(socialConnections).where(eq(socialConnections.platform, platform))

    this.audit.write({
      actor: 'user',
      action: AuditAction.CONNECTION_DELETED,
      entityType: 'social_connections',
      outcome: 'success',
      details: { platform },
    })
  }

  async getStatus(): Promise<AuthStatusOutput[]> {
    const db = getDb()
    const rows = await db.select().from(socialConnections)

    const all = ['linkedin', 'twitter', 'instagram'] as Platform[]
    const connected = new Map(rows.map((r) => [r.platform, r]))

    return all.map((platform) => {
      const row = connected.get(platform)
      return {
        platform,
        connected: Boolean(row),
        displayName: row?.displayName,
        expiresAt: row?.expiresAt?.getTime(),
      }
    })
  }

  async getTokens(platform: Platform): Promise<OAuthTokens | null> {
    const db = getDb()
    const rows = await db.select().from(socialConnections).where(eq(socialConnections.platform, platform))
    if (!rows.length) return null

    const raw = await this.keychain.get(rows[0].keychainKey)
    if (!raw) return null

    return JSON.parse(raw) as OAuthTokens
  }
}

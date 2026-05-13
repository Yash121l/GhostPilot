import { createServer, type Server } from 'http'
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
import { OAUTH_STATE_TTL_MS, OAUTH_REDIRECT_URI, OAUTH_FALLBACK_PORT } from '../../../shared/constants'
import type { AuthStatusOutput } from '../../../shared/ipc-types'

const logger = createLogger('OAuthManager')

/** How long to wait for the user to complete the OAuth flow (ms). */
const OAUTH_BROWSER_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

interface OAuthState {
  state: string
  codeVerifier: string
  platform: Platform
  createdAt: number
  /** Resolve function for the pending initiateConnect() promise */
  resolve?: (params: { code: string; state: string }) => void
  /** Reject function for the pending initiateConnect() promise */
  reject?: (err: Error) => void
}

/**
 * Spin up a temporary localhost HTTP server on a fixed port.
 * The website callback page POSTs {code, state} here as a fallback
 * when the ghostpilot:// deep link doesn't open the app (e.g. in dev mode).
 */
function createCallbackServer(
  port: number,
  onCallback: (code: string, state: string) => void,
): Server {
  const server = createServer((req, res) => {
    // Allow CORS from the website
    res.setHeader('Access-Control-Allow-Origin', 'https://ghostpilot.yashlunawat.com')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'POST' && req.url === '/oauth/callback') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try {
          const { code, state } = JSON.parse(body) as { code: string; state: string }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          onCallback(code, state)
        } catch {
          res.writeHead(400)
          res.end()
        }
      })
      return
    }

    res.writeHead(404)
    res.end()
  })

  server.listen(port, '127.0.0.1')
  return server
}

export class OAuthManager {
  private pendingStates = new Map<string, OAuthState>()
  private connectors = new Map<string, SocialConnector>()
  private keychain = new KeychainService()
  /** Localhost fallback server — one at a time */
  private callbackServer: Server | null = null
  private callbackPort = OAUTH_FALLBACK_PORT

  constructor(private readonly audit: AuditService) {}

  register(connector: SocialConnector): void {
    this.connectors.set(connector.platform, connector)
  }

  getConnector(platform: Platform): SocialConnector | undefined {
    return this.connectors.get(platform)
  }

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
   * Starts a localhost fallback server so the website callback page can POST
   * the code back even if the ghostpilot:// deep link doesn't fire (dev mode).
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

    // Start localhost fallback server before opening the browser
    this.callbackServer?.close()
    this.callbackServer = createCallbackServer(
      this.callbackPort,
      (code, receivedState) => {
        const pending = this.pendingStates.get(receivedState)
        if (pending?.resolve) {
          pending.resolve({ code, state: receivedState })
        }
      },
    )

    const pending: OAuthState = { state, codeVerifier, platform, createdAt: Date.now() }

    // Wrap in a promise so initiateConnect() waits for the callback
    const callbackPromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
      pending.resolve = resolve
      pending.reject = reject
    })

    this.pendingStates.set(state, pending)

    const authURL = connector.getAuthURL(state, codeVerifier, OAUTH_REDIRECT_URI)
    logger.info({ msg: 'Opening OAuth URL', platform, fallbackPort: this.callbackPort })

    this.audit.write({
      actor: 'user',
      action: AuditAction.OAUTH_INITIATED,
      entityType: 'social_connections',
      outcome: 'success',
      details: { platform },
    })

    await shell.openExternal(authURL)

    // Wait for callback (via deep link OR localhost fallback)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AppError({
        code: ErrorCode.OAUTH_FAILED,
        message: 'OAuth timed out — complete the flow in the browser within 10 minutes',
      })), OAUTH_BROWSER_TIMEOUT_MS),
    )

    const { code } = await Promise.race([callbackPromise, timeout])
    this.callbackServer?.close()
    this.callbackServer = null

    await this._processCallback(code, state, codeVerifier, platform)
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

    // If initiateConnect() is waiting via the promise, resolve it
    if (pending.resolve) {
      pending.resolve({ code, state })
      return
    }

    // Otherwise process directly (e.g. called from open-url before initiateConnect resolves)
    await this._processCallback(code, state, pending.codeVerifier, pending.platform)
  }

  private async _processCallback(
    code: string,
    state: string,
    codeVerifier: string,
    platform: Platform,
  ): Promise<void> {
    if (Date.now() - (this.pendingStates.get(state)?.createdAt ?? 0) > OAUTH_STATE_TTL_MS) {
      this.pendingStates.delete(state)
      throw new AppError({ code: ErrorCode.OAUTH_STATE_MISMATCH, message: 'OAuth state expired' })
    }

    this.pendingStates.delete(state)

    const connector = this.connectors.get(platform)!
    const result = await connector.handleCallback(code, codeVerifier, OAUTH_REDIRECT_URI)

    const connectionId = nanoid()
    const keychainKey = `ghostpilot:social:${platform}:${connectionId}`
    await this.keychain.set(keychainKey, JSON.stringify(result.tokens))

    const db = getDb()
    const now = new Date()

    await db.delete(socialConnections).where(eq(socialConnections.platform, platform))

    await db.insert(socialConnections).values({
      id: connectionId,
      platform,
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
      details: { platform, displayName: result.displayName },
    })

    logger.info({ msg: 'OAuth complete', platform, displayName: result.displayName })
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

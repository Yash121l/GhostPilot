import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import { createLogger } from '../infrastructure/logger/logger'
import type { Platform } from '../../shared/types/platform'
import type { ConnectionInfo, RateLimitInfo } from '../../shared/ipc-types'
import { TOKEN_REFRESH_BUFFER_MS } from '../../shared/constants'

const logger = createLogger('ConnectionsIPC')

export function registerConnectionHandlers(): void {
  /**
   * Return the OAuth authorization URL without opening the browser.
   * The renderer is responsible for calling shell.openExternal.
   */
  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_GET_AUTH_URL,
    async (_event, { platform }: { platform: Platform }) => {
      try {
        const url = await getServices().oauthManager.getAuthURL(platform)
        return ok(url)
      } catch (e) {
        logger.error({ msg: 'connections:getAuthURL failed', platform, error: String(e) })
        return err(
          e instanceof AppError
            ? e
            : new AppError({ code: ErrorCode.OAUTH_FAILED, message: String(e) })
        )
      }
    }
  )

  /** List all platforms with connection status and token health. */
  ipcMain.handle(IPC_CHANNELS.CONNECTIONS_LIST, async () => {
    try {
      const statuses = await getServices().oauthManager.getStatus()
      const now = Date.now()

      const connections: ConnectionInfo[] = statuses.map((s) => ({
        platform: s.platform,
        connected: s.connected,
        displayName: s.displayName,
        expiresAt: s.expiresAt,
        needsReauth: s.connected
          ? !s.expiresAt
            ? false // no expiry = permanent
            : s.expiresAt - now < TOKEN_REFRESH_BUFFER_MS
          : false
      }))

      return ok(connections)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  /** Disconnect from a platform (revokes local token, best-effort remote revoke). */
  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_REVOKE,
    async (_event, { platform }: { platform: Platform }) => {
      try {
        await getServices().oauthManager.disconnect(platform)
        return ok(undefined)
      } catch (e) {
        logger.error({ msg: 'connections:revoke failed', platform, error: String(e) })
        return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
      }
    }
  )

  /** Return the current rate-limit window for a platform connector. */
  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_RATE_LIMIT_STATE,
    (_event, { platform }: { platform: Platform }) => {
      try {
        const connector = getServices().oauthManager.getConnector(platform)
        if (!connector) {
          return err(
            new AppError({ code: ErrorCode.NOT_FOUND, message: `No connector for ${platform}` })
          )
        }
        const state = connector.rateLimitState()
        const info: RateLimitInfo = {
          platform: state.platform,
          remaining: state.remaining,
          limit: state.limit,
          resetsAt: state.resetsAt.getTime(),
          exceeded: state.exceeded
        }
        return ok(info)
      } catch (e) {
        return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
      }
    }
  )
}

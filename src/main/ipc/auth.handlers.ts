import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { AuthConnectInput } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import { createLogger } from '../infrastructure/logger/logger'
import type { Platform } from '../../shared/types/platform'

const logger = createLogger('AuthHandlers')

export function registerAuthHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_CONNECT, async (_event, { platform }: AuthConnectInput) => {
    try {
      await getServices().oauthManager.initiateConnect(platform)
      return ok(undefined)
    } catch (e) {
      logger.error({ msg: 'auth:connect failed', platform, error: String(e) })
      return err(
        e instanceof AppError
          ? e
          : new AppError({ code: ErrorCode.OAUTH_FAILED, message: String(e) })
      )
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.AUTH_DISCONNECT,
    async (_event, { platform }: { platform: Platform }) => {
      try {
        await getServices().oauthManager.disconnect(platform)
        return ok(undefined)
      } catch (e) {
        return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async () => {
    try {
      return ok(await getServices().oauthManager.getStatus())
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })
}

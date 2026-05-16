import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { Platform } from '../../shared/types/platform'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'

export function registerPlatformAnalyticsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PLATFORM_ANALYTICS_SUMMARY, async () => {
    try {
      return ok(await getServices().platformAnalyticsService.summary())
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PLATFORM_ANALYTICS_TOP_POSTS,
    async (_event, input: { platform?: Platform; window?: '24h' | '7d' | '30d' }) => {
      try {
        return ok(
          await getServices().platformAnalyticsService.topPosts(input.platform, input.window)
        )
      } catch (e) {
        return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PLATFORM_ANALYTICS_HASHTAGS,
    async (_event, input: { platform?: Platform; tag?: string }) => {
      try {
        return ok(await getServices().platformAnalyticsService.hashtags(input.platform, input.tag))
      } catch (e) {
        return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PLATFORM_ANALYTICS_SYNC, async () => {
    try {
      await getServices().platformAnalyticsService.sync()
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })
}

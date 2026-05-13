import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'

export function registerTrendHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TREND_LIST, async (_event, { limit = 20 }: { limit?: number }) => {
    try {
      return ok(await getServices().trendWatcher.list(limit))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TREND_REFRESH, async () => {
    try {
      await getServices().trendWatcher.refresh()
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TREND_DISMISS, async (_event, { id }: { id: string }) => {
    try {
      await getServices().trendWatcher.dismiss(id)
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })
}

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import type { Intent } from '../../shared/types/intent'

export function registerIntentHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INTENT_LIST, async (_event, { personaId }: { personaId?: string }) => {
    try {
      return ok(await getServices().intentService.list(personaId))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.INTENT_CREATE, async (_event, input: Omit<Intent, 'id' | 'createdAt' | 'updatedAt' | 'keyResults'>) => {
    try {
      return ok(await getServices().intentService.create(input))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.INTENT_UPDATE, async (_event, input: Partial<Intent> & { id: string }) => {
    try {
      const { id, ...rest } = input
      return ok(await getServices().intentService.update(id, rest))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.INTENT_DELETE, async (_event, { id }: { id: string }) => {
    try {
      await getServices().intentService.delete(id)
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })
}

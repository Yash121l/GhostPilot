import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import { createLogger } from '../infrastructure/logger/logger'
import type { Persona } from '../../shared/types/persona'

const logger = createLogger('PersonaHandlers')

export function registerPersonaHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PERSONA_LIST, async () => {
    try {
      return ok(await getServices().personaService.list())
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONA_GET, async (_event, { id }: { id: string }) => {
    try {
      return ok(await getServices().personaService.get(id))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.PERSONA_NOT_FOUND, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONA_CREATE, async (_event, input: Omit<Persona, 'id' | 'createdAt' | 'updatedAt' | 'latestFingerprint'>) => {
    try {
      return ok(await getServices().personaService.create(input))
    } catch (e) {
      logger.error({ msg: 'persona:create failed', error: String(e) })
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONA_UPDATE, async (_event, input: Partial<Persona> & { id: string }) => {
    try {
      const { id, ...rest } = input
      return ok(await getServices().personaService.update(id, rest))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PERSONA_DELETE, async (_event, { id }: { id: string }) => {
    try {
      await getServices().personaService.delete(id)
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })
}

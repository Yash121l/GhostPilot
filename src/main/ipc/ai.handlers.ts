import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { AddProviderKeyInput } from '../../shared/ipc-types'
import type { AIGatewayRequest } from '../../shared/types/ai'
import { ok, err } from '../../shared/types/error'
import { AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('AIHandlers')

export function registerAIHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_COMPLETE, async (_event, req: AIGatewayRequest) => {
    try {
      const res = await getServices().aiGateway.complete(req)
      return ok(res)
    } catch (e) {
      logger.error({ msg: 'ai:complete failed', error: String(e) })
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.AI_CALL_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_USAGE_LIST, async (_event, { limit = 100 }) => {
    try {
      const rows = getServices().aiGateway.ledgerInstance.list(limit)
      return ok(rows)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_USAGE_DAILY, async (_event, { days = 30 }) => {
    try {
      return ok(getServices().aiGateway.ledgerInstance.dailySummary(days))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_KEYS_LIST, async () => {
    try {
      return ok(await getServices().aiGateway.listKeys())
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_KEYS_ADD, async (_event, input: AddProviderKeyInput) => {
    try {
      const key = await getServices().aiGateway.addKey(input.provider, input.label, input.secret)
      return ok(key)
    } catch (e) {
      logger.error({ msg: 'ai:keys:add failed', error: String(e) })
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_KEYS_DELETE, async (_event, { id }: { id: string }) => {
    try {
      await getServices().aiGateway.deleteKey(id)
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_KEYS_SET_DEFAULT, async (_event, { id }: { id: string }) => {
    try {
      await getServices().aiGateway.setDefault(id)
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_KEYS_TEST, async (_event, { id }: { id: string }) => {
    try {
      return ok(await getServices().aiGateway.testKey(id))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.AI_CALL_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_OLLAMA_STATUS, async () => {
    try {
      return ok(await getServices().aiGateway.ollamaStatus())
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })
}

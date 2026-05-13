import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { AddProviderKeyInput } from '../../shared/ipc-types'
import type { AIGatewayRequest } from '../../shared/types/ai'
import { ok, err } from '../../shared/types/error'
import { AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import { getDb } from '../infrastructure/db/connection'
import { styleFingerprints } from '../infrastructure/db/schema'
import { eq } from 'drizzle-orm'
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

  /**
   * Compute a "sounds like you" score [0, 1] by comparing the current draft
   * text against the persona's stored style descriptors (keyword overlap).
   * No AI call — fast enough to debounce while typing.
   */
  ipcMain.handle(IPC_CHANNELS.AI_STYLE_DRIFT, async (_event, { personaId, text }: { personaId: string; text: string }) => {
    try {
      const db = getDb()
      const rows = await db.select().from(styleFingerprints).where(eq(styleFingerprints.personaId, personaId))

      if (!rows.length) return ok({ score: 1.0 }) // no fingerprint yet → assume on-brand

      const fp = rows[0]
      const descriptors: string[] = JSON.parse(fp.descriptors) as string[]
      if (!descriptors.length) return ok({ score: 1.0 })

      // Jaccard similarity between fingerprint descriptor tokens and text tokens
      const textWords = new Set(
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3),
      )
      const fpWords = new Set(
        descriptors
          .join(' ')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3),
      )

      const intersection = [...textWords].filter((w) => fpWords.has(w)).length
      const union = new Set([...textWords, ...fpWords]).size
      const jaccard = union === 0 ? 1 : intersection / union

      // Scale: jaccard > 0.15 = good match, < 0.05 = very different
      const score = Math.min(1, jaccard / 0.15)
      return ok({ score: Math.round(score * 100) / 100 })
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })
}

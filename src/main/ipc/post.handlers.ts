import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { CreatePostInput, GenerateVariantsInput, ApprovePostInput, SchedulePostInput } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import { createLogger } from '../infrastructure/logger/logger'
import type { AuditService } from '../application/audit/audit.service'

const logger = createLogger('PostHandlers')

export function registerPostHandlers(_auditService: AuditService): void {
  ipcMain.handle(IPC_CHANNELS.POST_CREATE, async (_event, input: CreatePostInput) => {
    logger.info({ msg: 'post:create', personaId: input.personaId })
    try {
      return ok(await getServices().postService.create(input))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_LIST, async (_event, input) => {
    try {
      return ok(await getServices().postService.list(input))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_GET, async (_event, { id }: { id: string }) => {
    try {
      return ok(await getServices().postService.get(id))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.POST_NOT_FOUND, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_GENERATE_VARIANTS, async (_event, input: GenerateVariantsInput) => {
    logger.info({ msg: 'post:generate-variants', postId: input.postId })
    try {
      return ok(await getServices().variantGenerator.generate(input.postId, input.platforms, input.traceId))
    } catch (e) {
      logger.error({ msg: 'generate-variants failed', error: String(e) })
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.AI_CALL_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_APPROVE, async (_event, input: ApprovePostInput) => {
    try {
      return ok(await getServices().postService.approve(input.postId, input.variantId))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.POST_INVALID_TRANSITION, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_SCHEDULE, async (_event, input: SchedulePostInput) => {
    try {
      const job = await getServices().postService.schedule(
        input.postId,
        input.variantId,
        input.platform,
        new Date(input.scheduledAt),
      )
      return ok(job)
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_DELETE, async (_event, { id }: { id: string }) => {
    try {
      await getServices().postService.delete(id)
      return ok(undefined)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })
}

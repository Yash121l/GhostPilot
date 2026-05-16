import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type {
  CreatePostInput,
  GenerateVariantsInput,
  ApprovePostInput,
  SchedulePostInput
} from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'
import { getDb } from '../infrastructure/db/connection'
import { jobs } from '../infrastructure/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { Job } from '../../shared/types/post'
import { createLogger } from '../infrastructure/logger/logger'
import type { AuditService } from '../application/audit/audit.service'

const logger = createLogger('PostHandlers')

export function registerPostHandlers(_auditService: AuditService): void {
  ipcMain.handle(IPC_CHANNELS.POST_CREATE, async (_event, input: CreatePostInput) => {
    logger.info({ msg: 'post:create', personaId: input.personaId })
    try {
      return ok(await getServices().postService.create(input))
    } catch (e) {
      return err(
        e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) })
      )
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
      return err(
        e instanceof AppError
          ? e
          : new AppError({ code: ErrorCode.POST_NOT_FOUND, message: String(e) })
      )
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.POST_GENERATE_VARIANTS,
    async (_event, input: GenerateVariantsInput) => {
      logger.info({ msg: 'post:generate-variants', postId: input.postId })
      try {
        return ok(
          await getServices().variantGenerator.generate(
            input.postId,
            input.platforms,
            input.traceId,
            input.preferredProviderId
          )
        )
      } catch (e) {
        logger.error({ msg: 'generate-variants failed', error: String(e) })
        return err(
          e instanceof AppError
            ? e
            : new AppError({ code: ErrorCode.AI_CALL_FAILED, message: String(e) })
        )
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.POST_APPROVE, async (_event, input: ApprovePostInput) => {
    try {
      return ok(await getServices().postService.approve(input.postId, input.variantId))
    } catch (e) {
      return err(
        e instanceof AppError
          ? e
          : new AppError({ code: ErrorCode.POST_INVALID_TRANSITION, message: String(e) })
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_SCHEDULE, async (_event, input: SchedulePostInput) => {
    try {
      const job = await getServices().postService.schedule(
        input.postId,
        input.variantId,
        input.platform,
        new Date(input.scheduledAt)
      )
      return ok(job)
    } catch (e) {
      return err(
        e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) })
      )
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

  ipcMain.handle(
    IPC_CHANNELS.POST_UPDATE_BODY,
    async (_event, { id, body }: { id: string; body: string }) => {
      try {
        return ok(await getServices().draftService.updateBody(id, body))
      } catch (e) {
        return err(
          e instanceof AppError
            ? e
            : new AppError({ code: ErrorCode.POST_INVALID_TRANSITION, message: String(e) })
        )
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.JOB_LIST,
    async (_event, input: { postId?: string; status?: string; limit?: number }) => {
      try {
        const db = getDb()
        const rows = await db
          .select()
          .from(jobs)
          .where(input.postId ? eq(jobs.postId, input.postId) : undefined)
          .orderBy(desc(jobs.scheduledAt))
          .limit(input.limit ?? 50)

        const mapped: Job[] = rows.map((r) => ({
          id: r.id,
          postId: r.postId,
          variantId: r.variantId,
          platform: r.platform as import('../../shared/types/platform').Platform,
          scheduledAt: r.scheduledAt,
          attempts: r.attempts,
          lastError: r.lastError ?? undefined,
          status: r.status as Job['status']
        }))
        return ok(mapped)
      } catch (e) {
        return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
      }
    }
  )
}

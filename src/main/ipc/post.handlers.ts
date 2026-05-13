/**
 * @module ipc/post.handlers
 * IPC handlers for post lifecycle operations.
 * Thin delegation layer — all business logic lives in PostService.
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { CreatePostInput, GenerateVariantsInput, ApprovePostInput, SchedulePostInput } from '../../shared/ipc-types'
import { err } from '../../shared/types/error'
import { AppError, ErrorCode } from '../../shared/types/error'
import type { AuditService } from '../application/audit/audit.service'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('PostHandlers')

/**
 * Register all post-related IPC handlers.
 * @param auditService - injected for DI
 */
export function registerPostHandlers(_auditService: AuditService): void {
  ipcMain.handle(IPC_CHANNELS.POST_CREATE, async (_event, input: CreatePostInput) => {
    logger.info({ msg: 'post:create invoked', personaId: input.personaId })
    try {
      // TODO(phase-3): wire PostService.create()
      // const result = await postService.create(input)
      // return result
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: 'Not implemented yet — Phase 3' }))
    } catch (e) {
      logger.error({ msg: 'post:create failed', error: String(e) })
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_LIST, async (_event, _input) => {
    logger.info({ msg: 'post:list invoked' })
    try {
      // TODO(phase-3): wire PostService.list()
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: 'Not implemented yet — Phase 3' }))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_GET, async (_event, input: { id: string }) => {
    logger.info({ msg: 'post:get invoked', postId: input.id })
    try {
      // TODO(phase-3): wire PostService.get()
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: 'Not implemented yet — Phase 3' }))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_GENERATE_VARIANTS, async (_event, input: GenerateVariantsInput) => {
    logger.info({ msg: 'post:generate-variants invoked', postId: input.postId })
    try {
      // TODO(phase-3): wire VariantGenerator.generate()
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: 'Not implemented yet — Phase 3' }))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_APPROVE, async (_event, input: ApprovePostInput) => {
    logger.info({ msg: 'post:approve invoked', postId: input.postId })
    try {
      // TODO(phase-3): wire PostService.approve()
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: 'Not implemented yet — Phase 3' }))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_SCHEDULE, async (_event, input: SchedulePostInput) => {
    logger.info({ msg: 'post:schedule invoked', postId: input.postId })
    try {
      // TODO(phase-3): wire SchedulerService.schedule()
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: 'Not implemented yet — Phase 3' }))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.POST_DELETE, async (_event, input: { id: string }) => {
    logger.info({ msg: 'post:delete invoked', postId: input.id })
    try {
      // TODO(phase-3): wire PostService.delete()
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: 'Not implemented yet — Phase 3' }))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })
}

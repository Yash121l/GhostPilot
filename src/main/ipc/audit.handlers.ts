/**
 * @module ipc/audit.handlers
 * IPC handlers for the audit log — read-only from renderer perspective.
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { AuditQueryInput } from '../../shared/ipc-types'
import { ok, err } from '../../shared/types/error'
import { AppError, ErrorCode } from '../../shared/types/error'
import type { AuditService } from '../application/audit/audit.service'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('AuditHandlers')

/**
 * Register audit log IPC handlers.
 */
export function registerAuditHandlers(auditService: AuditService): void {
  ipcMain.handle(IPC_CHANNELS.AUDIT_QUERY, (_event, input: AuditQueryInput) => {
    logger.info({ msg: 'audit:query invoked' })
    try {
      const rows = auditService.query(input)
      return ok(rows)
    } catch (e) {
      logger.error({ msg: 'audit:query failed', error: String(e) })
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })
}

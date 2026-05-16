/**
 * @module ipc/settings.handlers
 * IPC handlers for app settings (key-value store in SQLite).
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { SettingsGetInput, SettingsSetInput } from '../../shared/ipc-types'
import { ok, err } from '../../shared/types/error'
import { AppError, ErrorCode } from '../../shared/types/error'
import { AuditAction } from '../infrastructure/db/schema'
import type { AuditService } from '../application/audit/audit.service'
import { getRawDb } from '../infrastructure/db/connection'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('SettingsHandlers')

/**
 * Register settings IPC handlers.
 */
export function registerSettingsHandlers(auditService: AuditService): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, input: SettingsGetInput) => {
    try {
      const db = getRawDb()
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(input.key) as
        | { value: string }
        | undefined

      if (!row) return ok(null)
      return ok(JSON.parse(row.value))
    } catch (e) {
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, input: SettingsSetInput) => {
    logger.info({ msg: 'settings:set invoked', key: input.key })
    try {
      auditService.write({
        actor: 'system',
        action: AuditAction.SETTINGS_CHANGED,
        entityType: 'settings',
        entityId: input.key,
        outcome: 'success',
        details: { key: input.key }
      })

      const db = getRawDb()
      db.prepare(
        `
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
      ).run(input.key, JSON.stringify(input.value), Date.now())

      return ok(undefined)
    } catch (e) {
      logger.error({ msg: 'settings:set failed', error: String(e) })
      return err(new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: String(e) }))
    }
  })
}

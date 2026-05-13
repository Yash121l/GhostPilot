/**
 * @module ipc/index
 * Registers all IPC handlers in the main process.
 * Each handler module delegates to the Application layer — never does work itself.
 */

import { ipcMain } from 'electron'
import { AuditService } from '../application/audit/audit.service'
import { registerPostHandlers } from './post.handlers'
import { registerAuditHandlers } from './audit.handlers'
import { registerSettingsHandlers } from './settings.handlers'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('IPC')

let _registered = false

/**
 * Register all IPC handlers. Idempotent — safe to call once at startup.
 */
export function registerAllHandlers(): void {
  if (_registered) return
  _registered = true

  logger.info({ msg: 'Registering IPC handlers' })

  // Shared services
  const auditService = new AuditService()

  // Register domain handler groups
  registerPostHandlers(auditService)
  registerAuditHandlers(auditService)
  registerSettingsHandlers(auditService)

  // App version handler
  ipcMain.handle('app:version', () => process.env['npm_package_version'] ?? '0.0.0')

  logger.info({ msg: 'All IPC handlers registered' })
}

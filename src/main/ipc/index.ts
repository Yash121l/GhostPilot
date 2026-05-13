import { ipcMain } from 'electron'
import { AuditService } from '../application/audit/audit.service'
import { registerPostHandlers } from './post.handlers'
import { registerAuditHandlers } from './audit.handlers'
import { registerSettingsHandlers } from './settings.handlers'
import { registerAIHandlers } from './ai.handlers'
import { registerPersonaHandlers } from './persona.handlers'
import { registerIntentHandlers } from './intent.handlers'
import { registerTrendHandlers } from './trend.handlers'
import { registerAuthHandlers } from './auth.handlers'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('IPC')

let _registered = false

export function registerAllHandlers(): void {
  if (_registered) return
  _registered = true

  logger.info({ msg: 'Registering IPC handlers' })

  const auditService = new AuditService()

  registerPostHandlers(auditService)
  registerAuditHandlers(auditService)
  registerSettingsHandlers(auditService)
  registerAIHandlers()
  registerPersonaHandlers()
  registerIntentHandlers()
  registerTrendHandlers()
  registerAuthHandlers()

  ipcMain.handle('app:version', () => process.env['npm_package_version'] ?? '0.0.0')

  logger.info({ msg: 'All IPC handlers registered' })
}

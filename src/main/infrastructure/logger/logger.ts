/**
 * @module logger
 * Structured JSON logger wrapping electron-log.
 * Every call emits a well-typed LogEntry. Secrets are stripped before write.
 *
 * Usage:
 *   const logger = createLogger('AIGateway')
 *   logger.info({ msg: 'LLM call completed', provider: 'anthropic', durationMs: 243 })
 */

import log from 'electron-log'
import { join } from 'path'
import { app } from 'electron'
import { sanitizeForLog } from './log-sanitizer'

export type LogProcess = 'main' | 'renderer' | `worker:${string}`

export interface Logger {
  debug(fields: LogFields): void
  info(fields: LogFields): void
  warn(fields: LogFields): void
  error(fields: LogFields): void
}

export interface LogFields {
  msg: string
  traceId?: string
  durationMs?: number
  platform?: string
  provider?: string
  taskType?: string
  jobId?: string
  postId?: string
  personaId?: string
  error?: string
  [key: string]: unknown
}

// Configure electron-log file paths and rotation on first import.
function configureLog(): void {
  const userDataPath = app.getPath('userData')
  log.transports.file.resolvePathFn = (variables) => {
    const vars = variables as { processType?: string }
    const name = vars.processType === 'main' ? 'main' : vars.processType || 'unknown'
    return join(userDataPath, 'logs', `${name}.log`)
  }
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {text}'
  log.transports.file.maxSize = 50 * 1024 * 1024 // 50 MB
  // JSON lines format via custom transform
  log.transports.file.transforms = [
    (msg) => {
      const [level, ...rest] = msg.data
      return [JSON.stringify({ ...rest[0], level, ts: new Date().toISOString() })]
    }
  ]
}

let _configured = false

/**
 * Create a logger bound to a specific context string and process label.
 * @param context - e.g. 'AIGateway', 'OAuthService', 'PublisherWorker'
 * @param process - which process this logger belongs to
 */
export function createLogger(context: string, process: LogProcess = 'main'): Logger {
  if (!_configured) {
    try {
      configureLog()
      _configured = true
    } catch {
      // In test environments electron app may not be available — continue silently.
    }
  }

  const base = { context, process }

  return {
    debug(fields: LogFields): void {
      log.debug(sanitizeForLog({ ...base, ...fields }))
    },
    info(fields: LogFields): void {
      log.info(sanitizeForLog({ ...base, ...fields }))
    },
    warn(fields: LogFields): void {
      log.warn(sanitizeForLog({ ...base, ...fields }))
    },
    error(fields: LogFields): void {
      log.error(sanitizeForLog({ ...base, ...fields }))
    }
  }
}

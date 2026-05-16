/**
 * @module audit.service
 * AuditService — the single writer for the append-only `audit_log` table.
 *
 * RULES:
 *  - Write BEFORE the operation succeeds.
 *  - Writes are synchronous (better-sqlite3) — they never fail silently.
 *  - No `delete` or `update` method exists on this service.
 *  - Details JSON must never contain raw tokens or key values.
 */

import { nanoid } from 'nanoid'
import { getRawDb } from '../../infrastructure/db/connection'
import type { AuditAction } from '../../infrastructure/db/schema'
import type { AuditQueryInput, AuditRow } from '../../../shared/ipc-types'
import { createLogger } from '../../infrastructure/logger/logger'

const logger = createLogger('AuditService')

export interface WriteAuditParams {
  actor: string
  action: AuditAction | string
  entityType: string
  entityId?: string
  beforeHash?: string
  afterHash?: string
  outcome: 'success' | 'failure' | 'blocked'
  errorCode?: string
  /** Safe metadata — NO tokens, NO key values. */
  details?: Record<string, unknown>
}

/**
 * Append-only audit log service.
 * Inject via constructor DI into every Application service.
 */
export class AuditService {
  /**
   * Write one immutable row to `audit_log`.
   * Runs synchronously so the caller knows the write committed before proceeding.
   *
   * @param params - audit event details
   */
  write(params: WriteAuditParams): void {
    const db = getRawDb()
    const id = nanoid()
    const ts = Date.now()

    const stmt = db.prepare(`
      INSERT INTO audit_log
        (id, ts, actor, action, entity_type, entity_id,
         before_hash, after_hash, ip, outcome, error_code, details_json)
      VALUES
        (@id, @ts, @actor, @action, @entityType, @entityId,
         @beforeHash, @afterHash, @ip, @outcome, @errorCode, @detailsJson)
    `)

    stmt.run({
      id,
      ts,
      actor: params.actor,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      beforeHash: params.beforeHash ?? null,
      afterHash: params.afterHash ?? null,
      ip: 'local',
      outcome: params.outcome,
      errorCode: params.errorCode ?? null,
      detailsJson: params.details ? JSON.stringify(params.details) : null
    })

    logger.debug({
      msg: 'Audit row written',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      outcome: params.outcome
    })
  }

  /**
   * Query audit log rows for display in the Activity Log UI.
   * Results are ordered by `ts DESC`.
   */
  query(input: AuditQueryInput): AuditRow[] {
    const db = getRawDb()

    const conditions: string[] = []
    const bindings: Record<string, unknown> = {}

    if (input.entityType) {
      conditions.push('entity_type = @entityType')
      bindings.entityType = input.entityType
    }
    if (input.action) {
      conditions.push('action = @action')
      bindings.action = input.action
    }
    if (input.fromTs !== undefined) {
      conditions.push('ts >= @fromTs')
      bindings.fromTs = input.fromTs
    }
    if (input.toTs !== undefined) {
      conditions.push('ts <= @toTs')
      bindings.toTs = input.toTs
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = input.limit ?? 100
    const offset = input.offset ?? 0

    const rows = db
      .prepare(
        `SELECT id, ts, actor, action, entity_type as entityType, entity_id as entityId,
                outcome, error_code as errorCode, details_json as detailsJson
         FROM audit_log ${where}
         ORDER BY ts DESC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...bindings, limit, offset }) as AuditRow[]

    return rows
  }
}

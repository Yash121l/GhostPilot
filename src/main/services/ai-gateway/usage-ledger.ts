import { nanoid } from 'nanoid'
import { getRawDb } from '../../infrastructure/db/connection'
import type { AITask } from '../../../shared/types/ai'
import type { DailyUsage } from '../../../shared/ipc-types'

export interface RecordUsageParams {
  provider: string
  modelId: string
  task: AITask
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number
  postId?: string
  personaId?: string
}

export class UsageLedger {
  record(params: RecordUsageParams): void {
    const db = getRawDb()
    db.prepare(
      `INSERT INTO llm_usage (id, ts, provider, model_id, task, prompt_tokens, completion_tokens, estimated_cost_usd, post_id, persona_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      nanoid(),
      Date.now(),
      params.provider,
      params.modelId,
      params.task,
      params.promptTokens,
      params.completionTokens,
      params.estimatedCostUsd,
      params.postId ?? null,
      params.personaId ?? null,
    )
  }

  list(limit = 100) {
    const db = getRawDb()
    return db
      .prepare(
        `SELECT id, ts, provider, model_id as modelId, task, prompt_tokens as promptTokens,
                completion_tokens as completionTokens, estimated_cost_usd as estimatedCostUsd,
                post_id as postId, persona_id as personaId
         FROM llm_usage ORDER BY ts DESC LIMIT ?`,
      )
      .all(limit)
  }

  dailySummary(days = 30): DailyUsage[] {
    const db = getRawDb()
    const since = Date.now() - days * 86_400_000
    const rows = db
      .prepare(
        `SELECT
           date(ts / 1000, 'unixepoch') as date,
           provider,
           SUM(estimated_cost_usd) as cost,
           SUM(prompt_tokens + completion_tokens) as tokens
         FROM llm_usage
         WHERE ts >= ?
         GROUP BY date, provider
         ORDER BY date DESC`,
      )
      .all(since) as { date: string; provider: string; cost: number; tokens: number }[]

    // Aggregate by date
    const byDate = new Map<string, DailyUsage>()
    for (const row of rows) {
      let entry = byDate.get(row.date)
      if (!entry) {
        entry = { date: row.date, totalCostUsd: 0, totalTokens: 0, byProvider: {} }
        byDate.set(row.date, entry)
      }
      entry.totalCostUsd += row.cost
      entry.totalTokens += row.tokens
      entry.byProvider[row.provider] = (entry.byProvider[row.provider] ?? 0) + row.cost
    }

    return [...byDate.values()]
  }

  todaySpend(): number {
    const db = getRawDb()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const row = db
      .prepare(`SELECT COALESCE(SUM(estimated_cost_usd), 0) as total FROM llm_usage WHERE ts >= ?`)
      .get(startOfDay.getTime()) as { total: number }
    return row.total
  }
}

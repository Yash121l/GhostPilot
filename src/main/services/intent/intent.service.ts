import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { getDb } from '../../infrastructure/db/connection'
import { intents, keyResults } from '../../infrastructure/db/schema'
import type { AuditService } from '../../application/audit/audit.service'
import type { Intent, KeyResult } from '../../../shared/types/intent'
import { AppError, ErrorCode } from '../../../shared/types/error'
import { createLogger } from '../../infrastructure/logger/logger'
import type { AIGateway } from '../ai-gateway/index'
import { AITask, ModelHint } from '../../../shared/types/ai'

const logger = createLogger('IntentService')

export class IntentService {
  constructor(
    _audit: AuditService,
    private readonly ai: AIGateway,
  ) {}

  async list(personaId?: string): Promise<Intent[]> {
    const db = getDb()
    const rows = personaId
      ? await db.select().from(intents).where(eq(intents.personaId, personaId))
      : await db.select().from(intents)

    const allKRs = await db.select().from(keyResults)
    const krMap = new Map<string, typeof allKRs>()
    for (const kr of allKRs) {
      const arr = krMap.get(kr.intentId) ?? []
      arr.push(kr)
      krMap.set(kr.intentId, arr)
    }

    return rows.map((r) => this.mapIntent(r, krMap.get(r.id) ?? []))
  }

  async create(input: Omit<Intent, 'id' | 'createdAt' | 'updatedAt' | 'keyResults'>): Promise<Intent> {
    const db = getDb()
    const id = nanoid()
    const now = new Date()

    await db.insert(intents).values({
      id,
      personaId: input.personaId,
      title: input.title,
      description: input.description,
      horizon: input.horizon,
      createdAt: now,
      updatedAt: now,
    })

    // Ask AI to decompose this goal into key results
    const krs = await this.decompose(id, input.title, input.description, input.horizon)
    for (const kr of krs) {
      await db.insert(keyResults).values({
        id: nanoid(),
        intentId: id,
        title: kr.title ?? 'Key result',
        target: kr.target ?? 0,
        current: 0,
        unit: kr.unit ?? '',
        weeklyQuota: JSON.stringify(kr.weeklyQuota ?? { postsPerWeek: 3, breakdown: {} }),
      })
    }

    logger.info({ msg: 'Intent created', id, krs: krs.length })
    return this.getById(id)
  }

  async update(id: string, input: Partial<Omit<Intent, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Intent> {
    const db = getDb()
    await db
      .update(intents)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.horizon !== undefined && { horizon: input.horizon }),
        updatedAt: new Date(),
      })
      .where(eq(intents.id, id))
    return this.getById(id)
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.delete(intents).where(eq(intents.id, id))
  }

  private async getById(id: string): Promise<Intent> {
    const db = getDb()
    const rows = await db.select().from(intents).where(eq(intents.id, id))
    if (!rows.length) throw new AppError({ code: ErrorCode.NOT_FOUND, message: `Intent ${id} not found` })
    const krs = await db.select().from(keyResults).where(eq(keyResults.intentId, id))
    return this.mapIntent(rows[0], krs)
  }

  private async decompose(
    intentId: string,
    title: string,
    description: string,
    horizon: string,
  ): Promise<Partial<KeyResult>[]> {
    try {
      const prompt = `Break this content goal into 2-3 measurable key results with weekly content quotas.

Goal: ${title}
Description: ${description}
Horizon: ${horizon}

Respond with a JSON array. Each object:
{
  "title": "string (e.g. 'Grow LinkedIn followers from 1K to 5K')",
  "target": number,
  "unit": "string (e.g. 'followers', 'posts', 'demo calls')",
  "weeklyQuota": {
    "postsPerWeek": number,
    "breakdown": { "linkedin": number, "twitter": number }
  }
}

Return ONLY the JSON array.`

      const res = await this.ai.complete({
        task: AITask.DECOMPOSE_OKR,
        hint: ModelHint.ECONOMY,
        prompt,
        maxTokens: 800,
        traceId: `intent:${intentId}`,
      })

      const jsonMatch = res.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []
      return JSON.parse(jsonMatch[0]) as Partial<KeyResult>[]
    } catch (e) {
      logger.warn({ msg: 'OKR decomposition failed, using defaults', error: String(e) })
      return [
        {
          title: 'Consistent publishing',
          target: 52,
          unit: 'posts',
          weeklyQuota: { postsPerWeek: 3, breakdown: { linkedin: 2, twitter: 1 } },
        },
      ]
    }
  }

  private mapIntent(
    r: typeof intents.$inferSelect,
    krs: (typeof keyResults.$inferSelect)[],
  ): Intent {
    return {
      id: r.id,
      personaId: r.personaId,
      title: r.title,
      description: r.description,
      horizon: r.horizon,
      keyResults: krs.map((kr) => ({
        id: kr.id,
        intentId: kr.intentId,
        title: kr.title,
        target: kr.target,
        current: kr.current,
        unit: kr.unit,
        weeklyQuota: JSON.parse(kr.weeklyQuota),
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}

import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { getDb } from '../../infrastructure/db/connection'
import { personas, styleFingerprints } from '../../infrastructure/db/schema'
import { AuditAction } from '../../infrastructure/db/schema'
import type { AuditService } from '../../application/audit/audit.service'
import type { Persona, StyleFingerprint } from '../../../shared/types/persona'
import { AppError, ErrorCode } from '../../../shared/types/error'
import { createLogger } from '../../infrastructure/logger/logger'

const logger = createLogger('PersonaService')

export class PersonaService {
  constructor(private readonly audit: AuditService) {}

  async list(): Promise<Persona[]> {
    const db = getDb()
    const rows = await db.select().from(personas)
    const fingerprints = await db.select().from(styleFingerprints)
    const fpMap = new Map(fingerprints.map((f) => [f.personaId, f]))

    return rows.map((r) => this.mapRow(r, fpMap.get(r.id)))
  }

  async get(id: string): Promise<Persona> {
    const db = getDb()
    const rows = await db.select().from(personas).where(eq(personas.id, id))
    if (!rows.length) {
      throw new AppError({ code: ErrorCode.PERSONA_NOT_FOUND, message: `Persona ${id} not found` })
    }
    const fpRows = await db.select().from(styleFingerprints).where(eq(styleFingerprints.personaId, id))
    return this.mapRow(rows[0], fpRows[0])
  }

  async create(input: Omit<Persona, 'id' | 'createdAt' | 'updatedAt' | 'latestFingerprint'>): Promise<Persona> {
    const db = getDb()
    const id = nanoid()
    const now = new Date()

    await db.insert(personas).values({
      id,
      name: input.name,
      bio: input.bio,
      pillars: JSON.stringify(input.pillars),
      styleHints: input.styleHints,
      createdAt: now,
      updatedAt: now,
    })

    this.audit.write({
      actor: 'user',
      action: AuditAction.PERSONA_UPDATED,
      entityType: 'personas',
      entityId: id,
      outcome: 'success',
      details: { name: input.name },
    })

    logger.info({ msg: 'Persona created', id, name: input.name })
    return this.get(id)
  }

  async update(id: string, input: Partial<Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Persona> {
    const db = getDb()
    const now = new Date()

    await db
      .update(personas)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.pillars !== undefined && { pillars: JSON.stringify(input.pillars) }),
        ...(input.styleHints !== undefined && { styleHints: input.styleHints }),
        updatedAt: now,
      })
      .where(eq(personas.id, id))

    this.audit.write({
      actor: 'user',
      action: AuditAction.PERSONA_UPDATED,
      entityType: 'personas',
      entityId: id,
      outcome: 'success',
    })

    return this.get(id)
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.delete(personas).where(eq(personas.id, id))
    this.audit.write({
      actor: 'user',
      action: AuditAction.PERSONA_UPDATED,
      entityType: 'personas',
      entityId: id,
      outcome: 'success',
      details: { deleted: true },
    })
  }

  private mapRow(
    r: typeof personas.$inferSelect,
    fp?: typeof styleFingerprints.$inferSelect,
  ): Persona {
    let latestFingerprint: StyleFingerprint | undefined
    if (fp) {
      latestFingerprint = {
        id: fp.id,
        personaId: fp.personaId,
        embedding: JSON.parse(fp.embeddingJson) as number[],
        descriptors: JSON.parse(fp.descriptors) as string[],
        avgSentenceLength: fp.avgSentenceLength,
        tone: fp.tone,
        computedAt: fp.computedAt,
      }
    }

    return {
      id: r.id,
      name: r.name,
      bio: r.bio,
      pillars: JSON.parse(r.pillars) as string[],
      styleHints: r.styleHints,
      latestFingerprint,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}

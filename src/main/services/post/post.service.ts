import { nanoid } from 'nanoid'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../../infrastructure/db/connection'
import { posts, draftVariants, jobs, personas } from '../../infrastructure/db/schema'
import { AuditAction } from '../../infrastructure/db/schema'
import type { AuditService } from '../../application/audit/audit.service'
import type { Post, DraftVariant, Job, ImageAttachment } from '../../../shared/types/post'
import { PostStatus } from '../../../shared/types/post'
import type { Platform } from '../../../shared/types/platform'
import { AppError, ErrorCode } from '../../../shared/types/error'
import { createLogger } from '../../infrastructure/logger/logger'

const logger = createLogger('PostService')

export class PostService {
  constructor(private readonly audit: AuditService) {}

  async create(input: {
    personaId: string
    body: string
    platforms: Platform[]
    images?: ImageAttachment[]
  }): Promise<Post> {
    const db = getDb()
    const id = nanoid()
    const now = new Date()

    // Resolve personaId — 'default' or unknown IDs must map to a real row (FK constraint)
    let personaId = input.personaId
    const personaExists =
      personaId !== 'default' &&
      (await db.select({ id: personas.id }).from(personas).where(eq(personas.id, personaId)))
        .length > 0

    if (!personaExists) {
      const existing = await db.select({ id: personas.id }).from(personas).limit(1)
      if (existing.length > 0) {
        personaId = existing[0].id
      } else {
        // No personas at all — seed a default one
        const defaultId = nanoid()
        await db.insert(personas).values({
          id: defaultId,
          name: 'Default',
          bio: '',
          pillars: '[]',
          styleHints: '',
          createdAt: now,
          updatedAt: now
        })
        personaId = defaultId
      }
    }

    await db.insert(posts).values({
      id,
      personaId,
      status: PostStatus.DRAFT,
      body: input.body,
      platforms: JSON.stringify(input.platforms),
      imagePaths: JSON.stringify((input.images ?? []).map(({ dataUrl: _, ...rest }) => rest)),
      attempts: 0,
      createdAt: now,
      updatedAt: now
    })

    this.audit.write({
      actor: 'user',
      action: AuditAction.POST_CREATED,
      entityType: 'posts',
      entityId: id,
      outcome: 'success'
    })

    logger.info({ msg: 'Post created', id })
    return this.get(id)
  }

  async get(id: string): Promise<Post> {
    const db = getDb()
    const rows = await db.select().from(posts).where(eq(posts.id, id))
    if (!rows.length) {
      throw new AppError({ code: ErrorCode.POST_NOT_FOUND, message: `Post ${id} not found` })
    }
    const variants = await db.select().from(draftVariants).where(eq(draftVariants.postId, id))
    return this.mapPost(rows[0], variants)
  }

  async list(opts: { personaId?: string; limit?: number; offset?: number } = {}): Promise<Post[]> {
    const db = getDb()
    const limit = opts.limit ?? 50
    const offset = opts.offset ?? 0

    const rows = await db
      .select()
      .from(posts)
      .where(opts.personaId ? eq(posts.personaId, opts.personaId) : undefined)
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset)

    const allVariants = await db.select().from(draftVariants)
    const variantsByPost = new Map<string, typeof allVariants>()
    for (const v of allVariants) {
      const arr = variantsByPost.get(v.postId) ?? []
      arr.push(v)
      variantsByPost.set(v.postId, arr)
    }

    return rows.map((r) => this.mapPost(r, variantsByPost.get(r.id) ?? []))
  }

  async setVariants(postId: string, variants: DraftVariant[]): Promise<Post> {
    const db = getDb()
    const now = new Date()

    // Replace existing variants
    await db.delete(draftVariants).where(eq(draftVariants.postId, postId))

    for (const v of variants) {
      await db.insert(draftVariants).values({
        id: v.id,
        postId,
        platform: v.platform,
        body: v.body,
        charCount: v.charCount,
        styleDriftScore: v.styleDriftScore,
        provider: v.provider,
        modelId: v.modelId,
        createdAt: now
      })
    }

    await db
      .update(posts)
      .set({ status: PostStatus.PENDING_APPROVAL, updatedAt: now })
      .where(eq(posts.id, postId))

    this.audit.write({
      actor: 'system',
      action: AuditAction.POST_VARIANT_GENERATED,
      entityType: 'posts',
      entityId: postId,
      outcome: 'success',
      details: { variantCount: variants.length }
    })

    return this.get(postId)
  }

  async approve(postId: string, variantId: string): Promise<Post> {
    const db = getDb()
    const rows = await db.select().from(posts).where(eq(posts.id, postId))
    if (!rows.length)
      throw new AppError({ code: ErrorCode.POST_NOT_FOUND, message: `Post ${postId} not found` })

    const allowed: string[] = [PostStatus.PENDING_APPROVAL, PostStatus.DRAFT]
    if (!allowed.includes(rows[0].status)) {
      throw new AppError({
        code: ErrorCode.POST_INVALID_TRANSITION,
        message: `Cannot approve post in status ${rows[0].status}`
      })
    }

    await db
      .update(posts)
      .set({ status: PostStatus.APPROVED, updatedAt: new Date() })
      .where(eq(posts.id, postId))

    this.audit.write({
      actor: 'user',
      action: AuditAction.POST_APPROVED,
      entityType: 'posts',
      entityId: postId,
      outcome: 'success',
      details: { variantId }
    })

    return this.get(postId)
  }

  async schedule(
    postId: string,
    variantId: string,
    platform: Platform,
    scheduledAt: Date
  ): Promise<Job> {
    const db = getDb()
    const jobId = nanoid()
    const now = new Date()

    await db.insert(jobs).values({
      id: jobId,
      postId,
      variantId,
      platform,
      scheduledAt,
      status: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now
    })

    await db
      .update(posts)
      .set({ status: PostStatus.SCHEDULED, scheduledAt, updatedAt: now })
      .where(eq(posts.id, postId))

    this.audit.write({
      actor: 'user',
      action: AuditAction.POST_SCHEDULED,
      entityType: 'posts',
      entityId: postId,
      outcome: 'success',
      details: { jobId, platform, scheduledAt: scheduledAt.toISOString() }
    })

    logger.info({ msg: 'Post scheduled', postId, jobId, platform, scheduledAt })
    return { id: jobId, postId, variantId, platform, scheduledAt, attempts: 0, status: 'pending' }
  }

  async setImages(postId: string, images: ImageAttachment[]): Promise<Post> {
    const db = getDb()
    // Strip dataUrl — renderer-only field, must not be persisted
    const persisted = images.map(({ dataUrl: _, ...rest }) => rest)
    await db
      .update(posts)
      .set({ imagePaths: JSON.stringify(persisted), updatedAt: new Date() })
      .where(eq(posts.id, postId))
    return this.get(postId)
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.delete(posts).where(eq(posts.id, id))
    this.audit.write({
      actor: 'user',
      action: AuditAction.POST_DELETED,
      entityType: 'posts',
      entityId: id,
      outcome: 'success'
    })
  }

  private mapPost(
    r: typeof posts.$inferSelect,
    variants: (typeof draftVariants.$inferSelect)[]
  ): Post {
    return {
      id: r.id,
      personaId: r.personaId,
      status: r.status as PostStatus,
      body: r.body,
      platforms: JSON.parse(r.platforms) as Platform[],
      variants: variants.map((v) => ({
        id: v.id,
        postId: v.postId,
        platform: v.platform as Platform,
        body: v.body,
        charCount: v.charCount,
        styleDriftScore: v.styleDriftScore,
        createdAt: v.createdAt,
        provider: v.provider,
        modelId: v.modelId
      })),
      images: JSON.parse(r.imagePaths ?? '[]') as ImageAttachment[],
      scheduledAt: r.scheduledAt ?? undefined,
      publishedAt: r.publishedAt ?? undefined,
      attempts: r.attempts,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }
  }
}

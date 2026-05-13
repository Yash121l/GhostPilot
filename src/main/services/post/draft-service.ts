import { nanoid } from 'nanoid'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { getDb } from '../../infrastructure/db/connection'
import { posts, draftVariants, llmUsage } from '../../infrastructure/db/schema'
import { AuditAction } from '../../infrastructure/db/schema'
import type { AuditService } from '../../application/audit/audit.service'
import type { PostService } from './post.service'
import type { Post, DraftVariant } from '../../../shared/types/post'
import { PostStatus } from '../../../shared/types/post'
import type { Platform } from '../../../shared/types/platform'
import { AppError, ErrorCode } from '../../../shared/types/error'
import { createLogger } from '../../infrastructure/logger/logger'

const logger = createLogger('DraftService')

/** Status transitions allowed by this service. */
const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  [PostStatus.DRAFT]: [PostStatus.PENDING_APPROVAL, PostStatus.ARCHIVED],
  [PostStatus.PENDING_APPROVAL]: [PostStatus.APPROVED, PostStatus.DRAFT, PostStatus.ARCHIVED],
  [PostStatus.APPROVED]: [PostStatus.SCHEDULED, PostStatus.DRAFT, PostStatus.ARCHIVED],
  [PostStatus.SCHEDULED]: [PostStatus.APPROVED, PostStatus.ARCHIVED],
  [PostStatus.PUBLISHING]: [PostStatus.PUBLISHED, PostStatus.FAILED],
  [PostStatus.PUBLISHED]: [PostStatus.ARCHIVED],
  [PostStatus.FAILED]: [PostStatus.DRAFT, PostStatus.ARCHIVED],
  [PostStatus.ARCHIVED]: [],
}

export interface GenerationAuditEntry {
  postId: string
  variantId: string
  provider: string
  modelId: string
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number
  platform: Platform
}

export class DraftService {
  constructor(
    private readonly audit: AuditService,
    private readonly postService: PostService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async create(input: { personaId: string; body: string; platforms: Platform[] }): Promise<Post> {
    return this.postService.create(input)
  }

  async get(id: string): Promise<Post> {
    return this.postService.get(id)
  }

  async listDrafts(opts: {
    personaId?: string
    statuses?: PostStatus[]
    limit?: number
    offset?: number
  } = {}): Promise<Post[]> {
    const db = getDb()
    const statuses = opts.statuses ?? [PostStatus.DRAFT, PostStatus.PENDING_APPROVAL]

    const rows = await db
      .select()
      .from(posts)
      .where(
        and(
          opts.personaId ? eq(posts.personaId, opts.personaId) : undefined,
          inArray(posts.status, statuses),
        ),
      )
      .orderBy(desc(posts.updatedAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0)

    const allVariants = rows.length
      ? await db.select().from(draftVariants).where(
          inArray(
            draftVariants.postId,
            rows.map((r) => r.id),
          ),
        )
      : []

    const variantsByPost = new Map<string, typeof allVariants>()
    for (const v of allVariants) {
      const arr = variantsByPost.get(v.postId) ?? []
      arr.push(v)
      variantsByPost.set(v.postId, arr)
    }

    return rows.map((r) => this.mapPost(r, variantsByPost.get(r.id) ?? []))
  }

  async updateBody(id: string, body: string): Promise<Post> {
    const db = getDb()
    const rows = await db.select().from(posts).where(eq(posts.id, id))
    if (!rows.length) throw new AppError({ code: ErrorCode.POST_NOT_FOUND, message: `Post ${id} not found` })

    const allowedStatuses: string[] = [PostStatus.DRAFT, PostStatus.PENDING_APPROVAL]
    if (!allowedStatuses.includes(rows[0].status)) {
      throw new AppError({
        code: ErrorCode.POST_INVALID_TRANSITION,
        message: `Cannot edit body of post in status ${rows[0].status}`,
      })
    }

    await db.update(posts).set({ body, updatedAt: new Date() }).where(eq(posts.id, id))

    this.audit.write({
      actor: 'user',
      action: AuditAction.POST_CREATED,
      entityType: 'posts',
      entityId: id,
      outcome: 'success',
      details: { action: 'body_updated', chars: body.length },
    })

    logger.info({ msg: 'Draft body updated', id })
    return this.postService.get(id)
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    const rows = await db.select().from(posts).where(eq(posts.id, id))
    if (!rows.length) return

    const publishedStatuses: string[] = [PostStatus.PUBLISHED, PostStatus.SCHEDULED, PostStatus.PUBLISHING]
    if (publishedStatuses.includes(rows[0].status)) {
      throw new AppError({
        code: ErrorCode.POST_INVALID_TRANSITION,
        message: `Cannot delete a post in status ${rows[0].status}`,
      })
    }

    return this.postService.delete(id)
  }

  // ─── Status transitions ──────────────────────────────────────────────────────

  async transitionStatus(id: string, to: PostStatus): Promise<Post> {
    const db = getDb()
    const rows = await db.select().from(posts).where(eq(posts.id, id))
    if (!rows.length) throw new AppError({ code: ErrorCode.POST_NOT_FOUND, message: `Post ${id} not found` })

    const from = rows[0].status as PostStatus
    const allowed = ALLOWED_TRANSITIONS[from] ?? []
    if (!allowed.includes(to)) {
      throw new AppError({
        code: ErrorCode.POST_INVALID_TRANSITION,
        message: `Cannot transition post from ${from} → ${to}`,
      })
    }

    await db.update(posts).set({ status: to, updatedAt: new Date() }).where(eq(posts.id, id))
    logger.info({ msg: 'Status transitioned', id, from, to })
    return this.postService.get(id)
  }

  // ─── Generation audit ────────────────────────────────────────────────────────

  async logGeneration(entry: GenerationAuditEntry): Promise<void> {
    const db = getDb()
    await db.insert(llmUsage).values({
      id: nanoid(),
      ts: new Date(),
      provider: entry.provider,
      modelId: entry.modelId,
      task: 'adapt_variant',
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      estimatedCostUsd: entry.estimatedCostUsd,
      postId: entry.postId,
    })

    this.audit.write({
      actor: 'system',
      action: AuditAction.POST_VARIANT_GENERATED,
      entityType: 'draft_variants',
      entityId: entry.variantId,
      outcome: 'success',
      details: {
        provider: entry.provider,
        model: entry.modelId,
        platform: entry.platform,
        costUsd: entry.estimatedCostUsd,
      },
    })
  }

  // ─── Mapping ─────────────────────────────────────────────────────────────────

  private mapPost(
    r: typeof posts.$inferSelect,
    variants: (typeof draftVariants.$inferSelect)[],
  ): Post {
    return {
      id: r.id,
      personaId: r.personaId,
      status: r.status as PostStatus,
      body: r.body,
      platforms: JSON.parse(r.platforms) as Platform[],
      variants: variants.map(
        (v): DraftVariant => ({
          id: v.id,
          postId: v.postId,
          platform: v.platform as Platform,
          body: v.body,
          charCount: v.charCount,
          styleDriftScore: v.styleDriftScore,
          createdAt: v.createdAt,
          provider: v.provider,
          modelId: v.modelId,
        }),
      ),
      scheduledAt: r.scheduledAt ?? undefined,
      publishedAt: r.publishedAt ?? undefined,
      attempts: r.attempts,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}

import * as cron from 'node-cron'
import { getDb } from '../../infrastructure/db/connection'
import { jobs, draftVariants, posts } from '../../infrastructure/db/schema'
import { AuditAction } from '../../infrastructure/db/schema'
import { eq, and, lte } from 'drizzle-orm'
import type { AuditService } from '../../application/audit/audit.service'
import type { OAuthManager } from '../social/oauth-manager'
import type { SocialConnector } from '../social/interface'
import type { Platform } from '../../../shared/types/platform'
import { createLogger } from '../../infrastructure/logger/logger'
import { MAX_POST_ATTEMPTS, CRON_PUBLISH_DISPATCHER } from '../../../shared/constants'

const logger = createLogger('SchedulerService')

export class SchedulerService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dispatcherTask: any = null
  private connectors = new Map<string, SocialConnector>()

  constructor(
    private readonly audit: AuditService,
    private readonly oauthManager: OAuthManager,
  ) {}

  register(connector: SocialConnector): void {
    this.connectors.set(connector.platform, connector)
  }

  start(): void {
    if (this.dispatcherTask) return

    this.dispatcherTask = cron.schedule(CRON_PUBLISH_DISPATCHER, () => {
      this.dispatch().catch((e) => logger.error({ msg: 'Dispatcher error', error: String(e) }))
    })

    logger.info({ msg: 'Scheduler started', cron: CRON_PUBLISH_DISPATCHER })
  }

  stop(): void {
    this.dispatcherTask?.stop()
    this.dispatcherTask = null
  }

  private async dispatch(): Promise<void> {
    const db = getDb()
    const now = new Date()

    const dueJobs = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, 'pending'), lte(jobs.scheduledAt, now)))

    if (!dueJobs.length) return
    logger.info({ msg: 'Dispatching due jobs', count: dueJobs.length })

    for (const job of dueJobs) {
      await this.publishJob(job)
    }
  }

  private async publishJob(job: typeof jobs.$inferSelect): Promise<void> {
    const db = getDb()
    const connector = this.connectors.get(job.platform)

    if (!connector) {
      logger.warn({ msg: 'No connector for platform', platform: job.platform, jobId: job.id })
      await db.update(jobs).set({ status: 'failed', lastError: 'No connector', updatedAt: new Date() }).where(eq(jobs.id, job.id))
      return
    }

    const tokens = await this.oauthManager.getTokens(job.platform as Platform)
    if (!tokens) {
      logger.warn({ msg: 'No tokens for platform', platform: job.platform, jobId: job.id })
      await db
        .update(jobs)
        .set({ status: 'failed', lastError: 'Not connected to platform', updatedAt: new Date() })
        .where(eq(jobs.id, job.id))
      return
    }

    const variantRows = await db.select().from(draftVariants).where(eq(draftVariants.id, job.variantId))
    if (!variantRows.length) {
      await db.update(jobs).set({ status: 'failed', lastError: 'Variant not found', updatedAt: new Date() }).where(eq(jobs.id, job.id))
      return
    }

    await db.update(jobs).set({ status: 'running', updatedAt: new Date() }).where(eq(jobs.id, job.id))

    try {
      const result = await connector.publish({ body: variantRows[0].body }, tokens)

      await db.update(jobs).set({ status: 'done', updatedAt: new Date() }).where(eq(jobs.id, job.id))
      await db.update(posts).set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(eq(posts.id, job.postId))

      this.audit.write({
        actor: 'system',
        action: AuditAction.POST_PUBLISHED,
        entityType: 'posts',
        entityId: job.postId,
        outcome: 'success',
        details: { platform: job.platform, externalId: result.externalId, url: result.url },
      })

      logger.info({ msg: 'Post published', postId: job.postId, platform: job.platform, url: result.url })
    } catch (e) {
      const attempts = job.attempts + 1
      const status = attempts >= MAX_POST_ATTEMPTS ? 'failed' : 'pending'

      await db
        .update(jobs)
        .set({ status, attempts, lastError: String(e), updatedAt: new Date() })
        .where(eq(jobs.id, job.id))

      this.audit.write({
        actor: 'system',
        action: AuditAction.POST_PUBLISH_FAILED,
        entityType: 'posts',
        entityId: job.postId,
        outcome: 'failure',
        errorCode: 'PUBLISH_ERROR',
        details: { platform: job.platform, attempt: attempts, error: String(e) },
      })

      logger.error({ msg: 'Publish failed', jobId: job.id, platform: job.platform, attempts, error: String(e) })
    }
  }
}

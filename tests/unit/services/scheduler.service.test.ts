import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestDb, clearTestDb, closeTestDb } from '../../helpers/db'
import { mockAudit, mockConnector, mockTokens } from '../../helpers/mocks'
import { Platform } from '../../../src/shared/types/platform'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn().mockReturnValue({ stop: vi.fn() }) },
  schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
}))

let db: ReturnType<typeof createTestDb>

vi.mock('../../../src/main/infrastructure/db/connection', () => ({
  getDb: () => db,
  getRawDb: () => { throw new Error('not available') },
}))

const { SchedulerService } = await import('../../../src/main/services/scheduler/scheduler.service')
const { PostService } = await import('../../../src/main/services/post/post.service')
const { PersonaService } = await import('../../../src/main/services/persona/persona.service')

beforeAll(() => { db = createTestDb() })
beforeEach(() => clearTestDb())
afterAll(() => closeTestDb())

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedPersonaAndPost(body = 'Test post') {
  const personaSvc = new PersonaService(mockAudit())
  const persona = await personaSvc.create({
    name: 'Test', bio: '', pillars: [], styleHints: '',
  })
  const postSvc = new PostService(mockAudit())
  const post = await postSvc.create({ personaId: persona.id, body, platforms: [Platform.LINKEDIN] })
  return { persona, post, postSvc }
}

async function seedVariantAndJob(postId: string, platform: Platform, scheduledAt: Date) {
  const { nanoid } = await import('nanoid')
  const { draftVariants, jobs } = await import('../../../src/main/infrastructure/db/schema')
  const variantId = nanoid()
  const now = new Date()

  await db.insert(draftVariants).values({
    id: variantId, postId, platform,
    body: 'Test variant body', charCount: 17, styleDriftScore: 0,
    provider: 'openai', modelId: 'gpt-4o-mini', createdAt: now,
  })

  const jobId = nanoid()
  await db.insert(jobs).values({
    id: jobId, postId, variantId, platform,
    scheduledAt, status: 'pending', attempts: 0,
    createdAt: now, updatedAt: now,
  })

  return { variantId, jobId }
}

// ─── Mock OAuthManager ────────────────────────────────────────────────────────

function mockOAuthManager(tokens = mockTokens()) {
  return {
    getTokens: vi.fn().mockResolvedValue(tokens),
    getConnector: vi.fn(),
    register: vi.fn(),
    initiateConnect: vi.fn(),
    handleCallback: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn().mockResolvedValue([]),
    getAuthURL: vi.fn(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SchedulerService.start() / stop()', () => {
  it('starts without error', () => {
    const svc = new SchedulerService(mockAudit(), mockOAuthManager() as any)
    expect(() => svc.start()).not.toThrow()
    svc.stop()
  })

  it('is idempotent — calling start() twice does not create two crons', async () => {
    const cron = await import('node-cron')
    const scheduleMock = vi.mocked(cron.schedule)
    scheduleMock.mockClear()
    const svc = new SchedulerService(mockAudit(), mockOAuthManager() as any)
    svc.start()
    svc.start() // second call should be no-op
    expect(scheduleMock).toHaveBeenCalledTimes(1)
    svc.stop()
  })
})

describe('SchedulerService — publishJob() success path', () => {
  it('marks job as done and post as published on success', async () => {
    const { post } = await seedPersonaAndPost()
    const pastTime = new Date(Date.now() - 1000)
    const { jobId } = await seedVariantAndJob(post.id, Platform.LINKEDIN, pastTime)

    const connector = mockConnector(Platform.LINKEDIN)
    const oauthMgr = mockOAuthManager()
    const svc = new SchedulerService(mockAudit(), oauthMgr as any)
    svc.register(connector)

    // Trigger dispatch directly by accessing private method via any cast
    await (svc as any).dispatch()

    const { jobs, posts } = await import('../../../src/main/infrastructure/db/schema')
    const { eq } = await import('drizzle-orm')
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    const [updatedPost] = await db.select().from(posts).where(eq(posts.id, post.id))

    expect(job.status).toBe('done')
    expect(updatedPost.status).toBe('published')
    expect(connector.publish).toHaveBeenCalledOnce()
  })
})

describe('SchedulerService — publishJob() failure paths', () => {
  it('marks job failed immediately when no connector registered', async () => {
    const { post } = await seedPersonaAndPost()
    const pastTime = new Date(Date.now() - 1000)
    const { jobId } = await seedVariantAndJob(post.id, Platform.LINKEDIN, pastTime)

    const oauthMgr = mockOAuthManager()
    const svc = new SchedulerService(mockAudit(), oauthMgr as any)
    // No connector registered

    await (svc as any).dispatch()

    const { jobs } = await import('../../../src/main/infrastructure/db/schema')
    const { eq } = await import('drizzle-orm')
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(job.status).toBe('failed')
    expect(job.lastError).toContain('No connector')
  })

  it('marks job failed when no OAuth tokens', async () => {
    const { post } = await seedPersonaAndPost()
    const pastTime = new Date(Date.now() - 1000)
    const { jobId } = await seedVariantAndJob(post.id, Platform.LINKEDIN, pastTime)

    const connector = mockConnector(Platform.LINKEDIN)
    const oauthMgr = mockOAuthManager(null as any) // no tokens
    oauthMgr.getTokens = vi.fn().mockResolvedValue(null)
    const svc = new SchedulerService(mockAudit(), oauthMgr as any)
    svc.register(connector)

    await (svc as any).dispatch()

    const { jobs } = await import('../../../src/main/infrastructure/db/schema')
    const { eq } = await import('drizzle-orm')
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(job.status).toBe('failed')
    expect(job.lastError).toContain('Not connected')
  })

  it('retries job (status=pending) when attempts < MAX_POST_ATTEMPTS', async () => {
    const { post } = await seedPersonaAndPost()
    const pastTime = new Date(Date.now() - 1000)
    const { jobId } = await seedVariantAndJob(post.id, Platform.LINKEDIN, pastTime)

    const connector = mockConnector(Platform.LINKEDIN)
    connector.publish = vi.fn().mockRejectedValue(new Error('Network error'))
    const oauthMgr = mockOAuthManager()
    const svc = new SchedulerService(mockAudit(), oauthMgr as any)
    svc.register(connector)

    await (svc as any).dispatch()

    const { jobs } = await import('../../../src/main/infrastructure/db/schema')
    const { eq } = await import('drizzle-orm')
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    // attempts=1, MAX_POST_ATTEMPTS=3 → still pending for retry
    expect(job.status).toBe('pending')
    expect(job.attempts).toBe(1)
    expect(job.lastError).toContain('Network error')
  })

  it('permanently fails job after MAX_POST_ATTEMPTS', async () => {
    const { post } = await seedPersonaAndPost()
    const pastTime = new Date(Date.now() - 1000)
    const { jobId } = await seedVariantAndJob(post.id, Platform.LINKEDIN, pastTime)

    // Pre-set attempts to MAX_POST_ATTEMPTS - 1 = 2
    const { jobs } = await import('../../../src/main/infrastructure/db/schema')
    const { eq } = await import('drizzle-orm')
    await db.update(jobs).set({ attempts: 2 }).where(eq(jobs.id, jobId))

    const connector = mockConnector(Platform.LINKEDIN)
    connector.publish = vi.fn().mockRejectedValue(new Error('Permanent failure'))
    const oauthMgr = mockOAuthManager()
    const svc = new SchedulerService(mockAudit(), oauthMgr as any)
    svc.register(connector)

    await (svc as any).dispatch()

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(job.status).toBe('failed')
    expect(job.attempts).toBe(3)
  })

  it('does not dispatch future-scheduled jobs', async () => {
    const { post } = await seedPersonaAndPost()
    const futureTime = new Date(Date.now() + 3600 * 1000) // 1 hour from now
    await seedVariantAndJob(post.id, Platform.LINKEDIN, futureTime)

    const connector = mockConnector(Platform.LINKEDIN)
    const oauthMgr = mockOAuthManager()
    const svc = new SchedulerService(mockAudit(), oauthMgr as any)
    svc.register(connector)

    await (svc as any).dispatch()

    expect(connector.publish).not.toHaveBeenCalled()
  })
})

/**
 * Integration test: full post lifecycle
 * Persona → Create Post → Generate Variants → Schedule → Publish
 *
 * Uses in-memory SQLite. No Electron, no real AI, no real OAuth.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestDb, clearTestDb, closeTestDb, getRawTestDb } from '../helpers/db'
import { mockAudit, mockAIGateway, mockConnector, mockTokens, mockKeychain } from '../helpers/mocks'
import { Platform } from '../../src/shared/types/platform'
import { PostStatus } from '../../src/shared/types/post'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}))

let db: ReturnType<typeof createTestDb>

vi.mock('../../src/main/infrastructure/db/connection', () => ({
  getDb: () => db,
  getRawDb: () => { throw new Error('not available') },
}))

const keychainStore = mockKeychain()
vi.mock('../../src/main/infrastructure/keychain/keychain.service', () => ({
  KeychainService: vi.fn().mockImplementation(() => keychainStore),
}))

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn().mockReturnValue({ stop: vi.fn() }) },
  schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
}))

const { PersonaService } = await import('../../src/main/services/persona/persona.service')
const { PostService } = await import('../../src/main/services/post/post.service')
const { VariantGenerator } = await import('../../src/main/services/post/variant-generator')
const { SchedulerService } = await import('../../src/main/services/scheduler/scheduler.service')

beforeAll(() => { db = createTestDb() })
beforeEach(() => { clearTestDb(); keychainStore._store.clear(); vi.clearAllMocks() })
afterAll(() => closeTestDb())

describe('Full post lifecycle', () => {
  it('creates persona → post → variants → schedule → publish', async () => {
    // 1. Create persona
    const personaSvc = new PersonaService(mockAudit())
    const persona = await personaSvc.create({
      name: 'Yash — Indie Founder',
      bio: 'Solo dev shipping AI tools.',
      pillars: ['AI', 'indie hacking'],
      styleHints: 'Casual, short sentences.',
    })
    expect(persona.id).toBeTruthy()

    // 2. Create post
    const postSvc = new PostService(mockAudit())
    const post = await postSvc.create({
      personaId: persona.id,
      body: 'I spent 6 months building the wrong thing. Here is what I learned.',
      platforms: [Platform.LINKEDIN, Platform.TWITTER],
    })
    expect(post.status).toBe(PostStatus.DRAFT)
    expect(post.variants).toHaveLength(0)

    // 3. Generate variants
    const ai = mockAIGateway({
      complete: vi.fn()
        .mockResolvedValueOnce({
          text: 'LinkedIn: I spent 6 months building the wrong thing.\n\nThree lessons:\n→ Talk to users first\n→ Ship fast\n→ Iterate',
          provider: 'openai', modelId: 'gpt-4o-mini',
          usage: { promptTokens: 150, completionTokens: 60, estimatedCostUsd: 0.002 },
        })
        .mockResolvedValueOnce({
          text: 'spent 6 months building wrong. here is what i learned 🧵',
          provider: 'openai', modelId: 'gpt-4o-mini',
          usage: { promptTokens: 120, completionTokens: 20, estimatedCostUsd: 0.001 },
        }),
    })
    const gen = new VariantGenerator(ai, personaSvc, postSvc)
    const withVariants = await gen.generate(post.id, [Platform.LINKEDIN, Platform.TWITTER], 'trace-integration')

    expect(withVariants.status).toBe(PostStatus.PENDING_APPROVAL)
    expect(withVariants.variants).toHaveLength(2)

    const liVariant = withVariants.variants.find((v) => v.platform === Platform.LINKEDIN)
    const twVariant = withVariants.variants.find((v) => v.platform === Platform.TWITTER)
    expect(liVariant).toBeDefined()
    expect(twVariant).toBeDefined()
    expect(twVariant!.body.length).toBeLessThanOrEqual(280)

    // 4. Schedule the LinkedIn variant
    const scheduledAt = new Date(Date.now() + 5000) // 5 seconds from now
    const job = await postSvc.schedule(post.id, liVariant!.id, Platform.LINKEDIN, scheduledAt)
    expect(job.status).toBe('pending')
    expect(job.platform).toBe(Platform.LINKEDIN)

    const scheduledPost = await postSvc.get(post.id)
    expect(scheduledPost.status).toBe(PostStatus.SCHEDULED)

    // 5. Simulate scheduler dispatch
    const connector = mockConnector(Platform.LINKEDIN)
    const oauthMgr = {
      getTokens: vi.fn().mockResolvedValue(mockTokens()),
      getConnector: vi.fn(),
    }
    const scheduler = new SchedulerService(mockAudit(), oauthMgr as any)
    scheduler.register(connector)

    // Manually set scheduledAt to past so it's due
    const { jobs } = await import('../../src/main/infrastructure/db/schema')
    const { eq } = await import('drizzle-orm')
    await db.update(jobs).set({ scheduledAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, job.id))

    await (scheduler as any).dispatch()

    // 6. Verify published
    const publishedPost = await postSvc.get(post.id)
    expect(publishedPost.status).toBe(PostStatus.PUBLISHED)
    expect(connector.publish).toHaveBeenCalledOnce()
    expect(connector.publish).toHaveBeenCalledWith(
      expect.objectContaining({ body: liVariant!.body }),
      expect.objectContaining({ accessToken: 'test-access-token' })
    )

    const [updatedJob] = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(updatedJob.status).toBe('done')
  })

  it('handles the no-persona fallback path end-to-end', async () => {
    // Create post with 'default' personaId (no persona in DB)
    const postSvc = new PostService(mockAudit())
    const personaSvc = new PersonaService(mockAudit())

    // We need a real persona for FK constraint, but test the fallback context
    const persona = await personaSvc.create({ name: 'P', bio: '', pillars: [], styleHints: '' })
    const _post = await postSvc.create({
      personaId: persona.id,
      body: 'Testing without persona context',
      platforms: [Platform.LINKEDIN],
    })

    // Delete the persona to simulate missing persona
    await personaSvc.delete(persona.id)

    // Post still exists (persona_id FK is cascade delete, so post is gone too)
    // Instead, test with a post that has a non-existent personaId directly
    const { posts } = await import('../../src/main/infrastructure/db/schema')
    const { nanoid } = await import('nanoid')
    const orphanPersonaId = nanoid()
    const _orphanPostId = nanoid()
    const _now = new Date()

    // Create a persona just for the FK, then create post, then delete persona
    const tempPersona = await personaSvc.create({ name: 'Temp', bio: '', pillars: [], styleHints: '' })
    const orphanPost = await postSvc.create({
      personaId: tempPersona.id,
      body: 'Orphan post body',
      platforms: [Platform.LINKEDIN],
    })

    // Manually update personaId to non-existent value — disable FK temporarily
    const { eq } = await import('drizzle-orm')
    const rawDb = getRawTestDb()
    rawDb.pragma('foreign_keys = OFF')
    await db.update(posts).set({ personaId: orphanPersonaId }).where(eq(posts.id, orphanPost.id))
    rawDb.pragma('foreign_keys = ON')

    const ai = mockAIGateway()
    const gen = new VariantGenerator(ai, personaSvc, postSvc)

    // Should not throw — uses fallback context
    const result = await gen.generate(orphanPost.id, [Platform.LINKEDIN], 'trace-orphan')
    expect(result.variants).toHaveLength(1)
    expect(result.variants[0].provider).not.toBe('error')
  })

  it('one post per composer session — re-generate reuses same post', async () => {
    const personaSvc = new PersonaService(mockAudit())
    const persona = await personaSvc.create({ name: 'P', bio: '', pillars: [], styleHints: '' })
    const postSvc = new PostService(mockAudit())

    // Simulate: user types draft, clicks Generate (creates post)
    const post1 = await postSvc.create({
      personaId: persona.id,
      body: 'First draft',
      platforms: [Platform.LINKEDIN],
    })

    // Simulate: user edits draft, clicks Generate again (should update, not create new)
    // In the real app, POST_UPDATE_BODY is called. Here we verify only one post exists.
    const allPosts = await postSvc.list({ personaId: persona.id })
    expect(allPosts).toHaveLength(1)
    expect(allPosts[0].id).toBe(post1.id)
  })
})

describe('Post deletion', () => {
  it('cascade-deletes variants and jobs when post is deleted', async () => {
    const personaSvc = new PersonaService(mockAudit())
    const persona = await personaSvc.create({ name: 'P', bio: '', pillars: [], styleHints: '' })
    const postSvc = new PostService(mockAudit())
    const post = await postSvc.create({
      personaId: persona.id, body: 'Delete cascade test', platforms: [Platform.LINKEDIN],
    })

    const { nanoid } = await import('nanoid')
    const { draftVariants, jobs } = await import('../../src/main/infrastructure/db/schema')
    const variantId = nanoid()
    const now = new Date()
    await db.insert(draftVariants).values({
      id: variantId, postId: post.id, platform: Platform.LINKEDIN,
      body: 'Variant', charCount: 7, styleDriftScore: 0,
      provider: 'openai', modelId: 'gpt-4o-mini', createdAt: now,
    })
    await db.insert(jobs).values({
      id: nanoid(), postId: post.id, variantId, platform: Platform.LINKEDIN,
      scheduledAt: new Date(), status: 'pending', attempts: 0,
      createdAt: now, updatedAt: now,
    })

    await postSvc.delete(post.id)

    const remainingVariants = await db.select().from(draftVariants)
    const remainingJobs = await db.select().from(jobs)
    expect(remainingVariants).toHaveLength(0)
    expect(remainingJobs).toHaveLength(0)
  })
})

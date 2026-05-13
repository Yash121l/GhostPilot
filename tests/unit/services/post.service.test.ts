/**
 * PostService unit tests.
 * Uses an in-memory SQLite database — no Electron dependency.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestDb, clearTestDb, closeTestDb } from '../../helpers/db'
import { mockAudit } from '../../helpers/mocks'
import { Platform } from '../../../src/shared/types/platform'
import { PostStatus } from '../../../src/shared/types/post'
import { ErrorCode } from '../../../src/shared/types/error'

// ─── Mock electron and DB connection ─────────────────────────────────────────

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

let db: ReturnType<typeof createTestDb>

vi.mock('../../../src/main/infrastructure/db/connection', () => ({
  getDb: () => db,
  getRawDb: () => { throw new Error('getRawDb not available in tests') },
}))

// Import after mocks are set up
const { PostService } = await import('../../../src/main/services/post/post.service')

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => { db = createTestDb() })
beforeEach(() => clearTestDb())
afterAll(() => closeTestDb())

function makeService() {
  return new PostService(mockAudit())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedPersona() {
  const { personas } = await import('../../../src/main/infrastructure/db/schema')
  const { nanoid } = await import('nanoid')
  const id = nanoid()
  const now = new Date()
  await db.insert(personas).values({
    id, name: 'Test Persona', bio: '', pillars: '[]', styleHints: '',
    createdAt: now, updatedAt: now,
  })
  return id
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PostService.create()', () => {
  it('creates a post with DRAFT status', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Hello world', platforms: [Platform.LINKEDIN] })

    expect(post.id).toBeTruthy()
    expect(post.status).toBe(PostStatus.DRAFT)
    expect(post.body).toBe('Hello world')
    expect(post.platforms).toEqual([Platform.LINKEDIN])
    expect(post.variants).toEqual([])
    expect(post.attempts).toBe(0)
  })

  it('creates a post for multiple platforms', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const platforms = [Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM]
    const post = await svc.create({ personaId, body: 'Multi-platform post', platforms })

    expect(post.platforms).toEqual(platforms)
  })

  it('writes an audit entry', async () => {
    const personaId = await seedPersona()
    const audit = mockAudit()
    const svc = new PostService(audit)
    await svc.create({ personaId, body: 'Audit test', platforms: [Platform.LINKEDIN] })

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'POST_CREATED', outcome: 'success' })
    )
  })
})

describe('PostService.get()', () => {
  it('retrieves a created post by ID', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const created = await svc.create({ personaId, body: 'Get test', platforms: [Platform.TWITTER] })
    const fetched = await svc.get(created.id)

    expect(fetched.id).toBe(created.id)
    expect(fetched.body).toBe('Get test')
  })

  it('throws POST_NOT_FOUND for unknown ID', async () => {
    const svc = makeService()
    await expect(svc.get('nonexistent-id')).rejects.toMatchObject({
      code: ErrorCode.POST_NOT_FOUND,
    })
  })
})

describe('PostService.list()', () => {
  it('returns empty array when no posts', async () => {
    const svc = makeService()
    const posts = await svc.list()
    expect(posts).toEqual([])
  })

  it('returns all posts ordered by createdAt DESC', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    await svc.create({ personaId, body: 'First', platforms: [Platform.LINKEDIN] })
    await svc.create({ personaId, body: 'Second', platforms: [Platform.LINKEDIN] })
    await svc.create({ personaId, body: 'Third', platforms: [Platform.LINKEDIN] })

    const posts = await svc.list()
    expect(posts).toHaveLength(3)
    // Most recent first
    expect(posts[0].body).toBe('Third')
    expect(posts[2].body).toBe('First')
  })

  it('filters by personaId', async () => {
    const p1 = await seedPersona()
    const p2 = await seedPersona()
    const svc = makeService()
    await svc.create({ personaId: p1, body: 'P1 post', platforms: [Platform.LINKEDIN] })
    await svc.create({ personaId: p2, body: 'P2 post', platforms: [Platform.LINKEDIN] })

    const p1Posts = await svc.list({ personaId: p1 })
    expect(p1Posts).toHaveLength(1)
    expect(p1Posts[0].body).toBe('P1 post')
  })

  it('respects limit', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    for (let i = 0; i < 5; i++) {
      await svc.create({ personaId, body: `Post ${i}`, platforms: [Platform.LINKEDIN] })
    }
    const posts = await svc.list({ limit: 3 })
    expect(posts).toHaveLength(3)
  })
})

describe('PostService.setVariants()', () => {
  it('sets variants and transitions to PENDING_APPROVAL', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Variant test', platforms: [Platform.LINKEDIN] })

    const { nanoid } = await import('nanoid')
    const variants = [{
      id: nanoid(), postId: post.id, platform: Platform.LINKEDIN,
      body: 'LinkedIn variant', charCount: 16, styleDriftScore: 0,
      createdAt: new Date(), provider: 'openai', modelId: 'gpt-4o-mini',
    }]

    const updated = await svc.setVariants(post.id, variants)
    expect(updated.status).toBe(PostStatus.PENDING_APPROVAL)
    expect(updated.variants).toHaveLength(1)
    expect(updated.variants[0].body).toBe('LinkedIn variant')
    expect(updated.variants[0].platform).toBe(Platform.LINKEDIN)
  })

  it('replaces existing variants on re-generate', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Replace test', platforms: [Platform.LINKEDIN] })
    const { nanoid } = await import('nanoid')

    await svc.setVariants(post.id, [{
      id: nanoid(), postId: post.id, platform: Platform.LINKEDIN,
      body: 'Old variant', charCount: 11, styleDriftScore: 0,
      createdAt: new Date(), provider: 'openai', modelId: 'gpt-4o-mini',
    }])

    const updated = await svc.setVariants(post.id, [{
      id: nanoid(), postId: post.id, platform: Platform.LINKEDIN,
      body: 'New variant', charCount: 11, styleDriftScore: 0,
      createdAt: new Date(), provider: 'anthropic', modelId: 'claude-haiku',
    }])

    expect(updated.variants).toHaveLength(1)
    expect(updated.variants[0].body).toBe('New variant')
    expect(updated.variants[0].provider).toBe('anthropic')
  })
})

describe('PostService.approve()', () => {
  it('approves a PENDING_APPROVAL post', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Approve test', platforms: [Platform.LINKEDIN] })
    const { nanoid } = await import('nanoid')
    const variantId = nanoid()
    await svc.setVariants(post.id, [{
      id: variantId, postId: post.id, platform: Platform.LINKEDIN,
      body: 'Variant', charCount: 7, styleDriftScore: 0,
      createdAt: new Date(), provider: 'openai', modelId: 'gpt-4o-mini',
    }])

    const approved = await svc.approve(post.id, variantId)
    expect(approved.status).toBe(PostStatus.APPROVED)
  })

  it('approves a DRAFT post', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Draft approve', platforms: [Platform.LINKEDIN] })
    const { nanoid } = await import('nanoid')
    const variantId = nanoid()
    await svc.setVariants(post.id, [{
      id: variantId, postId: post.id, platform: Platform.LINKEDIN,
      body: 'V', charCount: 1, styleDriftScore: 0,
      createdAt: new Date(), provider: 'openai', modelId: 'gpt-4o-mini',
    }])
    // Reset to DRAFT manually
    const { posts } = await import('../../../src/main/infrastructure/db/schema')
    const { eq } = await import('drizzle-orm')
    await db.update(posts).set({ status: 'draft' }).where(eq(posts.id, post.id))

    const approved = await svc.approve(post.id, variantId)
    expect(approved.status).toBe(PostStatus.APPROVED)
  })

  it('throws POST_NOT_FOUND for unknown post', async () => {
    const svc = makeService()
    await expect(svc.approve('bad-id', 'variant-id')).rejects.toMatchObject({
      code: ErrorCode.POST_NOT_FOUND,
    })
  })

  it('throws POST_INVALID_TRANSITION for already-scheduled post', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Scheduled', platforms: [Platform.LINKEDIN] })
    const { nanoid } = await import('nanoid')
    const variantId = nanoid()
    await svc.setVariants(post.id, [{
      id: variantId, postId: post.id, platform: Platform.LINKEDIN,
      body: 'V', charCount: 1, styleDriftScore: 0,
      createdAt: new Date(), provider: 'openai', modelId: 'gpt-4o-mini',
    }])
    await svc.schedule(post.id, variantId, Platform.LINKEDIN, new Date(Date.now() + 60000))

    await expect(svc.approve(post.id, variantId)).rejects.toMatchObject({
      code: ErrorCode.POST_INVALID_TRANSITION,
    })
  })
})

describe('PostService.schedule()', () => {
  it('creates a job and transitions post to SCHEDULED', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Schedule test', platforms: [Platform.LINKEDIN] })
    const { nanoid } = await import('nanoid')
    const variantId = nanoid()
    await svc.setVariants(post.id, [{
      id: variantId, postId: post.id, platform: Platform.LINKEDIN,
      body: 'Variant', charCount: 7, styleDriftScore: 0,
      createdAt: new Date(), provider: 'openai', modelId: 'gpt-4o-mini',
    }])

    const scheduledAt = new Date(Date.now() + 3600 * 1000)
    const job = await svc.schedule(post.id, variantId, Platform.LINKEDIN, scheduledAt)

    expect(job.id).toBeTruthy()
    expect(job.postId).toBe(post.id)
    expect(job.variantId).toBe(variantId)
    expect(job.platform).toBe(Platform.LINKEDIN)
    expect(job.status).toBe('pending')
    expect(job.attempts).toBe(0)

    const updated = await svc.get(post.id)
    expect(updated.status).toBe(PostStatus.SCHEDULED)
  })
})

describe('PostService.delete()', () => {
  it('deletes a post', async () => {
    const personaId = await seedPersona()
    const svc = makeService()
    const post = await svc.create({ personaId, body: 'Delete me', platforms: [Platform.LINKEDIN] })

    await svc.delete(post.id)

    await expect(svc.get(post.id)).rejects.toMatchObject({ code: ErrorCode.POST_NOT_FOUND })
  })

  it('writes a POST_DELETED audit entry', async () => {
    const personaId = await seedPersona()
    const audit = mockAudit()
    const svc = new PostService(audit)
    const post = await svc.create({ personaId, body: 'Audit delete', platforms: [Platform.LINKEDIN] })

    await svc.delete(post.id)

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'POST_DELETED', entityId: post.id })
    )
  })
})

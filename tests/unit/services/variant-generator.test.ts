import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestDb, clearTestDb, closeTestDb, getRawTestDb } from '../../helpers/db'
import { mockAudit, mockAIGateway } from '../../helpers/mocks'
import { Platform } from '../../../src/shared/types/platform'
import { PostStatus } from '../../../src/shared/types/post'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

let db: ReturnType<typeof createTestDb>

vi.mock('../../../src/main/infrastructure/db/connection', () => ({
  getDb: () => db,
  getRawDb: () => { throw new Error('not available') },
}))

const { PostService } = await import('../../../src/main/services/post/post.service')
const { PersonaService } = await import('../../../src/main/services/persona/persona.service')
const { VariantGenerator } = await import('../../../src/main/services/post/variant-generator')

beforeAll(() => { db = createTestDb() })
beforeEach(() => clearTestDb())
afterAll(() => closeTestDb())

async function seedPersona(name = 'Test Persona') {
  const svc = new PersonaService(mockAudit())
  return svc.create({
    name,
    bio: 'A test persona for unit tests.',
    pillars: ['AI', 'testing'],
    styleHints: 'Clear and concise.',
  })
}

async function seedPost(personaId: string, body = 'Test draft body') {
  const svc = new PostService(mockAudit())
  return svc.create({ personaId, body, platforms: [Platform.LINKEDIN, Platform.TWITTER] })
}

describe('VariantGenerator.generate()', () => {
  it('generates variants for each requested platform', async () => {
    const persona = await seedPersona()
    const post = await seedPost(persona.id)
    const ai = mockAIGateway()
    const postSvc = new PostService(mockAudit())
    const personaSvc = new PersonaService(mockAudit())
    const gen = new VariantGenerator(ai, personaSvc, postSvc)

    const result = await gen.generate(post.id, [Platform.LINKEDIN, Platform.TWITTER], 'trace-1')

    expect(result.variants).toHaveLength(2)
    expect(result.variants.map((v) => v.platform)).toContain(Platform.LINKEDIN)
    expect(result.variants.map((v) => v.platform)).toContain(Platform.TWITTER)
    expect(result.status).toBe(PostStatus.PENDING_APPROVAL)
  })

  it('calls AI once per platform', async () => {
    const persona = await seedPersona()
    const post = await seedPost(persona.id)
    const ai = mockAIGateway()
    const gen = new VariantGenerator(ai, new PersonaService(mockAudit()), new PostService(mockAudit()))

    await gen.generate(post.id, [Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM], 'trace-2')

    expect(ai.complete).toHaveBeenCalledTimes(3)
  })

  it('includes persona context in the prompt', async () => {
    const persona = await seedPersona('Yash — Founder')
    const post = await seedPost(persona.id, 'My draft')
    const ai = mockAIGateway()
    const gen = new VariantGenerator(ai, new PersonaService(mockAudit()), new PostService(mockAudit()))

    await gen.generate(post.id, [Platform.LINKEDIN], 'trace-3')

    const callArg = (ai.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArg.prompt).toContain('Yash — Founder')
  })

  it('falls back gracefully when persona not found', async () => {
    // Create post with a non-existent personaId — requires disabling FK temporarily
    const { posts } = await import('../../../src/main/infrastructure/db/schema')
    const { nanoid } = await import('nanoid')
    const now = new Date()
    const postId = nanoid()
    const raw = getRawTestDb()
    raw.pragma('foreign_keys = OFF')
    await db.insert(posts).values({
      id: postId, personaId: 'nonexistent-persona',
      status: 'draft', body: 'Orphan post', platforms: '["linkedin"]',
      attempts: 0, createdAt: now, updatedAt: now,
    })
    raw.pragma('foreign_keys = ON')

    const ai = mockAIGateway()
    const gen = new VariantGenerator(ai, new PersonaService(mockAudit()), new PostService(mockAudit()))

    // Should not throw — falls back to generic tone
    const result = await gen.generate(postId, [Platform.LINKEDIN], 'trace-4')
    expect(result.variants).toHaveLength(1)
    // Prompt should contain fallback text
    const callArg = (ai.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArg.prompt).toContain('clear')
  })

  it('slices variant body to platform char limit', async () => {
    const persona = await seedPersona()
    const post = await seedPost(persona.id)
    // AI returns text longer than Twitter's 280 char limit
    const longText = 'x'.repeat(500)
    const ai = mockAIGateway({ complete: vi.fn().mockResolvedValue({
      text: longText, provider: 'openai', modelId: 'gpt-4o-mini',
      usage: { promptTokens: 10, completionTokens: 100, estimatedCostUsd: 0 },
    }) })
    const gen = new VariantGenerator(ai, new PersonaService(mockAudit()), new PostService(mockAudit()))

    const result = await gen.generate(post.id, [Platform.TWITTER], 'trace-5')
    const twitterVariant = result.variants.find((v) => v.platform === Platform.TWITTER)

    expect(twitterVariant).toBeDefined()
    expect(twitterVariant!.body.length).toBeLessThanOrEqual(280)
    expect(twitterVariant!.charCount).toBeLessThanOrEqual(280)
  })

  it('pushes error placeholder variant when AI fails for a platform', async () => {
    const persona = await seedPersona()
    const post = await seedPost(persona.id)
    const ai = mockAIGateway({
      complete: vi.fn().mockRejectedValue(new Error('AI provider down')),
    })
    const gen = new VariantGenerator(ai, new PersonaService(mockAudit()), new PostService(mockAudit()))

    const result = await gen.generate(post.id, [Platform.LINKEDIN], 'trace-6')

    expect(result.variants).toHaveLength(1)
    expect(result.variants[0].body).toContain('[Generation failed:')
    expect(result.variants[0].provider).toBe('error')
  })

  it('continues generating other platforms when one fails', async () => {
    const persona = await seedPersona()
    const post = await seedPost(persona.id)
    let callCount = 0
    const ai = mockAIGateway({
      complete: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) throw new Error('First platform failed')
        return Promise.resolve({
          text: 'Success', provider: 'openai', modelId: 'gpt-4o-mini',
          usage: { promptTokens: 10, completionTokens: 20, estimatedCostUsd: 0 },
        })
      }),
    })
    const gen = new VariantGenerator(ai, new PersonaService(mockAudit()), new PostService(mockAudit()))

    const result = await gen.generate(post.id, [Platform.LINKEDIN, Platform.TWITTER], 'trace-7')

    expect(result.variants).toHaveLength(2)
    expect(result.variants[0].provider).toBe('error')   // LinkedIn failed
    expect(result.variants[1].body).toBe('Success')     // Twitter succeeded
  })

  it('sets correct provider and modelId from AI response', async () => {
    const persona = await seedPersona()
    const post = await seedPost(persona.id)
    const ai = mockAIGateway({
      complete: vi.fn().mockResolvedValue({
        text: 'Generated content', provider: 'anthropic', modelId: 'claude-haiku-4-5',
        usage: { promptTokens: 50, completionTokens: 30, estimatedCostUsd: 0.001 },
      }),
    })
    const gen = new VariantGenerator(ai, new PersonaService(mockAudit()), new PostService(mockAudit()))

    const result = await gen.generate(post.id, [Platform.LINKEDIN], 'trace-8')

    expect(result.variants[0].provider).toBe('anthropic')
    expect(result.variants[0].modelId).toBe('claude-haiku-4-5')
  })
})

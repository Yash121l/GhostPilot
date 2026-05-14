import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestDb, clearTestDb, closeTestDb } from '../../helpers/db'
import { mockAudit, mockAIGateway } from '../../helpers/mocks'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

let db: ReturnType<typeof createTestDb>

vi.mock('../../../src/main/infrastructure/db/connection', () => ({
  getDb: () => db,
  getRawDb: () => { throw new Error('not available') },
}))

const { IntentService } = await import('../../../src/main/services/intent/intent.service')
const { PersonaService } = await import('../../../src/main/services/persona/persona.service')

beforeAll(() => { db = createTestDb() })
beforeEach(() => clearTestDb())
afterAll(() => closeTestDb())

async function seedPersona() {
  const svc = new PersonaService(mockAudit())
  return svc.create({ name: 'Test', bio: '', pillars: [], styleHints: '' })
}

const baseInput = {
  title: 'Reach 5K LinkedIn followers by Q4',
  description: 'Grow my LinkedIn presence through consistent posting',
  horizon: '6 months',
}

describe('IntentService.create()', () => {
  it('creates an intent with AI-decomposed key results', async () => {
    const persona = await seedPersona()
    const ai = mockAIGateway({
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify([
          { title: 'Grow followers', target: 5000, unit: 'followers', weeklyQuota: { postsPerWeek: 4, breakdown: { linkedin: 4 } } },
          { title: 'Maintain engagement', target: 6, unit: '%', weeklyQuota: { postsPerWeek: 4, breakdown: { linkedin: 4 } } },
        ]),
        provider: 'openai', modelId: 'gpt-4o-mini',
        usage: { promptTokens: 100, completionTokens: 80, estimatedCostUsd: 0.001 },
      }),
    })
    const svc = new IntentService(mockAudit(), ai)
    const intent = await svc.create({ personaId: persona.id, ...baseInput })

    expect(intent.id).toBeTruthy()
    expect(intent.title).toBe(baseInput.title)
    expect(intent.personaId).toBe(persona.id)
    expect(intent.keyResults.length).toBeGreaterThan(0)
    expect(intent.keyResults[0].title).toBe('Grow followers')
    expect(intent.keyResults[0].target).toBe(5000)
  })

  it('falls back to default key result when AI fails', async () => {
    const persona = await seedPersona()
    const ai = mockAIGateway({
      complete: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    })
    const svc = new IntentService(mockAudit(), ai)
    const intent = await svc.create({ personaId: persona.id, ...baseInput })

    expect(intent.keyResults).toHaveLength(1)
    expect(intent.keyResults[0].title).toBe('Consistent publishing')
    expect(intent.keyResults[0].target).toBe(52)
    expect(intent.keyResults[0].unit).toBe('posts')
  })

  it('falls back when AI returns invalid JSON', async () => {
    const persona = await seedPersona()
    const ai = mockAIGateway({
      complete: vi.fn().mockResolvedValue({
        text: 'Here are your key results: blah blah not JSON',
        provider: 'openai', modelId: 'gpt-4o-mini',
        usage: { promptTokens: 50, completionTokens: 30, estimatedCostUsd: 0 },
      }),
    })
    const svc = new IntentService(mockAudit(), ai)
    const intent = await svc.create({ personaId: persona.id, ...baseInput })

    // Falls back to default
    expect(intent.keyResults).toHaveLength(1)
    expect(intent.keyResults[0].title).toBe('Consistent publishing')
  })
})

describe('IntentService.list()', () => {
  it('returns empty array when no intents', async () => {
    const ai = mockAIGateway()
    const svc = new IntentService(mockAudit(), ai)
    expect(await svc.list()).toEqual([])
  })

  it('returns all intents', async () => {
    const persona = await seedPersona()
    const ai = mockAIGateway({
      complete: vi.fn().mockResolvedValue({
        text: '[]', provider: 'openai', modelId: 'gpt-4o-mini',
        usage: { promptTokens: 10, completionTokens: 5, estimatedCostUsd: 0 },
      }),
    })
    const svc = new IntentService(mockAudit(), ai)
    await svc.create({ personaId: persona.id, ...baseInput })
    await svc.create({ personaId: persona.id, title: 'Second goal', description: '', horizon: '3 months' })

    const list = await svc.list()
    expect(list).toHaveLength(2)
  })

  it('filters by personaId', async () => {
    const p1 = await seedPersona()
    const p2 = await seedPersona()
    const ai = mockAIGateway({
      complete: vi.fn().mockResolvedValue({
        text: '[]', provider: 'openai', modelId: 'gpt-4o-mini',
        usage: { promptTokens: 10, completionTokens: 5, estimatedCostUsd: 0 },
      }),
    })
    const svc = new IntentService(mockAudit(), ai)
    await svc.create({ personaId: p1.id, ...baseInput })
    await svc.create({ personaId: p2.id, title: 'P2 goal', description: '', horizon: '1 year' })

    const p1Intents = await svc.list(p1.id)
    expect(p1Intents).toHaveLength(1)
    expect(p1Intents[0].personaId).toBe(p1.id)
  })
})

describe('IntentService.update()', () => {
  it('updates title and horizon', async () => {
    const persona = await seedPersona()
    const ai = mockAIGateway({
      complete: vi.fn().mockResolvedValue({
        text: '[]', provider: 'openai', modelId: 'gpt-4o-mini',
        usage: { promptTokens: 10, completionTokens: 5, estimatedCostUsd: 0 },
      }),
    })
    const svc = new IntentService(mockAudit(), ai)
    const intent = await svc.create({ personaId: persona.id, ...baseInput })

    const updated = await svc.update(intent.id, { title: 'Updated goal', horizon: '1 year' })
    expect(updated.title).toBe('Updated goal')
    expect(updated.horizon).toBe('1 year')
    expect(updated.description).toBe(baseInput.description) // unchanged
  })
})

describe('IntentService.delete()', () => {
  it('deletes an intent', async () => {
    const persona = await seedPersona()
    const ai = mockAIGateway({
      complete: vi.fn().mockResolvedValue({
        text: '[]', provider: 'openai', modelId: 'gpt-4o-mini',
        usage: { promptTokens: 10, completionTokens: 5, estimatedCostUsd: 0 },
      }),
    })
    const svc = new IntentService(mockAudit(), ai)
    const intent = await svc.create({ personaId: persona.id, ...baseInput })

    await svc.delete(intent.id)

    const list = await svc.list()
    expect(list).toHaveLength(0)
  })
})

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestDb, clearTestDb, closeTestDb } from '../../helpers/db'
import { mockAudit } from '../../helpers/mocks'
import { ErrorCode } from '../../../src/shared/types/error'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

let db: ReturnType<typeof createTestDb>

vi.mock('../../../src/main/infrastructure/db/connection', () => ({
  getDb: () => db,
  getRawDb: () => {
    throw new Error('not available')
  }
}))

const { PersonaService } = await import('../../../src/main/services/persona/persona.service')

beforeAll(() => {
  db = createTestDb()
})
beforeEach(() => clearTestDb())
afterAll(() => closeTestDb())

function makeService() {
  return new PersonaService(mockAudit())
}

const baseInput = {
  name: 'Yash — Indie Founder',
  bio: 'Solo dev shipping AI tools.',
  pillars: ['AI', 'indie hacking', 'dev workflow'],
  styleHints: 'Casual, short sentences, no jargon.'
}

describe('PersonaService.create()', () => {
  it('creates a persona with correct fields', async () => {
    const svc = makeService()
    const p = await svc.create(baseInput)

    expect(p.id).toBeTruthy()
    expect(p.name).toBe('Yash — Indie Founder')
    expect(p.bio).toBe('Solo dev shipping AI tools.')
    expect(p.pillars).toEqual(['AI', 'indie hacking', 'dev workflow'])
    expect(p.styleHints).toBe('Casual, short sentences, no jargon.')
    expect(p.latestFingerprint).toBeUndefined()
    expect(p.createdAt).toBeInstanceOf(Date)
    expect(p.updatedAt).toBeInstanceOf(Date)
  })

  it('creates a persona with empty pillars', async () => {
    const svc = makeService()
    const p = await svc.create({ ...baseInput, pillars: [] })
    expect(p.pillars).toEqual([])
  })

  it('writes an audit entry', async () => {
    const audit = mockAudit()
    const svc = new PersonaService(audit)
    await svc.create(baseInput)
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERSONA_UPDATED', outcome: 'success' })
    )
  })
})

describe('PersonaService.get()', () => {
  it('retrieves a persona by ID', async () => {
    const svc = makeService()
    const created = await svc.create(baseInput)
    const fetched = await svc.get(created.id)

    expect(fetched.id).toBe(created.id)
    expect(fetched.name).toBe(baseInput.name)
  })

  it('throws PERSONA_NOT_FOUND for unknown ID', async () => {
    const svc = makeService()
    await expect(svc.get('nonexistent')).rejects.toMatchObject({
      code: ErrorCode.PERSONA_NOT_FOUND
    })
  })
})

describe('PersonaService.list()', () => {
  it('returns empty array when no personas', async () => {
    const svc = makeService()
    expect(await svc.list()).toEqual([])
  })

  it('returns all created personas', async () => {
    const svc = makeService()
    await svc.create(baseInput)
    await svc.create({ ...baseInput, name: 'Brand Account' })

    const list = await svc.list()
    expect(list).toHaveLength(2)
    const names = list.map((p) => p.name)
    expect(names).toContain('Yash — Indie Founder')
    expect(names).toContain('Brand Account')
  })
})

describe('PersonaService.update()', () => {
  it('updates name only', async () => {
    const svc = makeService()
    const p = await svc.create(baseInput)
    const updated = await svc.update(p.id, { name: 'New Name' })

    expect(updated.name).toBe('New Name')
    expect(updated.bio).toBe(baseInput.bio) // unchanged
  })

  it('updates pillars', async () => {
    const svc = makeService()
    const p = await svc.create(baseInput)
    const updated = await svc.update(p.id, { pillars: ['SaaS', 'growth'] })

    expect(updated.pillars).toEqual(['SaaS', 'growth'])
  })

  it('updates styleHints', async () => {
    const svc = makeService()
    const p = await svc.create(baseInput)
    const updated = await svc.update(p.id, { styleHints: 'Formal tone.' })

    expect(updated.styleHints).toBe('Formal tone.')
  })
})

describe('PersonaService.delete()', () => {
  it('deletes a persona', async () => {
    const svc = makeService()
    const p = await svc.create(baseInput)
    await svc.delete(p.id)

    await expect(svc.get(p.id)).rejects.toMatchObject({ code: ErrorCode.PERSONA_NOT_FOUND })
  })

  it('list returns empty after deleting all', async () => {
    const svc = makeService()
    const p = await svc.create(baseInput)
    await svc.delete(p.id)

    expect(await svc.list()).toEqual([])
  })
})

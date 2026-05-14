import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { mockAudit } from '../../helpers/mocks'
import { ErrorCode } from '../../../src/shared/types/error'
import { AITask, ModelHint } from '../../../src/shared/types/ai'
import { createTestDb, clearTestDb, closeTestDb, getRawTestDb } from '../../helpers/db'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
vi.mock('../../../src/main/infrastructure/db/connection', () => ({
  getDb: () => createTestDb(),
  getRawDb: () => getRawTestDb(),
}))
vi.mock('../../../src/main/infrastructure/keychain/keychain.service', () => ({
  KeychainService: class {
    get = vi.fn().mockResolvedValue(null)
    set = vi.fn().mockResolvedValue(undefined)
    delete = vi.fn().mockResolvedValue(undefined)
  },
}))
vi.mock('../../../src/main/services/ai-gateway/providers/ollama', () => ({
  OllamaProvider: class {},
  detectOllama: vi.fn().mockResolvedValue({ available: false, models: [] }),
}))

const { AIGateway } = await import('../../../src/main/services/ai-gateway/index')
const { UsageLedger } = await import('../../../src/main/services/ai-gateway/usage-ledger')

beforeAll(() => { createTestDb() })
beforeEach(() => { clearTestDb() })
afterAll(() => { closeTestDb() })

function makeGateway() {
  return new AIGateway(mockAudit())
}

// ─── Mock provider ────────────────────────────────────────────────────────────

function mockProvider(overrides = {}) {
  return {
    providerId: 'openai',
    defaultModelId: 'gpt-4o-mini',
    promptCostPer1k: 0.00015,
    completionCostPer1k: 0.0006,
    complete: vi.fn().mockResolvedValue({
      text: 'Generated text',
      modelId: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 50,
    }),
    ...overrides,
  }
}

describe('AIGateway.complete() — spend cap', () => {
  it('throws SPEND_CAP_EXCEEDED when daily spend >= cap', async () => {
    const gw = makeGateway()
    // Inject a ledger that reports over-cap spend
    const ledger = gw.ledgerInstance
    vi.spyOn(ledger, 'todaySpend').mockReturnValue(10.01) // over $10 cap

    await expect(gw.complete({
      task: AITask.DRAFT_POST,
      hint: ModelHint.ECONOMY,
      prompt: 'test',
      traceId: 'trace-1',
    })).rejects.toMatchObject({ code: ErrorCode.SPEND_CAP_EXCEEDED })
  })
})

describe('AIGateway.complete() — no provider', () => {
  it('throws AI_PROVIDER_NOT_CONFIGURED when no providers loaded', async () => {
    const gw = makeGateway()
    // No providers registered, ledger at 0
    vi.spyOn(gw.ledgerInstance, 'todaySpend').mockReturnValue(0)

    await expect(gw.complete({
      task: AITask.ADAPT_VARIANT,
      hint: ModelHint.ECONOMY,
      prompt: 'test',
      traceId: 'trace-2',
    })).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED })
  })
})

describe('AIGateway.complete() — provider error', () => {
  it('throws AI_CALL_FAILED when provider throws', async () => {
    const gw = makeGateway()
    vi.spyOn(gw.ledgerInstance, 'todaySpend').mockReturnValue(0)

    // Inject a failing provider via routing policy
    const policy = (gw as any).policy
    vi.spyOn(policy, 'select').mockReturnValue(mockProvider({
      complete: vi.fn().mockRejectedValue(new Error('Provider timeout')),
    }))

    await expect(gw.complete({
      task: AITask.DRAFT_POST,
      hint: ModelHint.ECONOMY,
      prompt: 'test',
      traceId: 'trace-3',
    })).rejects.toMatchObject({
      code: ErrorCode.AI_CALL_FAILED,
      retryable: true,
    })
  })
})

describe('AIGateway.complete() — success', () => {
  it('returns text, provider, modelId, and usage', async () => {
    const gw = makeGateway()
    vi.spyOn(gw.ledgerInstance, 'todaySpend').mockReturnValue(0)

    const provider = mockProvider()
    vi.spyOn((gw as any).policy, 'select').mockReturnValue(provider)

    const result = await gw.complete({
      task: AITask.ADAPT_VARIANT,
      hint: ModelHint.ECONOMY,
      prompt: 'Write a LinkedIn post about AI',
      traceId: 'trace-4',
    })

    expect(result.text).toBe('Generated text')
    expect(result.provider).toBe('openai')
    expect(result.modelId).toBe('gpt-4o-mini')
    expect(result.usage.promptTokens).toBe(100)
    expect(result.usage.completionTokens).toBe(50)
    expect(result.usage.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('calculates cost correctly', async () => {
    const gw = makeGateway()
    vi.spyOn(gw.ledgerInstance, 'todaySpend').mockReturnValue(0)

    const provider = mockProvider({
      promptCostPer1k: 0.001,
      completionCostPer1k: 0.002,
      complete: vi.fn().mockResolvedValue({
        text: 'ok', modelId: 'gpt-4o-mini',
        promptTokens: 1000, completionTokens: 500,
      }),
    })
    vi.spyOn((gw as any).policy, 'select').mockReturnValue(provider)

    const result = await gw.complete({
      task: AITask.DRAFT_POST, hint: ModelHint.ECONOMY,
      prompt: 'test', traceId: 'trace-5',
    })

    // cost = (1000/1000)*0.001 + (500/1000)*0.002 = 0.001 + 0.001 = 0.002
    expect(result.usage.estimatedCostUsd).toBeCloseTo(0.002, 5)
  })

  it('writes audit entries for start and completion', async () => {
    const audit = mockAudit()
    const gw = new AIGateway(audit)
    vi.spyOn(gw.ledgerInstance, 'todaySpend').mockReturnValue(0)
    vi.spyOn((gw as any).policy, 'select').mockReturnValue(mockProvider())

    await gw.complete({
      task: AITask.DRAFT_POST, hint: ModelHint.ECONOMY,
      prompt: 'test', traceId: 'trace-6',
    })

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LLM_CALL_STARTED' })
    )
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LLM_CALL_COMPLETED' })
    )
  })
})

describe('UsageLedger', () => {
  it('starts with zero spend', () => {
    const ledger = new UsageLedger()
    expect(ledger.todaySpend()).toBe(0)
  })

  it('accumulates spend correctly', () => {
    const ledger = new UsageLedger()
    ledger.record({
      provider: 'openai', modelId: 'gpt-4o-mini', task: AITask.DRAFT_POST,
      promptTokens: 100, completionTokens: 50, estimatedCostUsd: 0.005,
    })
    ledger.record({
      provider: 'anthropic', modelId: 'claude-haiku', task: AITask.ADAPT_VARIANT,
      promptTokens: 200, completionTokens: 100, estimatedCostUsd: 0.003,
    })
    expect(ledger.todaySpend()).toBeCloseTo(0.008, 5)
  })
})

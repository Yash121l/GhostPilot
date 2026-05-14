import { nanoid } from 'nanoid'
import OpenAI from 'openai'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AIGatewayRequest, AIGatewayResponse, ProviderKeyConfig, OllamaStatus } from '../../../shared/types/ai'
import type { ImageAttachment } from '../../../shared/types/post'
import { AIProvider, ModelHint } from '../../../shared/types/ai'
import { AppError, ErrorCode } from '../../../shared/types/error'
import type { LLMProvider } from './providers/interface'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { OllamaProvider, detectOllama } from './providers/ollama'
import { RoutingPolicy } from './routing-policy'
import { UsageLedger } from './usage-ledger'
import { KeychainService } from '../../infrastructure/keychain/keychain.service'
import { createLogger } from '../../infrastructure/logger/logger'
import { getDb, getRawDb } from '../../infrastructure/db/connection'
import { aiProviderKeys } from '../../infrastructure/db/schema'
import { eq } from 'drizzle-orm'
import { DEFAULT_SPEND_CAP_USD } from '../../../shared/constants'
import { AuditAction } from '../../infrastructure/db/schema'
import type { AuditService } from '../../application/audit/audit.service'

const logger = createLogger('AIGateway')

export class AIGateway {
  private providers = new Map<string, LLMProvider>()
  private policy: RoutingPolicy
  private ledger = new UsageLedger()
  private keychain = new KeychainService()
  private ollamaAvail = false

  constructor(private readonly audit: AuditService) {
    this.policy = new RoutingPolicy(this.providers, () => this.ollamaAvail)
  }

  /** Called at startup and when a key is added/removed. */
  async reload(): Promise<void> {
    this.providers.clear()

    // Load all configured provider keys from DB
    const db = getDb()
    const rows = await db.select().from(aiProviderKeys)

    for (const row of rows) {
      const secret = await this.keychain.get(row.keychainKey)
      if (!secret) continue

      try {
        const provider = this.buildProvider(row.provider, secret)
        if (provider) this.providers.set(row.provider, provider)
      } catch (e) {
        logger.warn({ msg: 'Failed to init provider', provider: row.provider, error: String(e) })
      }
    }

    // Always probe Ollama regardless of key config
    const ollama = await detectOllama()
    this.ollamaAvail = ollama.available
    if (ollama.available) {
      if (!this.providers.has('ollama')) {
        this.providers.set('ollama', new OllamaProvider())
      }
      logger.info({ msg: 'Ollama detected', models: ollama.models })
    }

    logger.info({ msg: 'AI Gateway reloaded', providers: [...this.providers.keys()] })
  }

  private buildProvider(providerStr: string, secret: string): LLMProvider | null {
    switch (providerStr) {
      case AIProvider.OPENAI:
      case 'openai':
        return new OpenAIProvider(secret)
      case AIProvider.ANTHROPIC:
      case 'anthropic':
        return new AnthropicProvider(secret)
      case AIProvider.OLLAMA:
      case 'ollama':
        return new OllamaProvider(secret) // secret is the model name for ollama
      default:
        logger.warn({ msg: 'Unknown provider type', provider: providerStr })
        return null
    }
  }

  async complete(req: AIGatewayRequest): Promise<AIGatewayResponse> {
    const hint = req.hint ?? ModelHint.ECONOMY
    const task = req.task

    // Spend cap check
    const spendToday = this.ledger.todaySpend()
    if (spendToday >= DEFAULT_SPEND_CAP_USD) {
      this.audit.write({
        actor: 'system',
        action: AuditAction.SPEND_CAP_HIT,
        entityType: 'llm_usage',
        outcome: 'blocked',
        details: { spendToday, cap: DEFAULT_SPEND_CAP_USD },
      })
      throw new AppError({
        code: ErrorCode.SPEND_CAP_EXCEEDED,
        message: `Daily spend cap of $${DEFAULT_SPEND_CAP_USD} reached. Adjust in Settings.`,
      })
    }

    let provider: LLMProvider
    try {
      provider = this.policy.select(task, hint)
    } catch {
      throw new AppError({
        code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED,
        message: 'No AI provider available. Add an API key in Settings → AI Providers.',
      })
    }

    this.audit.write({
      actor: 'system',
      action: AuditAction.LLM_CALL_STARTED,
      entityType: 'llm_usage',
      outcome: 'success',
      details: { task, provider: provider.providerId, model: provider.defaultModelId, traceId: req.traceId },
    })

    const start = Date.now()
    let result: Awaited<ReturnType<LLMProvider['complete']>>
    try {
      result = await provider.complete(req.prompt, {
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        systemMessage: req.systemMessage,
      })
    } catch (e) {
      this.audit.write({
        actor: 'system',
        action: AuditAction.LLM_CALL_FAILED,
        entityType: 'llm_usage',
        outcome: 'failure',
        errorCode: 'PROVIDER_ERROR',
        details: { provider: provider.providerId, error: String(e) },
      })
      throw new AppError({
        code: ErrorCode.AI_CALL_FAILED,
        message: `AI call failed: ${String(e)}`,
        retryable: true,
      })
    }

    const latencyMs = Date.now() - start
    const costUsd =
      (result.promptTokens / 1000) * provider.promptCostPer1k +
      (result.completionTokens / 1000) * provider.completionCostPer1k

    this.ledger.record({
      provider: provider.providerId,
      modelId: result.modelId,
      task,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCostUsd: costUsd,
      postId: req.postId,
      personaId: req.personaId,
    })

    this.audit.write({
      actor: 'system',
      action: AuditAction.LLM_CALL_COMPLETED,
      entityType: 'llm_usage',
      outcome: 'success',
      details: {
        task, provider: provider.providerId, model: result.modelId,
        promptTokens: result.promptTokens, completionTokens: result.completionTokens,
        costUsd, latencyMs,
      },
    })

    return {
      text: result.text,
      provider: provider.providerId,
      modelId: result.modelId,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimatedCostUsd: costUsd,
      },
    }
  }

  // ─── Provider key management ─────────────────────────────────────────────

  async listKeys(): Promise<ProviderKeyConfig[]> {
    const db = getDb()
    const rows = await db.select().from(aiProviderKeys)
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      label: r.label ?? '',
      isDefault: Boolean(r.isDefault),
      lastUsedAt: r.lastUsedAt ?? undefined,
      createdAt: r.createdAt!,
    }))
  }

  async addKey(provider: string, label: string, secret: string): Promise<ProviderKeyConfig> {
    const id = nanoid()
    const keychainKey = `ghostpilot:ai:${provider}:${id}`
    await this.keychain.set(keychainKey, secret)

    const db = getDb()
    const now = new Date()
    await db.insert(aiProviderKeys).values({
      id,
      provider,
      label,
      keychainKey,
      isDefault: false,
      createdAt: now,
    })

    this.audit.write({
      actor: 'user',
      action: AuditAction.AI_KEY_ADDED,
      entityType: 'ai_provider_keys',
      entityId: id,
      outcome: 'success',
      details: { provider, label },
    })

    await this.reload()
    return { id, provider, label, isDefault: false, createdAt: now }
  }

  async deleteKey(id: string): Promise<void> {
    const db = getDb()
    const rows = await db.select().from(aiProviderKeys).where(eq(aiProviderKeys.id, id))
    if (!rows.length) return

    await this.keychain.delete(rows[0].keychainKey)
    await db.delete(aiProviderKeys).where(eq(aiProviderKeys.id, id))

    this.audit.write({
      actor: 'user',
      action: AuditAction.AI_KEY_REMOVED,
      entityType: 'ai_provider_keys',
      entityId: id,
      outcome: 'success',
    })

    await this.reload()
  }

  async setDefault(id: string): Promise<void> {
    const raw = getRawDb()
    raw.transaction(() => {
      raw.prepare('UPDATE ai_provider_keys SET is_default = 0').run()
      raw.prepare('UPDATE ai_provider_keys SET is_default = 1 WHERE id = ?').run(id)
    })()
  }

  async testKey(id: string): Promise<{ latencyMs: number; model: string }> {
    const db = getDb()
    const rows = await db.select().from(aiProviderKeys).where(eq(aiProviderKeys.id, id))
    if (!rows.length) throw new AppError({ code: ErrorCode.NOT_FOUND, message: 'Key not found' })

    const secret = await this.keychain.get(rows[0].keychainKey)
    if (!secret) throw new AppError({ code: ErrorCode.KEYCHAIN_READ_FAILED, message: 'Key not in keychain' })

    const provider = this.buildProvider(rows[0].provider, secret)
    if (!provider) throw new AppError({ code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED, message: 'Unknown provider' })

    const start = Date.now()
    await provider.complete('Say "OK" in one word.', { maxTokens: 10 })
    return { latencyMs: Date.now() - start, model: provider.defaultModelId }
  }

  async ollamaStatus(): Promise<OllamaStatus> {
    return detectOllama()
  }

  async generateImage(prompt: string): Promise<ImageAttachment> {
    const db = getDb()
    const rows = await db.select().from(aiProviderKeys).where(eq(aiProviderKeys.provider, 'openai'))
    if (!rows.length) {
      throw new AppError({ code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED, message: 'OpenAI key required for image generation.' })
    }
    const secret = await this.keychain.get(rows[0].keychainKey)
    if (!secret) {
      throw new AppError({ code: ErrorCode.KEYCHAIN_READ_FAILED, message: 'OpenAI key not found in keychain.' })
    }

    const openai = new OpenAI({ apiKey: secret })
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    })

    const imageData = result.data?.[0]
    const b64 = imageData?.b64_json
    const originalUrl = imageData?.url
    if (!b64) throw new AppError({ code: ErrorCode.AI_CALL_FAILED, message: 'DALL-E returned no image data.' })

    const mediaDir = join(app.getPath('userData'), 'media')
    mkdirSync(mediaDir, { recursive: true })
    const filename = `${nanoid()}.png`
    const localPath = join(mediaDir, filename)
    writeFileSync(localPath, Buffer.from(b64, 'base64'))

    logger.info({ msg: 'Image generated', localPath })
    return { localPath, originalUrl: originalUrl ?? undefined, mimeType: 'image/png' }
  }

  get ledgerInstance(): UsageLedger {
    return this.ledger
  }
}

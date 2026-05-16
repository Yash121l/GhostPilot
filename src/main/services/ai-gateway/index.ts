import { nanoid } from 'nanoid'
import OpenAI from 'openai'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type {
  AIGatewayRequest,
  AIGatewayResponse,
  ProviderKeyConfig,
  OllamaStatus
} from '../../../shared/types/ai'
import type { ImageAttachment } from '../../../shared/types/post'
import { AIProvider, ModelHint } from '../../../shared/types/ai'
import { AppError, ErrorCode } from '../../../shared/types/error'
import type { LLMProvider } from './providers/interface'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { OllamaProvider, detectOllama } from './providers/ollama'
import { detectLocalAgentProviders } from './providers/local-agent'
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
const SUPPORTED_API_PROVIDERS = new Set<string>([AIProvider.OPENAI, AIProvider.ANTHROPIC])
const ANSI_ESCAPE = String.fromCharCode(27)
const ANSI_PATTERN = new RegExp(`${ANSI_ESCAPE}\\[[0-9;]*m`, 'g')

function providerFailureMessage(providerId: string): string {
  if (providerId === 'codex-cli') {
    return 'Codex CLI failed. Check sign-in or choose an API provider in Settings.'
  }
  if (providerId === 'claude-code') {
    return 'Claude Code failed. Check sign-in or choose an API provider in Settings.'
  }
  if (providerId === 'openai') {
    return 'OpenAI request failed. Check your API key or try another provider.'
  }
  if (providerId === 'anthropic') {
    return 'Anthropic request failed. Check your API key or try another provider.'
  }
  if (providerId === 'ollama') {
    return 'Ollama request failed. Check that Ollama is running or choose another provider.'
  }
  return 'AI provider request failed. Try another provider in Settings.'
}

function safeProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(ANSI_PATTERN, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^reading additional input from stdin/i.test(line))
    .filter((line) => !/^source draft:/i.test(line))
    .filter((line) => !/^persona:/i.test(line))
    .filter((line) => !/^platform instructions:/i.test(line))
    .filter((line) => !/^output:/i.test(line))
    .map((line) => (line.length > 240 ? `${line.slice(0, 237)}...` : line))
    .slice(0, 3)
    .join('\n')
}

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
    const rows = (await db.select().from(aiProviderKeys)).sort((a, b) => {
      if (a.isDefault === b.isDefault) return 0
      return a.isDefault ? 1 : -1
    })

    for (const row of rows) {
      const secret = await this.keychain.get(row.keychainKey)
      if (!secret) continue

      try {
        const provider = this.buildProvider(row.provider, secret)
        if (provider) {
          this.providers.set(`key:${row.id}`, provider)
          this.providers.set(row.provider, provider)
        }
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

    const localAgents = await detectLocalAgentProviders()
    for (const provider of localAgents) {
      if (!this.providers.has(provider.providerId)) {
        this.providers.set(provider.providerId, provider)
      }
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

  private selectProvider(
    req: AIGatewayRequest,
    task: AIGatewayRequest['task'],
    hint: ModelHint
  ): LLMProvider {
    const preferred = req.preferredProviderId
    if (preferred && preferred !== 'auto') {
      const provider = this.providers.get(preferred)
      if (provider?.canHandle(task)) return provider
    }
    return this.policy.select(task, hint)
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
        details: { spendToday, cap: DEFAULT_SPEND_CAP_USD }
      })
      throw new AppError({
        code: ErrorCode.SPEND_CAP_EXCEEDED,
        message: `Daily spend cap of $${DEFAULT_SPEND_CAP_USD} reached. Adjust in Settings.`
      })
    }

    let provider: LLMProvider
    try {
      provider = this.selectProvider(req, task, hint)
    } catch {
      throw new AppError({
        code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED,
        message:
          'No AI provider available. Add an API key or sign in to a local agent in Settings → AI Providers.'
      })
    }

    this.audit.write({
      actor: 'system',
      action: AuditAction.LLM_CALL_STARTED,
      entityType: 'llm_usage',
      outcome: 'success',
      details: {
        task,
        provider: provider.providerId,
        model: provider.defaultModelId,
        traceId: req.traceId
      }
    })

    const start = Date.now()
    let result: Awaited<ReturnType<LLMProvider['complete']>>
    try {
      result = await provider.complete(req.prompt, {
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        systemMessage: req.systemMessage
      })
    } catch (e) {
      const safeError = safeProviderError(e)
      this.audit.write({
        actor: 'system',
        action: AuditAction.LLM_CALL_FAILED,
        entityType: 'llm_usage',
        outcome: 'failure',
        errorCode: 'PROVIDER_ERROR',
        details: { provider: provider.providerId, error: safeError }
      })
      throw new AppError({
        code: ErrorCode.AI_CALL_FAILED,
        message: providerFailureMessage(provider.providerId),
        retryable: true
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
      personaId: req.personaId
    })

    this.audit.write({
      actor: 'system',
      action: AuditAction.LLM_CALL_COMPLETED,
      entityType: 'llm_usage',
      outcome: 'success',
      details: {
        task,
        provider: provider.providerId,
        model: result.modelId,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        costUsd,
        latencyMs
      }
    })

    return {
      text: result.text,
      provider: provider.providerId,
      modelId: result.modelId,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimatedCostUsd: costUsd
      }
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
      createdAt: r.createdAt!
    }))
  }

  async addKey(provider: string, label: string, secret: string): Promise<ProviderKeyConfig> {
    if (!SUPPORTED_API_PROVIDERS.has(provider)) {
      throw new AppError({
        code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED,
        message: 'Unsupported AI provider. Add an OpenAI or Anthropic API key.'
      })
    }

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
      createdAt: now
    })

    this.audit.write({
      actor: 'user',
      action: AuditAction.AI_KEY_ADDED,
      entityType: 'ai_provider_keys',
      entityId: id,
      outcome: 'success',
      details: { provider, label }
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
      outcome: 'success'
    })

    await this.reload()
  }

  async setDefault(id: string): Promise<void> {
    const raw = getRawDb()
    raw.transaction(() => {
      raw.prepare('UPDATE ai_provider_keys SET is_default = 0').run()
      raw.prepare('UPDATE ai_provider_keys SET is_default = 1 WHERE id = ?').run(id)
    })()
    await this.reload()
  }

  async testKey(id: string): Promise<{ latencyMs: number; model: string }> {
    const db = getDb()
    const rows = await db.select().from(aiProviderKeys).where(eq(aiProviderKeys.id, id))
    if (!rows.length) throw new AppError({ code: ErrorCode.NOT_FOUND, message: 'Key not found' })

    const secret = await this.keychain.get(rows[0].keychainKey)
    if (!secret)
      throw new AppError({ code: ErrorCode.KEYCHAIN_READ_FAILED, message: 'Key not in keychain' })

    const provider = this.buildProvider(rows[0].provider, secret)
    if (!provider)
      throw new AppError({
        code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED,
        message: 'Unknown provider'
      })

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
      throw new AppError({
        code: ErrorCode.AI_PROVIDER_NOT_CONFIGURED,
        message: 'OpenAI key required for image generation.'
      })
    }
    const secret = await this.keychain.get(rows[0].keychainKey)
    if (!secret) {
      throw new AppError({
        code: ErrorCode.KEYCHAIN_READ_FAILED,
        message: 'OpenAI key not found in keychain.'
      })
    }

    const openai = new OpenAI({ apiKey: secret })
    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high'
    })

    const imageData = result.data?.[0]
    const b64 = imageData?.b64_json
    if (!b64)
      throw new AppError({
        code: ErrorCode.AI_CALL_FAILED,
        message: 'Image generation returned no data.'
      })

    const mediaDir = join(app.getPath('userData'), 'media')
    mkdirSync(mediaDir, { recursive: true })
    const filename = `${nanoid()}.png`
    const localPath = join(mediaDir, filename)
    writeFileSync(localPath, Buffer.from(b64, 'base64'))

    logger.info({ msg: 'Image generated', localPath })
    return { localPath, mimeType: 'image/png', dataUrl: `data:image/png;base64,${b64}` }
  }

  get ledgerInstance(): UsageLedger {
    return this.ledger
  }
}

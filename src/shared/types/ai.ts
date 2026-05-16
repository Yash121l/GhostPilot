/**
 * @module ai
 * AI-related shared types for the AI Gateway and usage ledger.
 */

export enum AITask {
  DRAFT_POST = 'draft_post',
  ADAPT_VARIANT = 'adapt_variant',
  GENERATE_REPLY = 'generate_reply',
  DECOMPOSE_OKR = 'decompose_okr',
  MORNING_BRIEF = 'morning_brief',
  SCORE_TREND = 'score_trend',
  BUILD_FINGERPRINT = 'build_fingerprint',
  CONTEXT_EMBED = 'context_embed',
  MODERATION = 'moderation'
}

export enum ModelHint {
  ECONOMY = 'economy',
  PREMIUM = 'premium',
  LOCAL = 'local'
}

export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  OPENROUTER = 'openrouter',
  GROQ = 'groq'
}

export interface ProviderKeyConfig {
  id: string
  provider: AIProvider | string
  label: string
  isDefault: boolean
  lastUsedAt?: Date
  createdAt: Date
}

export interface OllamaStatus {
  available: boolean
  models: string[]
}

export interface LLMUsage {
  id: string
  ts: Date
  provider: string
  modelId: string
  task: AITask
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number
  postId?: string
  personaId?: string
}

export interface AIGatewayRequest {
  task: AITask
  hint: ModelHint
  preferredProviderId?: string
  prompt: string
  systemMessage?: string
  maxTokens?: number
  temperature?: number
  traceId: string
  postId?: string
  personaId?: string
}

export interface AIGatewayResponse {
  text: string
  provider: string
  modelId: string
  usage: Pick<LLMUsage, 'promptTokens' | 'completionTokens' | 'estimatedCostUsd'>
}

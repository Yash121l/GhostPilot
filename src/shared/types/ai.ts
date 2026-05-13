/**
 * @module ai
 * AI-related shared types for the AI Gateway and usage ledger.
 */

/** All task types the AI Gateway can perform. */
export enum AITask {
  DRAFT_POST = 'draft_post',
  ADAPT_VARIANT = 'adapt_variant',
  GENERATE_REPLY = 'generate_reply',
  DECOMPOSE_OKR = 'decompose_okr',
  MORNING_BRIEF = 'morning_brief',
  SCORE_TREND = 'score_trend',
  BUILD_FINGERPRINT = 'build_fingerprint',
  CONTEXT_EMBED = 'context_embed',
  MODERATION = 'moderation',
}

/** Hint to the routing policy for model selection. */
export enum ModelHint {
  /** Cheapest available model that can handle the task. */
  ECONOMY = 'economy',
  /** Best quality model for critical operations. */
  PREMIUM = 'premium',
  /** Prefer local models (Ollama / LM Studio) — offline-safe. */
  LOCAL = 'local',
}

/** Token + cost record for a single LLM call. */
export interface LLMUsage {
  id: string
  ts: Date
  provider: string
  modelId: string
  task: AITask
  promptTokens: number
  completionTokens: number
  /** Cost in USD (estimated from pricing tables). */
  estimatedCostUsd: number
  postId?: string
  personaId?: string
}

/** Input to the AI Gateway complete() method. */
export interface AIGatewayRequest {
  task: AITask
  hint: ModelHint
  /** Rendered prompt (already assembled by PromptBuilder). */
  prompt: string
  /** Optional system message override. */
  systemMessage?: string
  maxTokens?: number
  temperature?: number
  /** Trace ID for correlating across IPC / logs. */
  traceId: string
}

/** Output from the AI Gateway. */
export interface AIGatewayResponse {
  text: string
  provider: string
  modelId: string
  usage: Pick<LLMUsage, 'promptTokens' | 'completionTokens' | 'estimatedCostUsd'>
}

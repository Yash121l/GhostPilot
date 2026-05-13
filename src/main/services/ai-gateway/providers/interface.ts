import type { AITask } from '../../../../shared/types/ai'

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  systemMessage?: string
}

export interface LLMResult {
  text: string
  modelId: string
  promptTokens: number
  completionTokens: number
}

export interface LLMProvider {
  readonly providerId: string
  readonly defaultModelId: string
  complete(prompt: string, opts?: CompletionOptions): Promise<LLMResult>
  /** Cost per 1K prompt tokens in USD. */
  promptCostPer1k: number
  /** Cost per 1K completion tokens in USD. */
  completionCostPer1k: number
  /** Returns true if this provider can handle the given task well. */
  canHandle(task: AITask): boolean
}

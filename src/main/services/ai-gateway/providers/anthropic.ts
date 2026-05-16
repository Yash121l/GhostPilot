import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, CompletionOptions, LLMResult } from './interface'
import { AITask } from '../../../../shared/types/ai'

export class AnthropicProvider implements LLMProvider {
  readonly providerId = 'anthropic'
  readonly defaultModelId: string
  readonly promptCostPer1k: number
  readonly completionCostPer1k: number

  private client: Anthropic

  constructor(apiKey: string, model = 'claude-haiku-4-5-20251001') {
    this.client = new Anthropic({ apiKey })
    this.defaultModelId = model
    // Haiku pricing; bump for Sonnet/Opus
    const isHaiku = model.includes('haiku')
    const isSonnet = model.includes('sonnet')
    this.promptCostPer1k = isHaiku ? 0.00025 : isSonnet ? 0.003 : 0.015
    this.completionCostPer1k = isHaiku ? 0.00125 : isSonnet ? 0.015 : 0.075
  }

  canHandle(task: AITask): boolean {
    return Object.values(AITask).includes(task)
  }

  async complete(prompt: string, opts: CompletionOptions = {}): Promise<LLMResult> {
    const res = await this.client.messages.create({
      model: this.defaultModelId,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.systemMessage,
      messages: [{ role: 'user', content: prompt }],
      temperature: opts.temperature ?? 0.7
    })

    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    return {
      text,
      modelId: this.defaultModelId,
      promptTokens: res.usage.input_tokens,
      completionTokens: res.usage.output_tokens
    }
  }
}

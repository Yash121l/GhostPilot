import OpenAI from 'openai'
import type { LLMProvider, CompletionOptions, LLMResult } from './interface'
import { AITask } from '../../../../shared/types/ai'

export class OpenAIProvider implements LLMProvider {
  readonly providerId = 'openai'
  readonly defaultModelId: string
  readonly promptCostPer1k: number
  readonly completionCostPer1k: number

  private client: OpenAI

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey })
    this.defaultModelId = model
    // gpt-4o-mini pricing (per 1K tokens)
    this.promptCostPer1k = model.includes('mini') ? 0.00015 : 0.005
    this.completionCostPer1k = model.includes('mini') ? 0.0006 : 0.015
  }

  canHandle(task: AITask): boolean {
    // openai handles all tasks
    return Object.values(AITask).includes(task)
  }

  async complete(prompt: string, opts: CompletionOptions = {}): Promise<LLMResult> {
    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (opts.systemMessage) {
      messages.push({ role: 'system', content: opts.systemMessage })
    }
    messages.push({ role: 'user', content: prompt })

    const res = await this.client.chat.completions.create({
      model: this.defaultModelId,
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7
    })

    const choice = res.choices[0]
    const text = choice.message.content ?? ''
    const usage = res.usage ?? { prompt_tokens: 0, completion_tokens: 0 }

    return {
      text,
      modelId: this.defaultModelId,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens
    }
  }
}

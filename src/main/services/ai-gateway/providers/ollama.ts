import type { LLMProvider, CompletionOptions, LLMResult } from './interface'
import { AITask } from '../../../../shared/types/ai'

const OLLAMA_BASE = 'http://localhost:11434'

export class OllamaProvider implements LLMProvider {
  readonly providerId = 'ollama'
  readonly defaultModelId: string
  readonly promptCostPer1k = 0 // local — no cost
  readonly completionCostPer1k = 0

  constructor(model = 'llama3.2:3b') {
    this.defaultModelId = model
  }

  canHandle(task: AITask): boolean {
    // Local models are great for cheap tasks; avoid for premium drafting
    return task !== AITask.BUILD_FINGERPRINT && task !== AITask.DECOMPOSE_OKR
  }

  async complete(prompt: string, opts: CompletionOptions = {}): Promise<LLMResult> {
    const messages: { role: string; content: string }[] = []
    if (opts.systemMessage) messages.push({ role: 'system', content: opts.systemMessage })
    messages.push({ role: 'user', content: prompt })

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.defaultModelId,
        messages,
        stream: false,
        options: {
          num_predict: opts.maxTokens ?? 2048,
          temperature: opts.temperature ?? 0.7
        }
      }),
      signal: AbortSignal.timeout(60_000)
    })

    if (!res.ok) {
      throw new Error(`Ollama returned ${res.status}: ${await res.text()}`)
    }

    const data = (await res.json()) as {
      message: { content: string }
      prompt_eval_count?: number
      eval_count?: number
    }

    return {
      text: data.message.content,
      modelId: this.defaultModelId,
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0
    }
  }
}

/** Probe whether Ollama is running and list available models. */
export async function detectOllama(): Promise<{ available: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    })
    if (!res.ok) return { available: false, models: [] }
    const data = (await res.json()) as { models: { name: string }[] }
    return { available: true, models: data.models.map((m) => m.name) }
  } catch {
    return { available: false, models: [] }
  }
}

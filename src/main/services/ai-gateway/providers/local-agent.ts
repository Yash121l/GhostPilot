import type { AITask } from '../../../../shared/types/ai'
import type { CompletionOptions, LLMProvider, LLMResult } from './interface'
import { LocalAgentService } from '../../local-agents/local-agent.service'
import type { LocalAgentProvider } from '../../../../shared/ipc-types'

export class LocalAgentProviderAdapter implements LLMProvider {
  readonly defaultModelId: string
  readonly promptCostPer1k = 0
  readonly completionCostPer1k = 0
  private service = new LocalAgentService()

  constructor(
    readonly providerId: LocalAgentProvider,
    label: string
  ) {
    this.defaultModelId = label
  }

  async complete(prompt: string, opts?: CompletionOptions): Promise<LLMResult> {
    const result = await this.service.generate({
      provider: this.providerId,
      system: opts?.systemMessage,
      prompt,
      timeoutMs: 90_000
    })
    return {
      text: result.text,
      modelId: this.defaultModelId,
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: Math.ceil(result.text.length / 4)
    }
  }

  canHandle(_task: AITask): boolean {
    return true
  }
}

export async function detectLocalAgentProviders(): Promise<LocalAgentProviderAdapter[]> {
  const service = new LocalAgentService()
  const statuses = await service.status()
  return statuses
    .filter((status) => status.installed && status.authenticated)
    .map(
      (status) =>
        new LocalAgentProviderAdapter(
          status.provider,
          status.provider === 'codex-cli' ? 'Codex CLI' : 'Claude Code'
        )
    )
}

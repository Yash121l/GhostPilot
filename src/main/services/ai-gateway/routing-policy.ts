import type { LLMProvider } from './providers/interface'
import { AITask, ModelHint } from '../../../shared/types/ai'

/**
 * Selects the best available provider for a given task and hint.
 * Priority order:
 *   LOCAL → Ollama (if available)
 *   ECONOMY → local/free provider first, then cloud
 *   PREMIUM → best quality cloud provider
 */
export class RoutingPolicy {
  constructor(
    private readonly providers: Map<string, LLMProvider>,
    private readonly ollamaAvailable: () => boolean
  ) {}

  select(task: AITask, hint: ModelHint): LLMProvider {
    if (hint === ModelHint.LOCAL) {
      const ollama = this.providers.get('ollama')
      if (ollama && this.ollamaAvailable()) return ollama
      // Fall through to economy if Ollama is offline
    }

    if (hint === ModelHint.PREMIUM) {
      // Prefer cloud premium first, then local agents.
      for (const id of ['anthropic', 'openai', 'codex-cli', 'claude-code', 'ollama']) {
        const p = this.providers.get(id)
        if (p && p.canHandle(task)) return p
      }
    }

    // ECONOMY or fallback: prefer cheapest available
    const order = ['ollama', 'codex-cli', 'claude-code', 'openai', 'anthropic']
    for (const id of order) {
      const p = this.providers.get(id)
      if (!p) continue
      if (id === 'ollama' && !this.ollamaAvailable()) continue
      if (p.canHandle(task)) return p
    }

    throw new Error('No AI provider configured. Add an API key in Settings → AI Providers.')
  }
}

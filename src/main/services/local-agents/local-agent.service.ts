import type {
  LocalAgentGenerateRequest,
  LocalAgentProvider,
  LocalAgentStatus
} from '../../../shared/ipc-types'
import { ClaudeCodeAdapter } from './claude-code.adapter'
import { CodexCliAdapter } from './codex-cli.adapter'
import type { LocalAgentAdapter } from './local-agent-adapter'

export class LocalAgentService {
  private readonly adapters: LocalAgentAdapter[] = [new CodexCliAdapter(), new ClaudeCodeAdapter()]

  async status(): Promise<LocalAgentStatus[]> {
    return Promise.all(this.adapters.map((adapter) => adapter.status()))
  }

  async generate(
    req: LocalAgentGenerateRequest
  ): Promise<{ text: string; provider: LocalAgentProvider }> {
    const adapter = this.adapters.find((item) => item.provider === req.provider)
    if (!adapter) throw new Error(`Unsupported local agent provider: ${req.provider}`)
    return adapter.generate(req)
  }
}

import type { LocalAgentGenerateRequest, LocalAgentStatus } from '../../../shared/ipc-types'
import {
  clampTimeout,
  commandVersion,
  findCommand,
  joinPrompt,
  runCliWithInput,
  type LocalAgentAdapter
} from './local-agent-adapter'

export class CodexCliAdapter implements LocalAgentAdapter {
  provider = 'codex-cli' as const
  label = 'Codex CLI'
  command = 'codex'

  async status(): Promise<LocalAgentStatus> {
    const path = await findCommand(this.command)
    if (!path) {
      return {
        provider: this.provider,
        installed: false,
        authenticated: false,
        unavailableReason: `${this.label} is not installed or not on PATH.`
      }
    }
    return {
      provider: this.provider,
      installed: true,
      authenticated: true,
      path,
      version: await commandVersion(this.command)
    }
  }

  async generate(req: LocalAgentGenerateRequest): Promise<{ text: string; provider: 'codex-cli' }> {
    const path = await findCommand(this.command)
    if (!path) throw new Error(`${this.label} is not installed or not on PATH.`)
    const text = await runCliWithInput({
      commandPath: path,
      args: ['exec', '--skip-git-repo-check', '--color', 'never', '--ephemeral', '-'],
      input: joinPrompt(req),
      timeoutMs: clampTimeout(req.timeoutMs),
      stderrPrefix: this.label
    }).catch((error) => {
      const message = String(error instanceof Error ? error.message : error)
      if (/auth|login|sign.?in|unauthori[sz]ed|credential/i.test(message)) {
        throw new Error(`${this.label} is installed but not signed in. Run \`codex login\`.`)
      }
      throw new Error(message)
    })
    return { text, provider: this.provider }
  }
}

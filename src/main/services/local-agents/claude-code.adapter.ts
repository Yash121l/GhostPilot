import type { LocalAgentGenerateRequest, LocalAgentStatus } from '../../../shared/ipc-types'
import {
  clampTimeout,
  commandSucceeds,
  commandVersion,
  findCommand,
  joinPrompt,
  runCliWithInput,
  type LocalAgentAdapter
} from './local-agent-adapter'

export class ClaudeCodeAdapter implements LocalAgentAdapter {
  provider = 'claude-code' as const
  label = 'Claude Code'
  command = 'claude'

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
    const authenticated = await commandSucceeds(path, ['auth', 'status'])
    return {
      provider: this.provider,
      installed: true,
      authenticated,
      path,
      version: await commandVersion(this.command),
      unavailableReason: authenticated
        ? undefined
        : `${this.label} is installed but not signed in. Run \`claude auth login\`.`
    }
  }

  async generate(
    req: LocalAgentGenerateRequest
  ): Promise<{ text: string; provider: 'claude-code' }> {
    const path = await findCommand(this.command)
    if (!path) throw new Error(`${this.label} is not installed or not on PATH.`)
    const text = await runCliWithInput({
      commandPath: path,
      args: [
        '--print',
        '--input-format',
        'text',
        '--output-format',
        'text',
        '--no-session-persistence'
      ],
      input: joinPrompt(req),
      timeoutMs: clampTimeout(req.timeoutMs),
      stderrPrefix: this.label
    }).catch((error) => {
      const message = String(error instanceof Error ? error.message : error)
      if (/auth|login|sign.?in|unauthori[sz]ed|credential/i.test(message)) {
        throw new Error(`${this.label} is installed but not signed in. Run \`claude auth login\`.`)
      }
      throw new Error(message)
    })
    return { text, provider: this.provider }
  }
}

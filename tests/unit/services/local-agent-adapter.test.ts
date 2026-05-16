import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const childProcessMock = vi.hoisted(() => {
  const customPromisify = Symbol.for('nodejs.util.promisify.custom')
  const execFile = vi.fn()
  Object.assign(execFile, {
    [customPromisify]: vi.fn(async (command: string, args: string[]) => {
      if (command === 'which') {
        return { stdout: `/mock/bin/${args[0]}\n`, stderr: '' }
      }
      if (args[0] === '--version') {
        return { stdout: `${command} 1.2.3\n`, stderr: '' }
      }
      if (args[0] === 'auth' && args[1] === 'status') {
        return { stdout: 'Authenticated\n', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })
  })

  return {
    execFile,
    spawn: vi.fn(),
    lastChild: undefined as FakeChild | undefined
  }
})

vi.mock('node:child_process', () => ({
  execFile: childProcessMock.execFile,
  spawn: childProcessMock.spawn
}))

class FakeStream extends EventEmitter {
  end = vi.fn((input?: string) => {
    this.endedInput = input
  })
  setEncoding = vi.fn()
  endedInput?: string
}

class FakeChild extends EventEmitter {
  stdin = new FakeStream()
  stdout = new FakeStream()
  stderr = new FakeStream()
  killed = false
  kill = vi.fn((signal?: NodeJS.Signals) => {
    this.killed = true
    this.signal = signal
    return true
  })
  signal?: NodeJS.Signals
}

function mockSpawnChild(): FakeChild {
  const child = new FakeChild()
  childProcessMock.lastChild = child
  childProcessMock.spawn.mockReturnValue(child)
  return child
}

const { runCliWithInput, compactCliError, commandSucceeds } =
  await import('../../../src/main/services/local-agents/local-agent-adapter')
const { CodexCliAdapter } =
  await import('../../../src/main/services/local-agents/codex-cli.adapter')
const { ClaudeCodeAdapter } =
  await import('../../../src/main/services/local-agents/claude-code.adapter')

beforeEach(() => {
  vi.useRealTimers()
  childProcessMock.spawn.mockReset()
  childProcessMock.lastChild = undefined
  mockSpawnChild()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('runCliWithInput', () => {
  it('writes input to stdin and closes it', async () => {
    const promise = runCliWithInput({
      commandPath: '/mock/bin/agent',
      args: ['--print'],
      input: 'secret prompt',
      timeoutMs: 5000
    })

    const child = childProcessMock.lastChild!
    expect(child.stdin.end).toHaveBeenCalledWith('secret prompt')
    child.stdout.emit('data', 'rewritten text\n')
    child.emit('close', 0)

    await expect(promise).resolves.toBe('rewritten text')
  })

  it('rejects with sanitized stderr on non-zero exit without leaking input', async () => {
    const longPrompt = 'Rewrite this private draft: ' + 'x'.repeat(1000)
    const promise = runCliWithInput({
      commandPath: '/mock/bin/agent',
      args: ['--print'],
      input: longPrompt,
      timeoutMs: 5000,
      stderrPrefix: 'Codex CLI'
    })

    const child = childProcessMock.lastChild!
    child.stderr.emit('data', `${longPrompt}\nAuthentication failed\n`)
    child.emit('close', 1)

    await expect(promise).rejects.toThrow('Codex CLI failed with exit code 1')
    await expect(promise).rejects.toThrow('Authentication failed')
    await expect(promise).rejects.not.toThrow(longPrompt)
  })

  it('rejects when stdout is empty', async () => {
    const promise = runCliWithInput({
      commandPath: '/mock/bin/agent',
      args: ['--print'],
      input: 'prompt',
      timeoutMs: 5000,
      stderrPrefix: 'Claude Code'
    })

    childProcessMock.lastChild!.emit('close', 0)

    await expect(promise).rejects.toThrow('Claude Code returned no output.')
  })

  it('kills the process on timeout', async () => {
    vi.useFakeTimers()
    const promise = runCliWithInput({
      commandPath: '/mock/bin/agent',
      args: ['--print'],
      input: 'prompt',
      timeoutMs: 5000,
      stderrPrefix: 'Local agent'
    })

    const child = childProcessMock.lastChild!
    const expectation = expect(promise).rejects.toThrow('Local agent timed out after 5000ms.')
    await vi.advanceTimersByTimeAsync(5000)

    await expectation
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('compacts noisy CLI errors', () => {
    expect(
      compactCliError(
        '\u001b[31mReading additional input from stdin...\u001b[0m\nRewrite the following text\nUseful failure\nSecond line'
      )
    ).toBe('Useful failure\nSecond line')
  })

  it('removes command and prompt echoes from CLI errors', () => {
    const prompt = [
      'You are a professional social media ghostwriter.',
      'SOURCE DRAFT:',
      'private draft text'
    ].join('\n')

    expect(
      compactCliError(
        [
          'Error: Command failed: /opt/homebrew/bin/codex exec --skip-git-repo-check You are a professional social media ghostwriter. SOURCE DRAFT: private draft text',
          'Reading additional input from stdin...',
          'Authentication failed'
        ].join('\n'),
        prompt
      )
    ).toBe('Authentication failed')
  })
})

describe('local agent adapters', () => {
  it('Codex CLI passes prompts through stdin and uses non-interactive stdin args', async () => {
    const adapter = new CodexCliAdapter()
    const promise = adapter.generate({
      provider: 'codex-cli',
      prompt: 'Rewrite this draft',
      timeoutMs: 5000
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(childProcessMock.spawn).toHaveBeenCalledWith(
      '/mock/bin/codex',
      ['exec', '--skip-git-repo-check', '--color', 'never', '--ephemeral', '-'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    )
    const [, args] = childProcessMock.spawn.mock.calls[0]
    expect(args).not.toContain('Rewrite this draft')
    expect(childProcessMock.lastChild!.stdin.end).toHaveBeenCalledWith('Rewrite this draft')
    childProcessMock.lastChild!.stdout.emit('data', 'codex output\n')
    childProcessMock.lastChild!.emit('close', 0)

    await expect(promise).resolves.toEqual({ text: 'codex output', provider: 'codex-cli' })
  })

  it('Claude Code passes prompts through stdin and uses print mode args', async () => {
    const adapter = new ClaudeCodeAdapter()
    const promise = adapter.generate({
      provider: 'claude-code',
      prompt: 'Rewrite this draft',
      system: 'Return only text',
      timeoutMs: 5000
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(childProcessMock.spawn).toHaveBeenCalledWith(
      '/mock/bin/claude',
      ['--print', '--input-format', 'text', '--output-format', 'text', '--no-session-persistence'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    )
    expect(childProcessMock.lastChild!.stdin.end).toHaveBeenCalledWith(
      'Return only text\n\nRewrite this draft'
    )
    childProcessMock.lastChild!.stdout.emit('data', 'claude output\n')
    childProcessMock.lastChild!.emit('close', 0)

    await expect(promise).resolves.toEqual({ text: 'claude output', provider: 'claude-code' })
  })

  it('Claude Code status uses auth status without reading credential files', async () => {
    const adapter = new ClaudeCodeAdapter()

    await expect(adapter.status()).resolves.toMatchObject({
      installed: true,
      authenticated: true
    })
    await expect(commandSucceeds('/mock/bin/claude', ['auth', 'status'])).resolves.toBe(true)
  })
})

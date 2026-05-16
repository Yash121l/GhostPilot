import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  LocalAgentGenerateRequest,
  LocalAgentProvider,
  LocalAgentStatus
} from '../../../shared/ipc-types'

const execFileAsync = promisify(execFile)
const ANSI_ESCAPE = String.fromCharCode(27)
const ANSI_PATTERN = new RegExp(`${ANSI_ESCAPE}\\[[0-9;]*m`, 'g')

function looksLikePromptEcho(line: string): boolean {
  return (
    /you are a professional social media ghostwriter/i.test(line) ||
    /you are ghostwriting a .* post for a creator/i.test(line) ||
    /source draft:/i.test(line) ||
    /platform instructions:/i.test(line) ||
    /persona:/i.test(line) ||
    /output: return only/i.test(line) ||
    /command failed: .*codex exec/i.test(line)
  )
}

export interface LocalAgentAdapter {
  provider: LocalAgentProvider
  label: string
  command: string
  status(): Promise<LocalAgentStatus>
  generate(req: LocalAgentGenerateRequest): Promise<{ text: string; provider: LocalAgentProvider }>
}

export interface RunCliWithInputOptions {
  commandPath: string
  args: string[]
  input: string
  timeoutMs: number
  env?: NodeJS.ProcessEnv
  cwd?: string
  stderrPrefix?: string
}

export async function findCommand(command: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('which', [command], { timeout: 2500 })
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

export async function commandVersion(command: string): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(command, ['--version'], { timeout: 4000 })
    return (stdout || stderr).trim().split('\n')[0]
  } catch {
    return undefined
  }
}

export async function commandSucceeds(commandPath: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(commandPath, args, { timeout: 4000 })
    return true
  } catch {
    return false
  }
}

export function compactCliError(stderr: string, input?: string): string {
  const text = stderr
    .replace(ANSI_PATTERN, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !input?.includes(line))
    .filter((line) => !looksLikePromptEcho(line))
    .filter((line) => !/^reading additional input from stdin/i.test(line))
    .filter((line) => !/^rewrite the following text/i.test(line))
    .filter((line) => !/^return only the rewritten text/i.test(line))
    .map((line) => (line.length > 240 ? `${line.slice(0, 237)}...` : line))
    .slice(0, 4)
    .join('\n')
    .trim()

  return text.length > 1000 ? `${text.slice(0, 997)}...` : text
}

export async function runCliWithInput({
  commandPath,
  args,
  input,
  timeoutMs,
  env,
  cwd,
  stderrPrefix = 'Local agent'
}: RunCliWithInputOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandPath, args, {
      cwd,
      env: env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    let forceKillTimer: NodeJS.Timeout | undefined

    const finish = (error?: Error, text?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      if (error) {
        reject(error)
        return
      }
      resolve(text ?? '')
    }

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      forceKillTimer = setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL')
      }, 2000)
      finish(new Error(`${stderrPrefix} timed out after ${timeoutMs}ms.`))
    }, timeoutMs)

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      finish(new Error(`${stderrPrefix} failed to start: ${error.message}`))
    })
    child.on('close', (code) => {
      if (settled) return
      const text = stdout.trim()
      const compactError = compactCliError(stderr, input)
      if (code !== 0) {
        finish(
          new Error(
            `${stderrPrefix} failed${code == null ? '' : ` with exit code ${code}`}: ${compactError || 'No error output.'}`
          )
        )
        return
      }
      if (!text) {
        finish(new Error(`${stderrPrefix} returned no output.`))
        return
      }
      finish(undefined, text)
    })

    child.stdin?.end(input)
  })
}

export function clampTimeout(timeoutMs: number): number {
  return Math.max(5000, Math.min(timeoutMs || 60_000, 180_000))
}

export function joinPrompt(req: LocalAgentGenerateRequest): string {
  return [req.system, req.prompt].filter(Boolean).join('\n\n')
}

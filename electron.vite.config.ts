import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Load .env file for the main process (electron-vite only exposes VITE_* to renderer)
function loadDotEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return {}
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  const vars: Record<string, string> = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    vars[key] = val
  }
  return vars
}

const dotEnv = loadDotEnv()

// Build a `define` map so process.env.KEY references in main process are replaced at compile time
const mainDefine = Object.fromEntries(
  Object.entries(dotEnv).map(([k, v]) => [`process.env['${k}']`, JSON.stringify(v)])
)

export default defineConfig({
  main: {
    define: mainDefine,
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'workers/publisher.worker': resolve('src/main/workers/publisher.worker.ts')
        }
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})

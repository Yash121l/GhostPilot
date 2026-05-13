import { app, BrowserWindow, Tray, nativeImage, dialog, shell, protocol, Notification } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { Worker } from 'worker_threads'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initDb, closeDb, getDbPath } from './infrastructure/db/connection'
import { runMigrations } from './infrastructure/db/migration-runner'
import { createLogger } from './infrastructure/logger/logger'
import { registerAllHandlers } from './ipc'
import { initServices, getServices } from './services/index'
import type { Platform } from '../shared/types/platform'
import { APP_NAME, APP_URL_SCHEME } from '../shared/constants'

// ─── Load .env into process.env at runtime ────────────────────────────────────
// electron-vite's `define` only substitutes at build time. In dev mode the
// main process runs from source, so we must load .env ourselves.
;(function loadEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) process.env[key] = val
  }
})()

const logger = createLogger('Main')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let publisherWorker: Worker | null = null

async function bootstrap(): Promise<void> {
  logger.info({ msg: 'App starting', version: app.getVersion() })

  // 1. Database
  try {
    initDb()
    runMigrations()
  } catch (e) {
    logger.error({ msg: 'DB initialisation failed', error: String(e) })
    await dialog.showErrorBox(
      'Database Error',
      `${APP_NAME} could not initialise its database.\n\n${String(e)}\n\nThe app will now quit.`,
    )
    app.quit()
    return
  }

  // 2. IPC handlers (must be before services so handles are registered)
  registerAllHandlers()

  // 3. Application services
  try {
    await initServices()
  } catch (e) {
    logger.error({ msg: 'Service initialisation failed', error: String(e) })
    // Non-fatal — app still works; user just needs to configure providers
  }

  // 4. Start scheduler (in-process fallback) + publisher worker
  try {
    getServices().schedulerService.start()
  } catch {
    // Services may not be ready if DB failed partially
  }

  // 5. Spawn publisher worker thread (handles actual publish dispatch)
  try {
    const workerPath = join(__dirname, 'workers/publisher.worker.js')
    publisherWorker = new Worker(workerPath, { workerData: { dbPath: getDbPath() } })

    publisherWorker.on('message', (msg: { kind: string; jobId?: string; postId?: string; platform?: string; url?: string; error?: string; permanent?: boolean; level?: string; context?: string; msg?: string; fields?: Record<string, unknown> }) => {
      if (msg.kind === 'log') {
        const wLogger = createLogger(msg.context ?? 'Worker', 'publisher')
        const level = (msg.level ?? 'info') as 'debug' | 'info' | 'warn' | 'error'
        wLogger[level]({ msg: msg.msg, ...msg.fields })
        return
      }

      // Relay publish_request to actual connector
      if (msg.kind === 'publish_request' && msg.jobId) {
        const jobId = msg.jobId
        const platform = msg.platform as Platform
        const body = (msg as unknown as Record<string, string>)['body'] ?? ''

        getServices().oauthManager.getTokens(platform).then(async (tokens) => {
          if (!tokens) {
            publisherWorker?.postMessage({ kind: 'publish_error', jobId, error: `No tokens for ${platform}` })
            return
          }
          const connector = getServices().oauthManager.getConnector(platform)
          if (!connector) {
            publisherWorker?.postMessage({ kind: 'publish_error', jobId, error: `No connector for ${platform}` })
            return
          }
          try {
            const result = await connector.publish({ body }, tokens)
            publisherWorker?.postMessage({ kind: 'publish_result', jobId, url: result.url, externalId: result.externalId })
          } catch (e) {
            publisherWorker?.postMessage({ kind: 'publish_error', jobId, error: String(e) })
          }
        }).catch((e) => {
          publisherWorker?.postMessage({ kind: 'publish_error', jobId, error: String(e) })
        })
        return
      }

      // Forward job status events to renderer
      if ((msg.kind === 'job:published' || msg.kind === 'job:failed') && mainWindow) {
        mainWindow.webContents.send(msg.kind, msg)

        if (msg.kind === 'job:published') {
          new Notification({ title: APP_NAME, body: `Post published on ${msg.platform}` }).show()
        } else if (msg.permanent) {
          new Notification({ title: APP_NAME, body: `Post failed permanently on ${msg.platform}` }).show()
        }
      }
    })

    publisherWorker.on('error', (e) => logger.error({ msg: 'Publisher worker error', error: e.message }))
    publisherWorker.on('exit', (code) => {
      if (code !== 0) logger.warn({ msg: 'Publisher worker exited', code })
      publisherWorker = null
    })
  } catch (e) {
    logger.warn({ msg: 'Publisher worker failed to start', error: String(e) })
  }

  // 5. Main window
  mainWindow = createMainWindow()
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          app.isPackaged
            ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:"
            : "default-src 'self' 'unsafe-inline' 'unsafe-eval' data:; connect-src 'self' ws: http: https:; script-src 'self' 'unsafe-eval' 'unsafe-inline' http:;",
        ],
      },
    })
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('ready-to-show', () => {
    win.show()
    logger.info({ msg: 'Main window ready' })
  })

  // When window is closed, keep app alive in tray
  win.on('close', (e) => {
    if (process.platform === 'darwin') {
      e.preventDefault()
      win.hide()
    }
  })

  return win
}

function registerOAuthScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_URL_SCHEME, privileges: { secure: true, standard: true } },
  ])
}

function createTray(): void {
  try {
    const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icons/tray.png'))
    tray = new Tray(icon.resize({ width: 16, height: 16 }))
    tray.setToolTip(APP_NAME)
    tray.on('click', () => {
      mainWindow?.show()
      mainWindow?.focus()
    })
  } catch {
    // Tray icon missing — not fatal in dev
    logger.warn({ msg: 'Tray icon not found — skipping tray setup' })
  }
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────

registerOAuthScheme()

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.ghostpilot.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await bootstrap()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  logger.info({ msg: 'App quitting — stopping scheduler & closing DB' })
  try {
    getServices().schedulerService.stop()
  } catch {
    // services may not have init'd
  }
  publisherWorker?.postMessage({ kind: 'shutdown' })
  publisherWorker?.terminate()
  closeDb()
  tray?.destroy()
})

// Handle OAuth callback via custom URL scheme
app.on('open-url', async (_event, url) => {
  logger.info({ msg: 'OAuth callback received', path: url.split('?')[0] })
  try {
    await getServices().oauthManager.handleCallback(url)
    mainWindow?.webContents.send('auth:connected')
    new Notification({
      title: 'GhostPilot',
      body: 'Platform connected successfully',
    }).show()
  } catch (e) {
    logger.error({ msg: 'OAuth callback failed', error: String(e) })
    mainWindow?.webContents.send('auth:error', String(e))
  }
})

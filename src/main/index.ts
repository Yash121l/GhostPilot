/**
 * @module main/index
 * Electron main process entry point.
 *
 * Boot order:
 *  1. initDb()           — open SQLite, WAL mode
 *  2. runMigrations()    — apply pending SQL migrations
 *  3. Register services  — DI wiring
 *  4. Register IPC handlers
 *  5. Create BrowserWindow
 *  6. Setup Tray
 *  7. Register URL scheme for OAuth callbacks
 */

import { app, BrowserWindow, Tray, nativeImage, dialog, shell, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initDb, closeDb } from './infrastructure/db/connection'
import { runMigrations } from './infrastructure/db/migration-runner'
import { createLogger } from './infrastructure/logger/logger'
import { registerAllHandlers } from './ipc'
import { APP_NAME, APP_URL_SCHEME } from '../shared/constants'

const logger = createLogger('Main')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ─── Startup ──────────────────────────────────────────────────────────────────

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

  // 2. IPC handlers
  registerAllHandlers()

  // 3. Create main window
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
    // Open all external links in system browser.
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Content Security Policy
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

  // Load renderer
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

  return win
}

// ─── OAuth URL scheme ─────────────────────────────────────────────────────────

function registerOAuthScheme(): void {
  // Must be called before app.whenReady()
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_URL_SCHEME, privileges: { secure: true, standard: true } },
  ])
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icons/tray.png'))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip(APP_NAME)
  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

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
  logger.info({ msg: 'App quitting — closing DB' })
  closeDb()
  tray?.destroy()
})

// Handle OAuth callback via custom URL scheme
app.on('open-url', (_event, url) => {
  logger.info({ msg: 'OAuth callback received', url: url.split('?')[0] })
  mainWindow?.webContents.send('auth:oauth-callback', url)
})

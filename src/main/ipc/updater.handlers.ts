import os from 'os'
import { autoUpdater } from 'electron-updater'
import { ipcMain, shell, BrowserWindow, app } from 'electron'
import { createLogger } from '../infrastructure/logger/logger'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import type { UpdateState } from '../../shared/ipc-types'

const logger = createLogger('Updater')

let updateState: UpdateState = { status: 'idle' }

function setState(next: UpdateState, win: BrowserWindow): void {
  updateState = next
  win.webContents.send(IPC_CHANNELS.UPDATER_STATE_CHANGED, next)
}

export function setupUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null

  // Detect Apple Silicon Mac running Intel build under Rosetta.
  // Differential downloads break cross-arch so disable them, and warn the user
  // so they know the next update will move them to the native arm64 package.
  const isRosetta = os.arch() === 'arm64' && process.arch === 'x64'
  if (isRosetta) {
    logger.warn({ msg: 'Running Intel build on Apple Silicon (Rosetta) — next update migrates to arm64' })
    autoUpdater.disableDifferentialDownload = true
    win.webContents.once('did-finish-load', () => {
      win.webContents.send(IPC_CHANNELS.UPDATER_ROSETTA_WARNING)
    })
  }

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking' }, win)
  })

  autoUpdater.on('update-available', (info) => {
    logger.info({ msg: 'Update available', version: info.version })
    setState({ status: 'available', version: info.version }, win)
  })

  autoUpdater.on('update-not-available', () => {
    setState({ status: 'up-to-date' }, win)
  })

  autoUpdater.on('error', (err) => {
    logger.warn({ msg: 'Update check failed', error: err.message })
    setState({ status: 'error', message: err.message }, win)
  })

  ipcMain.handle(IPC_CHANNELS.UPDATER_GET_STATE, () => updateState)

  ipcMain.handle('updater:open-releases', async () => {
    await shell.openExternal('https://ghostpilot.yashlunawat.com/releases/')
    return { ok: true, value: undefined }
  })

  // Only check in packaged builds — dev always throws
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 5000)
  }
}

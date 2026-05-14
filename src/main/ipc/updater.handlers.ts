import { autoUpdater } from 'electron-updater'
import { ipcMain, shell, BrowserWindow, app } from 'electron'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('Updater')

export function setupUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null

  autoUpdater.on('update-available', (info) => {
    logger.info({ msg: 'Update available', version: info.version })
    win.webContents.send('updater:update-available', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    logger.warn({ msg: 'Update check failed', error: err.message })
  })

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

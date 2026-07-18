import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'

function sendUpdateMessage(message: string) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('updater:message', message)
  })
}

export function initUpdater() {
  log.transports.file.level = 'info'
  autoUpdater.logger = log

  autoUpdater.on('update-available', () => {
    sendUpdateMessage('发现新版本，正在下载...')
  })

  autoUpdater.on('update-not-available', () => {
    sendUpdateMessage('当前已是最新版本')
  })

  autoUpdater.on('update-downloaded', () => {
    sendUpdateMessage('新版本已下载')
  })

  autoUpdater.on('error', (err) => {
    sendUpdateMessage(`检查更新失败: ${err.message}`)
    log.error('Updater error:', err)
  })

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, updateInfo: result?.updateInfo }
    } catch (err) {
      log.error('手动检查更新失败', err)
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // 启动时检查更新并显示系统通知
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error('自动更新检查失败', err)
  })
}

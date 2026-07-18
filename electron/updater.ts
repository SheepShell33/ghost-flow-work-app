import { autoUpdater } from 'electron-updater'
import { dialog, ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'

function sendUpdateMessage(message: string) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('updater:message', message)
  })
}

export function initUpdater() {
  log.transports.file.level = 'info'
  autoUpdater.logger = log

  // 启动时静默检查更新并通知
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error('自动更新检查失败', err)
  })

  autoUpdater.on('update-available', () => {
    sendUpdateMessage('发现新版本，正在下载...')
    dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: '发现新版本，下载完成后将自动安装。',
      buttons: ['确定'],
    })
  })

  autoUpdater.on('update-downloaded', () => {
    sendUpdateMessage('新版本已下载')
    dialog
      .showMessageBox({
        type: 'info',
        title: '更新已下载',
        message: '新版本已下载，是否立即安装并重启？',
        buttons: ['立即重启', '稍后'],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    sendUpdateMessage(`更新失败: ${err.message}`)
    log.error('Updater error:', err)
  })

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result?.updateInfo?.version) {
        const version = result.updateInfo.version
        sendUpdateMessage(`发现新版本: ${version}`)
        return { success: true, updateInfo: result.updateInfo }
      }
      sendUpdateMessage('当前已是最新版本')
      return { success: true, updateInfo: result?.updateInfo }
    } catch (err: any) {
      sendUpdateMessage(`检查更新失败: ${err.message}`)
      log.error('手动检查更新失败', err)
      return { success: false, error: err.message }
    }
  })
}

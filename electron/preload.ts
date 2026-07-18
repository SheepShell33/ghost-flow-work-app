import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  onUpdateMessage: (callback: (event: unknown, message: string) => void) => {
    ipcRenderer.on('updater:message', callback)
    return () => ipcRenderer.off('updater:message', callback)
  },
})

import { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'
import fs from 'fs'
import axios from 'axios'

import { initUpdater } from './updater'

const BACKEND_PORT = 17892
const BACKEND_HEALTH_TIMEOUT = 30000

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let backendProcess: ChildProcessWithoutNullStreams | null = null

function getInstallDir(): string {
  return path.dirname(app.getPath('exe'))
}

function getBackendExePath(): string {
  return path.join(process.resourcesPath, 'ghost-flow-backend.exe')
}

function getDataDir(): string {
  return path.join(getInstallDir(), 'data')
}

async function waitForBackend(): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < BACKEND_HEALTH_TIMEOUT) {
    try {
      const res = await axios.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, { timeout: 1000 })
      if (res.status === 200) return true
    } catch {
      // 后端尚未就绪，继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    center: true,
    show: false,
    title: 'Ghost Flow Work App',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}/`)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!(app as any).isQuiting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(process.resourcesPath, 'tray-icon.png')
  let trayIcon: Electron.NativeImage
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } else {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 Ghost Flow',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => {
        autoUpdater.checkForUpdates().catch((err) => {
          dialog.showErrorBox('检查更新失败', err.message)
        })
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        ;(app as any).isQuiting = true
        app.quit()
      },
    },
  ])

  tray.setToolTip('Ghost Flow Work App')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    }
  })
}

async function startBackend() {
  const exePath = getBackendExePath()
  if (!fs.existsSync(exePath)) {
    dialog.showErrorBox('后端组件缺失', `找不到后端程序：${exePath}`)
    app.quit()
    return
  }

  const dataDir = getDataDir()
  fs.mkdirSync(dataDir, { recursive: true })

  backendProcess = spawn(exePath, [], {
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      GHOST_FLOW_DATA_DIR: dataDir,
    },
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend stdout] ${data}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend stderr] ${data}`)
  })

  backendProcess.on('error', (err) => {
    dialog.showErrorBox('后端启动失败', err.message)
    app.quit()
  })

  const ok = await waitForBackend()
  if (!ok) {
    dialog.showErrorBox('服务启动超时', `Ghost Flow 后端未能在 ${BACKEND_HEALTH_TIMEOUT / 1000} 秒内启动。`)
    backendProcess.kill()
    app.quit()
  }
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill()
  }
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  await startBackend()
  createWindow()
  createTray()
  initUpdater()
})

app.on('before-quit', () => {
  ;(app as any).isQuiting = true
})

app.on('window-all-closed', () => {
  // 保留托盘与后端进程
})

app.on('will-quit', () => {
  stopBackend()
})

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
  } else {
    createWindow()
  }
})

ipcMain.handle('app:version', () => app.getVersion())

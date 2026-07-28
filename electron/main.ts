import { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { spawn, execFileSync, ChildProcessWithoutNullStreams } from 'child_process'
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
  // 便携版（portable target）运行时 exe 会被解压到临时目录，
  // electron-builder 会设置 PORTABLE_EXECUTABLE_DIR 指向便携 exe 实际所在目录，
  // 数据必须落在那里，否则随临时目录清理而丢失
  return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'))
}

function getBackendExePath(): string {
  return path.join(process.resourcesPath, 'ghost-flow-backend.exe')
}

function getDataDir(): string {
  return path.join(getInstallDir(), 'data')
}

async function isBackendAlive(): Promise<boolean> {
  try {
    const res = await axios.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, { timeout: 1000 })
    return res.status === 200
  } catch {
    return false
  }
}

// PyInstaller 单文件 exe 是父子双进程（引导器 + 真正的 Python 进程），
// 只 kill 父进程会留下子进程占用端口，必须按进程树终止
function killProcessTree(pid: number) {
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } catch {
      // 进程已退出时 taskkill 返回非零，忽略
    }
  } else {
    try {
      process.kill(pid)
    } catch {
      // 忽略
    }
  }
}

// 启动前清理上次异常退出残留的后端进程（否则端口被占，新后端绑定失败退出码 3）
function killStaleBackends() {
  if (process.platform !== 'win32') return
  try {
    execFileSync('taskkill', ['/IM', 'ghost-flow-backend.exe', '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  } catch {
    // 没有残留进程时 taskkill 返回非零，忽略
  }
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
  const candidates = [
    path.join(process.resourcesPath, 'app.asar', 'assets', 'tray-icon.png'),
    path.join(process.resourcesPath, 'assets', 'tray-icon.png'),
    path.join(__dirname, '..', 'assets', 'tray-icon.png'),
  ]
  const iconPath = candidates.find((p) => fs.existsSync(p))
  let trayIcon: Electron.NativeImage
  if (iconPath) {
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
        autoUpdater.checkForUpdates().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          dialog.showErrorBox('检查更新失败', message)
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

async function startBackend(): Promise<boolean> {
  const exePath = getBackendExePath()
  if (!fs.existsSync(exePath)) {
    dialog.showErrorBox('后端组件缺失', `找不到后端程序：${exePath}`)
    app.quit()
    return false
  }

  const dataDir = getDataDir()
  fs.mkdirSync(dataDir, { recursive: true })

  // 上次异常退出可能残留后端进程占用端口（不能复用：前端静态资源由后端托管，
  // 残留旧版本会导致界面与服务端版本不一致），先按进程树清理并等待端口释放
  if (await isBackendAlive()) {
    killStaleBackends()
    const start = Date.now()
    while (await isBackendAlive()) {
      if (Date.now() - start > 10000) {
        dialog.showErrorBox('后端端口被占用', `端口 ${BACKEND_PORT} 上的残留后端进程无法终止，请手动结束后重试。`)
        app.quit()
        return false
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  return new Promise((resolve) => {
    let resolved = false
    const resolveOnce = (value: boolean) => {
      if (resolved) return
      resolved = true
      resolve(value)
    }

    backendProcess = spawn(exePath, [], {
      windowsHide: true,
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
      resolveOnce(false)
    })

    backendProcess.on('exit', (code) => {
      console.log(`[backend] exited with code ${code}`)
      if (!(app as any).isQuiting) {
        dialog.showErrorBox('后端意外退出', `Ghost Flow 后端进程已意外退出（退出码：${code}）。`)
        app.quit()
      }
      resolveOnce(false)
    })

    waitForBackend().then((ok) => {
      if (!ok) {
        dialog.showErrorBox('服务启动超时', `Ghost Flow 后端未能在 ${BACKEND_HEALTH_TIMEOUT / 1000} 秒内启动。`)
        backendProcess?.kill()
        app.quit()
        resolveOnce(false)
        return
      }
      resolveOnce(true)
    })
  })
}

function stopBackend() {
  if (backendProcess && backendProcess.pid && !backendProcess.killed) {
    killProcessTree(backendProcess.pid)
    backendProcess = null
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
  const ok = await startBackend()
  if (!ok) {
    return
  }
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

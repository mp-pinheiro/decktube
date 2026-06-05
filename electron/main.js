import { app, BrowserWindow, dialog, globalShortcut, ipcMain, shell } from 'electron'

import { createServer } from 'http'
import https from 'https'
import http from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { appendFileSync, existsSync, statSync, writeFileSync } from 'fs'
import { execFile } from 'child_process'

function execFileAsync(cmd, args, options) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env.VITE_DEV_SERVER_URL

const logPath = join(app.getPath('userData'), 'decktube.log')
try { writeFileSync(logPath, `[${new Date().toISOString()}] DeckTube started\n`) } catch {}
function logToFile(msg) {
  try { appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`) } catch {}
}

let mainWindow
let proxyServer = null

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
}

function applyCors(proxyRes) {
  Object.assign(proxyRes.headers, CORS)
}

function createProxiedServer() {
  const srv = express()

  srv.use('/youtubei', createProxyMiddleware({
    target: 'https://www.youtube.com',
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
      if (req.headers['authorization']) {
        proxyReq.setHeader('Authorization', req.headers['authorization'])
      }
      const playerUa = req.headers['x-youtube-player-user-agent']
      if (playerUa) {
        proxyReq.setHeader('User-Agent', playerUa)
        proxyReq.removeHeader('X-YouTube-Player-User-Agent')
        proxyReq.setHeader('Origin', 'https://m.youtube.com')
      } else {
        proxyReq.setHeader('Origin', 'https://www.youtube.com')
      }
    },
    onProxyRes: applyCors,
  }))

  srv.use('/oauth', createProxyMiddleware({
    target: 'https://accounts.google.com',
    changeOrigin: true,
    pathRewrite: { '^/oauth': '/o/oauth2' },
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader('Origin', 'https://accounts.google.com')
    },
    onProxyRes: applyCors,
  }))

  srv.use('/token', createProxyMiddleware({
    target: 'https://www.googleapis.com',
    changeOrigin: true,
    pathRewrite: { '^/token': '/oauth2/v4/token' },
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader('Origin', 'https://www.googleapis.com')
    },
    onProxyRes: applyCors,
  }))

  srv.use('/stream-proxy', (req, res) => {
    const parsed = new URL(req.url || '', 'http://localhost')
    const targetUrl = parsed.searchParams.get('url')
    if (!targetUrl) {
      res.writeHead(400)
      res.end('Missing url parameter')
      return
    }

    const url = new URL(targetUrl)
    const mod = url.protocol === 'https:' ? https : http

    const upstreamHeaders = {
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
    }
    if (req.headers['range']) {
      upstreamHeaders['Range'] = req.headers['range']
    }

    const proxyReq = mod.request(targetUrl, {
      method: req.method || 'GET',
      headers: upstreamHeaders,
      timeout: 15000,
    }, (proxyRes) => {
      const responseHeaders = {
        'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      }
      if (proxyRes.headers['content-length']) {
        responseHeaders['Content-Length'] = proxyRes.headers['content-length']
      }
      if (proxyRes.headers['content-range']) {
        responseHeaders['Content-Range'] = proxyRes.headers['content-range']
      }
      if (proxyRes.headers['accept-ranges']) {
        responseHeaders['Accept-Ranges'] = proxyRes.headers['accept-ranges']
      }
      res.writeHead(proxyRes.statusCode || 200, responseHeaders)
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (err) => {
      console.error('Stream proxy error:', err.message)
      if (!res.headersSent) {
        res.writeHead(502)
        res.end('Proxy error')
      }
    })

    proxyReq.on('timeout', () => {
      proxyReq.destroy()
      if (!res.headersSent) {
        res.writeHead(504)
        res.end('Upstream timeout')
      }
    })

    proxyReq.end()
  })

  const distPath = join(__dirname, '..', 'dist')
  srv.use(express.static(distPath))
  srv.get('*', (req, res) => {
    res.sendFile('index.html', { root: distPath })
  })

  return new Promise((resolve, reject) => {
    const httpServer = createServer(srv)
    proxyServer = httpServer

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('[Server] Port 19384 in use, retrying with random port...')
        httpServer.listen(0, '127.0.0.1')
      } else {
        reject(err)
      }
    })

    httpServer.on('listening', () => {
      const { port } = httpServer.address()
      const url = `http://127.0.0.1:${port}`
      console.log(`[Server] Listening on ${url}`)
      resolve(url)
    })

    httpServer.listen(19384, '127.0.0.1')
  })
}

async function createWindow() {
  let url
  if (isDev) {
    url = process.env.VITE_DEV_SERVER_URL
  } else {
    try {
      const serverReady = createProxiedServer()
      let timeoutId
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Server startup timed out after 10s')), 10_000)
      })
      url = await Promise.race([serverReady, timeout])
      clearTimeout(timeoutId)
    } catch (err) {
      console.error('[Server] Failed to start:', err?.message)
      dialog.showErrorBox('DeckTube - Startup Error', `Could not start local server:\n${err?.message}`)
      app.quit()
      return
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    fullscreen: !isDev,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.loadURL(url)

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Window] Page failed to load: ${errorCode} ${errorDescription}`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Window] Renderer crashed: ${details.reason}`)
  })
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    logToFile(`[Renderer:${level}] ${message}`)
    if (level >= 2) console.error(`[Renderer] ${message}`)
  })

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentOrigin = new URL(url).origin
    const targetOrigin = new URL(navigationUrl).origin
    if (targetOrigin !== currentOrigin) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      logToFile('Window blurred')
      mainWindow.webContents.send('window-focus', false)
    }
  })
  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      logToFile('Window focused')
      mainWindow.webContents.send('window-focus', true)
    }
  })
}

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', payload)
  }
}

async function initAutoUpdater() {
  if (isDev) return

  console.log('[Updater] Diagnostics:', {
    APPIMAGE: process.env.APPIMAGE ?? 'unset',
    exePath: app.getPath('exe'),
    isPackaged: app.isPackaged,
  })

  let autoUpdater
  try {
    const mod = await import('electron-updater')
    autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater
    if (!autoUpdater) {
      console.error('[Updater] autoUpdater is undefined after import')
      return
    }
  } catch (err) {
    console.error('[Updater] Failed to load electron-updater:', err?.message)
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = console

  console.log('[Updater] Checking for updates...')

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version)
    sendUpdateStatus({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No update available')
    sendUpdateStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      status: 'downloading',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ status: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err?.message)
    sendUpdateStatus({ status: 'error', message: err?.message })
  })

  ipcMain.handle('update-download', () => autoUpdater.downloadUpdate())
  ipcMain.handle('update-install', async () => {
    const installerPath = autoUpdater.downloadedUpdateHelper?.file ?? null

    // electron-updater's AppImage doInstall unlinks the running AppImage
    // BEFORE checking the source exists. If the cached file is gone, mv fails
    // and we're left with no AppImage on disk. Bail out early.
    if (!installerPath || !existsSync(installerPath)) {
      console.error('[Updater] Install aborted: pending file missing', { installerPath })
      sendUpdateStatus({
        status: 'error',
        message: 'Update file is missing. Please download again.',
      })
      autoUpdater.checkForUpdates().catch(() => {})
      return
    }

    try {
      if (statSync(installerPath).size === 0) {
        console.error('[Updater] Install aborted: pending file empty', { installerPath })
        sendUpdateStatus({
          status: 'error',
          message: 'Update file is empty. Please download again.',
        })
        autoUpdater.checkForUpdates().catch(() => {})
        return
      }
    } catch (e) {
      console.error('[Updater] Install aborted: stat failed', { installerPath, err: e?.message })
      sendUpdateStatus({
        status: 'error',
        message: 'Update file is unreadable. Please download again.',
      })
      return
    }

    if (proxyServer) {
      await new Promise(resolve => proxyServer.close(resolve))
    }
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('open-releases-page', () =>
    shell.openExternal('https://github.com/mp-pinheiro/decktube/releases/latest')
  )

  autoUpdater.checkForUpdates().catch((e) => {
    console.error('[Updater] Check failed:', e?.message)
    sendUpdateStatus({ status: 'error', message: e?.message ?? 'Failed to check for updates' })
  })
}

ipcMain.handle('app-exit', () => {
  logToFile('App exit requested')
  // Don't wait on proxyServer.close — keep-alive connections can hang it indefinitely.
  // The OS will reclaim the socket when the process exits.
  app.exit(0)
})

// Steam overlay / QAM detection. The session compositor (gamescope) publishes, on its root window,
// the appID with input focus (GAMESCOPE_FOCUSED_APP) and the base-game appID (GAMESCOPE_FOCUSED_APP_GFX).
// They match while DeckTube has focus; when the overlay/QAM takes input focus they differ (overlay =
// Steam UI appID, or absent for appID 0). We poll the session display and tell the renderer to suppress
// controller input while the overlay is up — otherwise a raw (Steam-unvirtualized) controller keeps
// emitting and leaks into the app behind the overlay. The app's own DISPLAY is a nested Xwayland, so we
// auto-detect the session display (the one exposing GAMESCOPE_FOCUSED_APP_GFX).
let overlayProbeTimer = null
let overlayDisplay = null
let overlayActive = false

function readRootAtom(out, atom) {
  const line = out.split('\n').find(l => l.startsWith(atom))
  if (!line || line.indexOf('=') === -1) return null
  return line.slice(line.indexOf('=') + 1).trim()
}

async function detectOverlayDisplay() {
  for (const d of [':0', ':1', ':2']) {
    try {
      const out = await execFileAsync('xprop', ['-display', d, '-root', '-notype', 'GAMESCOPE_FOCUSED_APP_GFX'], { encoding: 'utf8', timeout: 2000 })
      if (readRootAtom(out, 'GAMESCOPE_FOCUSED_APP_GFX') !== null) return d
    } catch {}
  }
  return null
}

function setOverlayActive(active) {
  if (active === overlayActive) return
  overlayActive = active
  logToFile(`[Overlay] ${active ? 'open — suppressing controller input' : 'closed'}`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay-state', active)
  }
}

async function startOverlayProbe() {
  if (overlayProbeTimer) return
  overlayDisplay = await detectOverlayDisplay()
  if (!overlayDisplay) {
    logToFile('[Overlay] no gamescope session display found — overlay suppression disabled')
    return
  }
  logToFile(`[Overlay] watching display ${overlayDisplay}`)
  overlayProbeTimer = setInterval(async () => {
    try {
      const out = await execFileAsync('xprop', ['-display', overlayDisplay, '-root', '-notype', 'GAMESCOPE_FOCUSED_APP', 'GAMESCOPE_FOCUSED_APP_GFX'], { encoding: 'utf8', timeout: 2000 })
      const app = readRootAtom(out, 'GAMESCOPE_FOCUSED_APP')
      const gfx = readRootAtom(out, 'GAMESCOPE_FOCUSED_APP_GFX')
      // Fail open: only suppress when the base game is readable and something else holds input focus.
      if (gfx === null) setOverlayActive(false)
      else setOverlayActive(app === null || app !== gfx)
    } catch {
      setOverlayActive(false)
    }
  }, 300)
}

function registerMediaKeys() {
  const send = (action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('media-key', action)
    }
  }
  const ok1 = globalShortcut.register('MediaPlayPause', () => send('play-pause'))
  const ok2 = globalShortcut.register('MediaNextTrack', () => send('next'))
  const ok3 = globalShortcut.register('MediaPreviousTrack', () => send('prev'))
  logToFile(`[GlobalShortcut] register MediaPlayPause=${ok1} MediaNextTrack=${ok2} MediaPreviousTrack=${ok3}`)
}

app.whenReady().then(async () => {
  console.log(`[Log] Writing to ${logPath}`)
  logToFile('App ready')
  await createWindow()
  registerMediaKeys()
  startOverlayProbe()
  initAutoUpdater()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (overlayProbeTimer) { clearInterval(overlayProbeTimer); overlayProbeTimer = null }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

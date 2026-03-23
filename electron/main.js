import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'

import { createServer } from 'http'
import https from 'https'
import http from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env.VITE_DEV_SERVER_URL

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

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Window] Page loaded')
  })
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Window] Page failed to load: ${errorCode} ${errorDescription}`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Window] Renderer crashed: ${details.reason}`)
  })
  mainWindow.webContents.on('console-message', (_event, level, message) => {
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

app.whenReady().then(async () => {
  await createWindow()
  initAutoUpdater()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

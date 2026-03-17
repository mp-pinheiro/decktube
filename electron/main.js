import { app, BrowserWindow } from 'electron'

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

  return new Promise((resolve) => {
    const httpServer = createServer(srv)
    httpServer.listen(19384, '127.0.0.1', () => {
      const { port } = httpServer.address()
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

async function createWindow() {
  const url = isDev
    ? process.env.VITE_DEV_SERVER_URL
    : await createProxiedServer()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    fullscreen: !isDev,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(url)

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentOrigin = new URL(url).origin
    const targetOrigin = new URL(navigationUrl).origin
    if (targetOrigin !== currentOrigin) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

app.whenReady().then(async () => {
  await createWindow()
  if (!isDev) {
    try {
      const { autoUpdater } = await import('electron-updater')
      autoUpdater.checkForUpdatesAndNotify().catch(() => {})
    } catch {
      // updater unavailable, continue
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

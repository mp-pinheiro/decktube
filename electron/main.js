import { app, BrowserWindow } from 'electron'
import { createServer } from 'http'
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
      proxyReq.setHeader('Origin', 'https://www.youtube.com')
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

  const distPath = join(__dirname, '..', 'dist')
  srv.use(express.static(distPath))
  srv.get('*', (req, res) => {
    res.sendFile('index.html', { root: distPath })
  })

  return new Promise((resolve) => {
    const httpServer = createServer(srv)
    httpServer.listen(0, '127.0.0.1', () => {
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
}

app.whenReady().then(async () => {
  createWindow()
  if (!isDev) {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.checkForUpdatesAndNotify()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

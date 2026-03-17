import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'
import https from 'https'
import http from 'http'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'stream-proxy',
      configureServer(server) {
        server.middlewares.use('/stream-proxy', (req: IncomingMessage, res: ServerResponse) => {
          const parsed = new URL(req.url || '', 'http://localhost')
          const targetUrl = parsed.searchParams.get('url')
          if (!targetUrl) {
            res.writeHead(400)
            res.end('Missing url parameter')
            return
          }

          const url = new URL(targetUrl)
          const mod = url.protocol === 'https:' ? https : http

          const upstreamHeaders: Record<string, string> = {
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com/',
          }
          if (req.headers['range']) {
            upstreamHeaders['Range'] = req.headers['range'] as string
          }

          const proxyReq = mod.request(targetUrl, {
            method: req.method || 'GET',
            headers: upstreamHeaders,
          }, (proxyRes: IncomingMessage) => {
            const responseHeaders: Record<string, string> = {
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

          proxyReq.on('error', (err: Error) => {
            console.error('Stream proxy error:', err.message)
            if (!res.headersSent) {
              res.writeHead(502)
              res.end('Proxy error')
            }
          })

          proxyReq.end()
        })
      },
    },
  ],
  server: {
    proxy: {
      '/youtubei': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
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
          })
          proxy.on('error', (err) => {
            console.error('YouTube API proxy error:', err.message)
          })
        },
      },
      '/oauth': {
        target: 'https://accounts.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/oauth/, '/o/oauth2'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'https://accounts.google.com')
          })
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
          })
          proxy.on('error', (err) => {
            console.error('OAuth proxy error:', err.message)
          })
        },
      },
      '/token': {
        target: 'https://www.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/token/, '/oauth2/v4/token'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'https://www.googleapis.com')
          })
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
          })
          proxy.on('error', (err) => {
            console.error('Token proxy error:', err.message)
          })
        },
      },
    },
  },
})

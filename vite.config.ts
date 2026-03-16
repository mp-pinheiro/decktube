import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
            proxyReq.setHeader('Origin', 'https://www.youtube.com')
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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'YT Deck',
        short_name: 'YTDeck',
        description: 'YouTube for Steam Deck',
        theme_color: '#09090b',
        start_url: '/',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
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

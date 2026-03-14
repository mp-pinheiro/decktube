import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

const youtubeProxy = createProxyMiddleware({
  target: 'https://www.youtube.com',
  changeOrigin: true,
  pathRewrite: {
    '^/youtubei/v1': '/youtubei/v1',
  },
  onProxyReq: (proxyReq, req) => {
    if (req.headers['authorization']) {
      proxyReq.setHeader('Authorization', req.headers['authorization'])
    }
    proxyReq.setHeader('Origin', 'https://www.youtube.com')
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*'
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message)
    res.status(500).json({ error: 'Proxy error', message: err.message })
  },
})

app.use('/youtubei', youtubeProxy)

app.use(express.static('dist'))

app.get('*', (req, res) => {
  res.sendFile('dist/index.html', { root: '.' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

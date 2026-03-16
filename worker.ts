interface Env {
  ASSETS: Fetcher
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/youtubei')) {
      return proxy(request, `https://www.youtube.com${url.pathname}${url.search}`, 'https://www.youtube.com')
    }

    if (url.pathname.startsWith('/oauth')) {
      // Rewrite /oauth/* -> /o/oauth2/*
      const rewritten = url.pathname.replace(/^\/oauth/, '/o/oauth2')
      return proxy(request, `https://accounts.google.com${rewritten}${url.search}`, 'https://accounts.google.com')
    }

    if (url.pathname === '/token') {
      return proxy(request, 'https://www.googleapis.com/oauth2/v4/token', 'https://www.googleapis.com')
    }

    const response = await env.ASSETS.fetch(request)

    const filename = url.pathname.split('/').pop() ?? ''
    if (filename === 'sw.js' || filename.startsWith('workbox-')) {
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      return new Response(response.body, { status: response.status, headers })
    }

    return response
  },
}

async function proxy(request: Request, target: string, origin: string): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const headers = new Headers(request.headers)
  headers.set('Origin', origin)
  headers.delete('host')

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })

  const responseHeaders = new Headers(upstream.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    responseHeaders.set(key, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  // Rewrite /oauth/* -> /o/oauth2/*
  const rewrittenPath = url.pathname.replace(/^\/oauth/, '/o/oauth2')
  const targetUrl = `https://accounts.google.com${rewrittenPath}${url.search}`

  const headers = new Headers(request.headers)
  headers.set('Origin', 'https://accounts.google.com')
  headers.delete('host')

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })

  const responseHeaders = new Headers(upstream.headers)
  for (const [key, value] of Object.entries(corsHeaders())) {
    responseHeaders.set(key, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

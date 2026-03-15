export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  const targetUrl = 'https://www.googleapis.com/oauth2/v4/token'

  const headers = new Headers(request.headers)
  headers.set('Origin', 'https://www.googleapis.com')
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

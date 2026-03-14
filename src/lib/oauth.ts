const OAUTH_CONFIG = {
  clientId: import.meta.env.VITE_YOUTUBE_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_YOUTUBE_CLIENT_SECRET || '',
  scope: 'http://gdata.youtube.com https://www.googleapis.com/auth/youtube',
  deviceCodeUrl: '/oauth/device/code',
  tokenUrl: '/token',
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'yt_access_token',
  REFRESH_TOKEN: 'yt_refresh_token',
  TOKEN_EXPIRES_AT: 'yt_token_expires_at',
  DEVICE_CODE: 'yt_device_code',
  USER_CODE: 'yt_user_code',
  VERIFICATION_URL: 'yt_verification_url',
  EXPIRES_IN: 'yt_device_expires_in',
  INTERVAL: 'yt_device_interval',
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  expires_in: number
  interval: number
  verification_url: string
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export interface AuthState {
  userCode: string
  verificationUrl: string
  expiresIn: number
}

export async function getDeviceCode(): Promise<AuthState> {
  if (!OAUTH_CONFIG.clientId) {
    throw new Error('YouTube Client ID not configured. Set VITE_YOUTUBE_CLIENT_ID in .env')
  }

  const response = await fetch(OAUTH_CONFIG.deviceCodeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      scope: OAUTH_CONFIG.scope,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get device code: ${response.statusText}`)
  }

  const data: DeviceCodeResponse = await response.json()

  localStorage.setItem(STORAGE_KEYS.DEVICE_CODE, data.device_code)
  localStorage.setItem(STORAGE_KEYS.USER_CODE, data.user_code)
  localStorage.setItem(STORAGE_KEYS.VERIFICATION_URL, data.verification_url)
  localStorage.setItem(STORAGE_KEYS.EXPIRES_IN, data.expires_in.toString())
  localStorage.setItem(STORAGE_KEYS.INTERVAL, data.interval.toString())

  return {
    userCode: data.user_code,
    verificationUrl: data.verification_url,
    expiresIn: data.expires_in,
  }
}

export async function pollForToken(
  onTokenReceived: (token: string) => void,
  onError: (error: string) => void,
  onCancel: () => boolean
): Promise<void> {
  const deviceCode = localStorage.getItem(STORAGE_KEYS.DEVICE_CODE)
  const intervalStr = localStorage.getItem(STORAGE_KEYS.INTERVAL)
  const interval = intervalStr ? parseInt(intervalStr, 10) * 1000 : 5000

  if (!deviceCode) {
    onError('Device code not found. Please try signing in again.')
    return
  }

  const poll = async (): Promise<void> => {
    if (onCancel()) {
      return
    }

    try {
      const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: OAUTH_CONFIG.clientId,
          client_secret: OAUTH_CONFIG.clientSecret,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
        }),
      })

      const data = await response.json()

      if (response.ok && data.access_token) {
        storeToken(data as TokenResponse)
        onTokenReceived(data.access_token)
        clearDeviceCode()
      } else if (data.error === 'authorization_pending') {
        setTimeout(poll, interval)
      } else if (data.error === 'slow_down') {
        setTimeout(poll, interval * 2)
      } else if (data.error === 'expired_token') {
        clearDeviceCode()
        onError('Authorization expired. Please try again.')
      } else if (data.error === 'access_denied') {
        clearDeviceCode()
        onError('Access denied. Please try again.')
      } else {
        clearDeviceCode()
        onError(`Authorization failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      clearDeviceCode()
      onError(err instanceof Error ? err.message : 'Network error during authorization')
    }
  }

  poll()
}

function storeToken(data: TokenResponse): void {
  const expiresAt = Date.now() + data.expires_in * 1000
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token)
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token)
  }
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString())
}

function clearDeviceCode(): void {
  localStorage.removeItem(STORAGE_KEYS.DEVICE_CODE)
  localStorage.removeItem(STORAGE_KEYS.USER_CODE)
  localStorage.removeItem(STORAGE_KEYS.VERIFICATION_URL)
  localStorage.removeItem(STORAGE_KEYS.EXPIRES_IN)
  localStorage.removeItem(STORAGE_KEYS.INTERVAL)
}

export async function getToken(): Promise<string | null> {
  let accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  const expiresAtStr = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT)

  if (accessToken && expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() >= expiresAt - 60000) {
      accessToken = await refreshAccessToken()
    }
  }

  return accessToken
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)

  if (!refreshToken || !OAUTH_CONFIG.clientId) {
    return null
  }

  try {
    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      logout()
      return null
    }

    const data: TokenResponse = await response.json()
    storeToken(data)
    return data.access_token
  } catch {
    logout()
    return null
  }
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT)
  clearDeviceCode()
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
}

declare module 'simple-keyboard-key-navigation'

interface UpdateStatusPayload {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  message?: string
}

interface ElectronAPI {
  onWindowFocusChange: (callback: (focused: boolean) => void) => () => void
  onUpdateStatus: (callback: (payload: UpdateStatusPayload) => void) => () => void
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
}

declare global {
  const __APP_VERSION__: string
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}

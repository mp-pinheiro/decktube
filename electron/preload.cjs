const { contextBridge, ipcRenderer } = require('electron')

let lastUpdatePayload = null
ipcRenderer.on('update-status', (_event, payload) => {
  lastUpdatePayload = payload
})

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateStatus: (callback) => {
    if (lastUpdatePayload) {
      callback(lastUpdatePayload)
    }
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  openReleasesPage: () => ipcRenderer.invoke('open-releases-page'),
  restartApp: () => ipcRenderer.invoke('app-restart'),
  onWindowFocus: (callback) => {
    const listener = (_event, focused) => callback(focused)
    ipcRenderer.on('window-focus', listener)
    return () => ipcRenderer.removeListener('window-focus', listener)
  },
  onSystemGamepads: (callback) => {
    const listener = (_event, detected) => callback(detected)
    ipcRenderer.on('system-gamepads-detected', listener)
    return () => ipcRenderer.removeListener('system-gamepads-detected', listener)
  },
  reportXboxDropout: () => ipcRenderer.send('xbox-virtual-dropout'),
  reportSteamConnected: () => ipcRenderer.send('steam-controller-connected'),
  onReconnectPrompt: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('reconnect-prompt', listener)
    return () => ipcRenderer.removeListener('reconnect-prompt', listener)
  },
})

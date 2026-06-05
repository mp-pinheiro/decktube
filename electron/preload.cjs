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
  exitApp: () => ipcRenderer.invoke('app-exit'),
  onWindowFocus: (callback) => {
    const listener = (_event, focused) => callback(focused)
    ipcRenderer.on('window-focus', listener)
    return () => ipcRenderer.removeListener('window-focus', listener)
  },
  onOverlayState: (callback) => {
    const listener = (_event, active) => callback(active)
    ipcRenderer.on('overlay-state', listener)
    return () => ipcRenderer.removeListener('overlay-state', listener)
  },
  onMediaKey: (callback) => {
    const listener = (_event, action) => callback(action)
    ipcRenderer.on('media-key', listener)
    return () => ipcRenderer.removeListener('media-key', listener)
  },
})

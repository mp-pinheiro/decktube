const { contextBridge, ipcRenderer } = require('electron')

let lastUpdatePayload = null
ipcRenderer.on('update-status', (_event, payload) => {
  lastUpdatePayload = payload
})

contextBridge.exposeInMainWorld('electronAPI', {
  onWindowFocusChange: (callback) => {
    const listener = (_event, focused) => callback(focused)
    ipcRenderer.on('window-focus-change', listener)
    return () => ipcRenderer.removeListener('window-focus-change', listener)
  },
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
})

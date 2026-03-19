const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onWindowFocusChange: (callback) => {
    const listener = (_event, focused) => callback(focused)
    ipcRenderer.on('window-focus-change', listener)
    return () => ipcRenderer.removeListener('window-focus-change', listener)
  },
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
})

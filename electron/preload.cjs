const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onWindowFocusChange: (callback) => {
    const handler = (_event, focused) => callback(focused)
    ipcRenderer.on('window-focus-change', handler)
    return () => ipcRenderer.removeListener('window-focus-change', handler)
  },
})

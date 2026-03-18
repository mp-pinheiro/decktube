const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onWindowFocusChange: (callback) => {
    const listener = (_event, focused) => callback(focused)
    ipcRenderer.on('window-focus-change', listener)
    return () => ipcRenderer.removeListener('window-focus-change', listener)
  },
})

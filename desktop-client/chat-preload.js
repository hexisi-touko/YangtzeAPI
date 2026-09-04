const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chatWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
})

contextBridge.exposeInMainWorld('chatContext', {
  getConfig: () => ipcRenderer.invoke('chat:get-config'),
})

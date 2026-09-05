const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
})

contextBridge.exposeInMainWorld('desktopTools', {
  getState: () => ipcRenderer.invoke('desktop-tools:get-state'),
  refresh: () => ipcRenderer.invoke('desktop-tools:refresh'),
  getModels: (toolId) => ipcRenderer.invoke('desktop-tools:get-models', toolId),
  applyModels: (toolId, selection) => ipcRenderer.invoke('desktop-tools:apply-models', toolId, selection),
  enable: (toolId) => ipcRenderer.invoke('desktop-tools:enable', toolId),
  disable: (toolId) => ipcRenderer.invoke('desktop-tools:disable', toolId),
  launch: (toolId) => ipcRenderer.invoke('desktop-tools:launch', toolId),
  ping: () => ipcRenderer.invoke('desktop-tools:ping'),
  openDashboard: () => ipcRenderer.invoke('desktop-tools:open-dashboard'),
  logout: () => ipcRenderer.invoke('desktop-tools:logout'),
})

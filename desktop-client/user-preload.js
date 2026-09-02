const { contextBridge, ipcRenderer } = require('electron')

// 远程成员页面只能调用这三个固定动作，不能访问 Node、文件系统或任意 IPC。
contextBridge.exposeInMainWorld('yangtzeDesktop', {
  getCodexStatus: () => ipcRenderer.invoke('codex:status'),
  configureCodex: () => ipcRenderer.invoke('codex:configure'),
  detectCodex: () => ipcRenderer.invoke('codex:detect'),
})

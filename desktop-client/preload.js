const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
})

// 只暴露固定认证动作，不向本地页面提供通用 IPC、网络、文件或 Shell 能力。
contextBridge.exposeInMainWorld('desktopAuth', {
  getStatus: () => ipcRenderer.invoke('auth:status'),
  getSavedCredentials: () => ipcRenderer.invoke('auth:get-saved-credentials'),
  clearSavedCredentials: () => ipcRenderer.invoke('auth:clear-saved-credentials'),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  verifyTwoFactor: (code) => ipcRenderer.invoke('auth:verify-2fa', code),
  submitRegistrationApplication: (application) =>
    ipcRenderer.invoke('auth:submit-registration-application', application),
  getRegistrationApplicationStatus: () => ipcRenderer.invoke('auth:registration-application-status'),
  submitPasswordResetApplication: (application) =>
    ipcRenderer.invoke('auth:submit-password-reset-application', application),
  getPasswordResetState: () => ipcRenderer.invoke('auth:get-password-reset-state'),
  getPasswordResetStatus: () => ipcRenderer.invoke('auth:password-reset-status'),
  completePasswordReset: (newPassword) => ipcRenderer.invoke('auth:complete-password-reset', newPassword),
})

const { app, BrowserWindow, ipcMain, safeStorage, session, shell } = require('electron')
const path = require('node:path')
const { loadDesktopConfig, logoPathForLoginPage } = require('./src/config')
const { NewApiClient, NewApiClientError } = require('./src/new-api-client')
const { PasswordResetStore } = require('./src/password-reset-store')
const { CodexConfigError, CodexConfigManager } = require('./src/codex-config-manager')

const desktopConfig = loadDesktopConfig()
const LOGIN_WINDOW_WIDTH = 420
const LOGIN_WINDOW_HEIGHT = 620
const USER_SESSION_PARTITION = 'persist:new-api-user'

let loginWindow = null
let userWindow = null
let apiSession = null
let apiClient = null
let passwordResetStore = null
let pendingTwoFactor = null
let codexConfigManager = null

app.enableSandbox()
app.setAppUserModelId('com.apirelay.desktop')

function isLoginPage(event) {
  try {
    const sender = new URL(event.senderFrame.url)
    return sender.protocol === 'file:' && path.basename(sender.pathname) === 'login.html'
  } catch {
    return false
  }
}

function requireLoginPage(event) {
  if (!isLoginPage(event)) throw new Error('Unauthorized window request')
}

function requireClientPortal(event) {
  if (event.senderFrame !== event.sender.mainFrame) throw new Error('Unauthorized window request')
  let sender
  try {
    sender = new URL(event.senderFrame.url)
  } catch {
    throw new Error('Unauthorized window request')
  }
  if (sender.origin !== desktopConfig.serverUrl || !/^\/client\/?$/.test(sender.pathname)) {
    throw new Error('Unauthorized window request')
  }
}

function publicError(error, fallback) {
  if (error instanceof NewApiClientError) {
    return { success: false, message: error.message, code: error.code }
  }
  return { success: false, message: fallback, code: 'CLIENT_ERROR' }
}

function publicCodexError(error, fallback) {
  if (error instanceof NewApiClientError || error instanceof CodexConfigError) {
    return { success: false, message: error.message, code: error.code }
  }
  return { success: false, message: fallback, code: 'CLIENT_ERROR' }
}

function isServerUrl(candidate) {
  try {
    return new URL(candidate).origin === desktopConfig.serverUrl
  } catch {
    return false
  }
}

function isSafeExternalUrl(candidate) {
  try {
    return new URL(candidate).protocol === 'https:'
  } catch {
    return false
  }
}

function showLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.show()
    loginWindow.focus()
    return
  }
  void createLoginWindow()
}

function returnToLoginFromUserWindow() {
  if (userWindow && !userWindow.isDestroyed()) userWindow.destroy()
  userWindow = null
  showLoginWindow()
}

function attachUserWindowGuards(window) {
  const guardNavigation = (event, targetUrl) => {
    if (isServerUrl(targetUrl)) return
    event.preventDefault()
    if (isSafeExternalUrl(targetUrl)) void shell.openExternal(targetUrl)
  }

  window.webContents.on('will-navigate', guardNavigation)
  window.webContents.on('will-redirect', guardNavigation)
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isServerUrl(url)) setImmediate(() => window.loadURL(url))
    else if (isSafeExternalUrl(url)) setImmediate(() => void shell.openExternal(url))
    return { action: 'deny' }
  })

  const checkForSignedOutPage = (_event, currentUrl) => {
    if (!isServerUrl(currentUrl)) return
    const pathname = new URL(currentUrl).pathname
    if (pathname === '/sign-in' || pathname === '/login') returnToLoginFromUserWindow()
  }
  window.webContents.on('did-navigate', checkForSignedOutPage)
  window.webContents.on('did-navigate-in-page', checkForSignedOutPage)
}

async function openUserWindow() {
  if (userWindow && !userWindow.isDestroyed()) {
    userWindow.show()
    userWindow.focus()
    return
  }

  userWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: desktopConfig.productName,
    webPreferences: {
      preload: path.join(__dirname, 'user-preload.js'),
      session: apiSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  })
  attachUserWindowGuards(userWindow)
  userWindow.once('ready-to-show', () => userWindow?.show())
  userWindow.on('closed', () => { userWindow = null })

  try {
    await userWindow.loadURL(new URL(desktopConfig.userPagePath, desktopConfig.serverUrl).toString())
  } catch {
    if (userWindow && !userWindow.isDestroyed()) userWindow.destroy()
    userWindow = null
    throw new NewApiClientError('用户页面加载失败，请检查服务器状态', { code: 'PAGE_LOAD_ERROR' })
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    const completedLoginWindow = loginWindow
    completedLoginWindow.hide()
    setTimeout(() => {
      if (!completedLoginWindow.isDestroyed()) completedLoginWindow.close()
    }, 100)
  }
}

async function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: LOGIN_WINDOW_WIDTH,
    height: LOGIN_WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    frame: false,
    show: false,
    backgroundColor: '#ffffff',
    title: desktopConfig.productName,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      session: apiSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      navigateOnDragDrop: false,
      disableHtmlFullscreenWindowResize: true,
    },
  })
  loginWindow.setContentSize(LOGIN_WINDOW_WIDTH, LOGIN_WINDOW_HEIGHT)

  await loginWindow.loadFile(path.join(__dirname, 'ui', 'login.html'), {
    query: {
      productName: desktopConfig.productName,
      logoPath: logoPathForLoginPage(desktopConfig),
    },
  })
  loginWindow.show()
  loginWindow.on('closed', () => { loginWindow = null })
}

function registerIpcHandlers() {
  ipcMain.on('window:minimize', (event) => {
    requireLoginPage(event)
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:close', (event) => {
    requireLoginPage(event)
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('auth:status', async (event) => {
    requireLoginPage(event)
    try {
      return await apiClient.getStatus()
    } catch (error) {
      return publicError(error, '无法读取服务器状态')
    }
  })

  ipcMain.handle('auth:login', async (event, credentials) => {
    requireLoginPage(event)
    pendingTwoFactor = null
    try {
      const result = await apiClient.login(credentials || {})
      if (result.requiresTwoFactor) {
        pendingTwoFactor = { flowToken: result.flowToken, expiresAt: result.expiresAt }
        return { success: true, requiresTwoFactor: true, message: result.message }
      }
      await openUserWindow()
      return { success: true, authenticated: true, message: result.message }
    } catch (error) {
      return publicError(error, '登录失败')
    }
  })

  ipcMain.handle('auth:verify-2fa', async (event, code) => {
    requireLoginPage(event)
    if (!pendingTwoFactor) return { success: false, message: '两步验证流程已失效，请重新登录' }
    if (pendingTwoFactor.expiresAt && Date.now() / 1000 >= pendingTwoFactor.expiresAt) {
      pendingTwoFactor = null
      return { success: false, message: '两步验证码已过期，请重新登录' }
    }
    try {
      const result = await apiClient.verifyTwoFactor({ code, flowToken: pendingTwoFactor.flowToken })
      pendingTwoFactor = null
      await openUserWindow()
      return { success: true, authenticated: true, message: result.message }
    } catch (error) {
      return publicError(error, '两步验证失败')
    }
  })

  ipcMain.handle('auth:submit-registration-application', async (event, application) => {
    requireLoginPage(event)
    try {
      return await apiClient.submitRegistrationApplication(application || {})
    } catch (error) {
      return publicError(error, '提交申请失败')
    }
  })

  ipcMain.handle('auth:submit-password-reset-application', async (event, application) => {
    requireLoginPage(event)
    if (!passwordResetStore.encryptionAvailable()) {
      return { success: false, message: 'Windows 安全存储当前不可用，无法安全保存找回密码申请' }
    }
    try {
      const result = await apiClient.submitPasswordResetApplication(application || {})
      passwordResetStore.save({
        applicationId: result.applicationId,
        secret: result.applicationSecret,
        username: result.username,
      })
      return {
        success: true,
        message: result.message,
        applicationId: result.applicationId,
        status: 'pending',
      }
    } catch (error) {
      return publicError(error, '提交找回密码申请失败')
    }
  })

  ipcMain.handle('auth:get-password-reset-state', (event) => {
    requireLoginPage(event)
    const tracking = passwordResetStore.load()
    return {
      success: true,
      hasApplication: tracking !== null,
      username: tracking?.username || '',
    }
  })

  ipcMain.handle('auth:password-reset-status', async (event) => {
    requireLoginPage(event)
    const tracking = passwordResetStore.load()
    if (!tracking) return { success: false, message: '本机没有待处理的找回密码申请' }
    try {
      const result = await apiClient.getPasswordResetStatus({
        applicationId: tracking.applicationId,
        applicationSecret: tracking.secret,
      })
      if (result.status === 'rejected') passwordResetStore.clear()
      return { ...result, username: tracking.username || '' }
    } catch (error) {
      return publicError(error, '查询审核状态失败')
    }
  })

  ipcMain.handle('auth:complete-password-reset', async (event, newPassword) => {
    requireLoginPage(event)
    const tracking = passwordResetStore.load()
    if (!tracking) return { success: false, message: '找回密码申请已失效，请重新提交' }
    try {
      const result = await apiClient.completePasswordReset({
        applicationId: tracking.applicationId,
        applicationSecret: tracking.secret,
        newPassword,
      })
      passwordResetStore.clear()
      return result
    } catch (error) {
      return publicError(error, '重置密码失败')
    }
  })

  ipcMain.handle('codex:status', (event) => {
    requireClientPortal(event)
    try {
      return { ...codexConfigManager.inspect(), serviceReachable: null }
    } catch (error) {
      return publicCodexError(error, '无法读取 Codex 配置')
    }
  })

  ipcMain.handle('codex:configure', async (event) => {
    requireClientPortal(event)
    try {
      const apiKey = await apiClient.getApprovedApiKey()
      const result = codexConfigManager.configure(apiKey)
      const serviceReachable = await apiClient.validateApiKey(apiKey)
      return {
        ...result,
        serviceReachable,
        configured: result.configured && serviceReachable,
        message: serviceReachable
          ? result.ccSwitchDetected
            ? 'Codex 配置完成；已兼容保留 CC Switch 和原有配置，请重启 Codex 生效'
            : 'Codex 配置完成，原配置已保留并生成备份，请重启 Codex 生效'
          : '本地配置已写入，但 API 连通检测未通过',
      }
    } catch (error) {
      return publicCodexError(error, '配置 Codex 失败')
    }
  })

  ipcMain.handle('codex:detect', async (event) => {
    requireClientPortal(event)
    try {
      const apiKey = await apiClient.getApprovedApiKey()
      const result = codexConfigManager.inspect(apiKey)
      const serviceReachable = await apiClient.validateApiKey(apiKey)
      const configured = result.configured && serviceReachable
      return {
        ...result,
        serviceReachable,
        configured,
        message: configured
          ? 'Codex 配置和 API 连通性均正常'
          : result.externalProviderActive
            ? '当前 Codex 供应商已被 CC Switch 或其他工具切换，请重新配置'
            : '检测未通过，请重新配置或联系管理员检查服务',
      }
    } catch (error) {
      return publicCodexError(error, '检测 Codex 配置失败')
    }
  })
}

app.whenReady().then(async () => {
  apiSession = session.fromPartition(USER_SESSION_PARTITION, { cache: true })
  apiSession.setPermissionCheckHandler(() => false)
  apiSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  apiSession.on('will-download', (event) => event.preventDefault())
  apiClient = new NewApiClient({ config: desktopConfig, session: apiSession })
  passwordResetStore = new PasswordResetStore({
    filePath: path.join(app.getPath('userData'), 'password-reset-request.bin'),
    safeStorage,
  })
  codexConfigManager = new CodexConfigManager({
    codexHome: process.env.CODEX_HOME || path.join(app.getPath('home'), '.codex'),
    serverUrl: desktopConfig.serverUrl,
    providerName: desktopConfig.productName,
  })
  registerIpcHandlers()
  await createLoginWindow()
}).catch((error) => {
  console.error(error.message)
  app.quit()
})

app.on('activate', () => {
  if (userWindow && !userWindow.isDestroyed()) userWindow.show()
  else if (!loginWindow || loginWindow.isDestroyed()) showLoginWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

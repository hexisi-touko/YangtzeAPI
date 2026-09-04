const { app, BrowserWindow, ipcMain, safeStorage, session, shell } = require('electron')
const path = require('node:path')
const { loadDesktopConfig, logoPathForLoginPage } = require('./src/config')
const { NewApiClient, NewApiClientError } = require('./src/new-api-client')
const { PasswordResetStore } = require('./src/password-reset-store')
const { CredentialStore } = require('./src/credential-store')
const { ToolSyncManager } = require('./src/tool-sync/manager')
const { ClaudeAdapter } = require('./src/tool-sync/claude-adapter')
const { CodexAdapter } = require('./src/tool-sync/codex-adapter')
const { GeminiAdapter } = require('./src/tool-sync/gemini-adapter')
const { KimiAdapter } = require('./src/tool-sync/kimi-adapter')
const { launchTool } = require('./src/tool-sync/process-launcher')

const desktopConfig = loadDesktopConfig()
const LOGIN_WINDOW_WIDTH = 420
const LOGIN_WINDOW_HEIGHT = 620
const USER_SESSION_PARTITION = desktopConfig.sessionPartition

let loginWindow = null
let userWindow = null
let toolSwitcherWindow = null
let chatWindow = null
let activeChatToolConfig = null
let apiSession = null
let apiClient = null
let passwordResetStore = null
let credentialStore = null
let pendingTwoFactor = null
let pendingRegistration = null
let toolSyncManager = null
let currentAccount = null

app.enableSandbox()
if (desktopConfig.userDataDirectoryName) {
  app.setPath('userData', path.join(app.getPath('appData'), desktopConfig.userDataDirectoryName))
}
app.setAppUserModelId(desktopConfig.appId)

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

function isToolSwitcherPage(event) {
  try {
    const sender = new URL(event.senderFrame.url)
    return sender.protocol === 'file:' && path.basename(sender.pathname) === 'tool-switcher.html'
  } catch {
    return false
  }
}

function requireToolSwitcherPage(event) {
  if (!isToolSwitcherPage(event)) throw new Error('Unauthorized window request')
}

function publicError(error, fallback) {
  if (error instanceof NewApiClientError) {
    return { success: false, message: error.message, code: error.code }
  }
  return { success: false, message: fallback, code: 'CLIENT_ERROR' }
}

function updateSavedCredentials(credentials) {
  try {
    if (credentials?.rememberCredentials === true) {
      credentialStore.save({ username: credentials.username, password: credentials.password })
    } else {
      credentialStore.clear()
    }
  } catch {
    // 凭据存储失败不能阻止已通过验证的用户进入客户端。
  }
}

async function requireMemberAccount(result) {
  if (result.accountRole === 1) return
  await apiSession.clearStorageData({
    origin: desktopConfig.serverUrl,
    storages: ['cookies', 'localstorage'],
  })
  throw new NewApiClientError('管理员账号请使用 Web 管理后台登录', {
    code: 'DESKTOP_MEMBER_ONLY',
  })
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

function returnToLoginFromToolSwitcher() {
  if (toolSwitcherWindow && !toolSwitcherWindow.isDestroyed()) toolSwitcherWindow.destroy()
  toolSwitcherWindow = null
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
  return openToolSwitcherWindow()
}

async function openDashboardWindow() {
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

async function openToolSwitcherWindow() {
  if (toolSwitcherWindow && !toolSwitcherWindow.isDestroyed()) {
    toolSwitcherWindow.show()
    toolSwitcherWindow.focus()
    return
  }

  toolSwitcherWindow = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 840,
    minHeight: 580,
    center: true,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: `${desktopConfig.productName} - AI 终端管理`,
    webPreferences: {
      preload: path.join(__dirname, 'tool-switcher-preload.js'),
      session: apiSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  })
  toolSwitcherWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  toolSwitcherWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  toolSwitcherWindow.once('ready-to-show', () => toolSwitcherWindow?.show())
  toolSwitcherWindow.on('closed', () => { toolSwitcherWindow = null })

  try {
    await toolSwitcherWindow.loadFile(path.join(__dirname, 'ui', 'tool-switcher.html'))
  } catch {
    if (toolSwitcherWindow && !toolSwitcherWindow.isDestroyed()) toolSwitcherWindow.destroy()
    toolSwitcherWindow = null
    throw new NewApiClientError('工具配置页面加载失败', { code: 'PAGE_LOAD_ERROR' })
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    const completedLoginWindow = loginWindow
    completedLoginWindow.hide()
    setTimeout(() => {
      if (!completedLoginWindow.isDestroyed()) completedLoginWindow.close()
    }, 100)
  }
}

async function openChatWindow(toolConfig) {
  activeChatToolConfig = toolConfig
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show()
    chatWindow.focus()
    return
  }

  chatWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 740,
    minHeight: 520,
    center: true,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: `${desktopConfig.productName} - Kimi 智能助手`,
    webPreferences: {
      preload: path.join(__dirname, 'chat-preload.js'),
      session: apiSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  })

  chatWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  chatWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  chatWindow.once('ready-to-show', () => chatWindow?.show())
  chatWindow.on('closed', () => { chatWindow = null })

  try {
    await chatWindow.loadFile(path.join(__dirname, 'ui', 'chat.html'))
  } catch {
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy()
    chatWindow = null
    throw new NewApiClientError('Kimi 对话窗口加载失败', { code: 'PAGE_LOAD_ERROR' })
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
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('desktop-tools:get-state', async (event) => {
    requireToolSwitcherPage(event)
    try {
      const result = await apiClient.getDesktopTools()
      toolSyncManager.setServerConfigs(result.tools)
      const self = await apiClient.getSelf()
      return {
        success: true,
        tools: toolSyncManager.getState(),
        account: self || currentAccount,
        serverUrl: desktopConfig.serverUrl,
        productName: desktopConfig.productName,
      }
    } catch (error) {
      return publicError(error, '无法读取工具配置')
    }
  })

  ipcMain.handle('desktop-tools:refresh', async (event) => {
    requireToolSwitcherPage(event)
    try {
      const result = await apiClient.getDesktopTools()
      toolSyncManager.setServerConfigs(result.tools)
      const self = await apiClient.getSelf()
      return {
        success: true,
        tools: toolSyncManager.getState(),
        account: self || currentAccount,
        serverUrl: desktopConfig.serverUrl,
        productName: desktopConfig.productName,
      }
    } catch (error) {
      return publicError(error, '刷新工具配置失败')
    }
  })

  ipcMain.handle('desktop-tools:ping', async (event) => {
    requireToolSwitcherPage(event)
    const startTime = Date.now()
    try {
      await apiClient.getStatus()
      return { success: true, latencyMs: Date.now() - startTime }
    } catch (error) {
      return { success: false, message: '无法连接服务网关' }
    }
  })

  ipcMain.handle('desktop-tools:enable', async (event, toolId) => {
    requireToolSwitcherPage(event)
    try {
      const result = await apiClient.getDesktopTools()
      const config = result.tools.find((item) => item?.id === toolId)
      if (!config) return { success: false, message: '该工具尚未分配配置', code: 'TOOL_UNCONFIGURED' }
      const res = toolSyncManager.enable(toolId, config)
      if (toolId === 'kimi') {
        await openChatWindow(config)
      }
      return res
    } catch (error) {
      return publicError(error, '启用工具失败，未修改本地配置')
    }
  })

  ipcMain.handle('desktop-tools:disable', (event, toolId) => {
    requireToolSwitcherPage(event)
    try {
      if (toolId === 'kimi' && chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.close()
      }
      return toolSyncManager.disable(toolId)
    } catch (error) {
      return publicError(error, '禁用工具失败')
    }
  })

  ipcMain.handle('desktop-tools:launch', async (event, toolId) => {
    requireToolSwitcherPage(event)
    try {
      if (toolId === 'kimi') {
        const result = await apiClient.getDesktopTools()
        const config = result.tools.find((item) => item?.id === toolId)
        await openChatWindow(config)
        return {
          success: true,
          launched: true,
          message: '已打开 Kimi 智能助手对话窗口',
        }
      }
      const adapter = toolSyncManager.requireAdapter(toolId)
      const launch = adapter.launch()
      return {
        success: true,
        launched: launch?.launched === true,
        message: launch?.message || '',
      }
    } catch (error) {
      return publicError(error, '启动工具失败')
    }
  })

  ipcMain.handle('chat:get-config', () => {
    return {
      success: true,
      config: activeChatToolConfig,
      account: currentAccount,
      serverUrl: desktopConfig.serverUrl,
      productName: desktopConfig.productName,
    }
  })

  ipcMain.handle('desktop-tools:open-dashboard', async (event) => {
    requireToolSwitcherPage(event)
    try {
      await openDashboardWindow()
      return { success: true }
    } catch (error) { return publicError(error, '管理后台打开失败') }
  })

  ipcMain.handle('desktop-tools:logout', async (event) => {
    requireToolSwitcherPage(event)
    try {
      await apiSession.clearStorageData({ origin: desktopConfig.serverUrl })
      toolSyncManager.setServerConfigs([])
      currentAccount = null
      if (userWindow && !userWindow.isDestroyed()) userWindow.destroy()
      returnToLoginFromToolSwitcher()
      return { success: true }
    } catch (error) { return publicError(error, '退出登录失败') }
  })

  ipcMain.handle('auth:status', async (event) => {
    requireLoginPage(event)
    try {
      return await apiClient.getStatus()
    } catch (error) {
      return publicError(error, '无法读取服务器状态')
    }
  })

  ipcMain.handle('auth:get-saved-credentials', (event) => {
    requireLoginPage(event)
    const credentials = credentialStore.load()
    return { success: true, credentials }
  })

  ipcMain.handle('auth:clear-saved-credentials', (event) => {
    requireLoginPage(event)
    credentialStore.clear()
    return { success: true }
  })

  ipcMain.handle('auth:login', async (event, credentials) => {
    requireLoginPage(event)
    pendingTwoFactor = null
    try {
      const result = await apiClient.login(credentials || {})
      if (result.requiresTwoFactor) {
        pendingTwoFactor = {
          flowToken: result.flowToken,
          expiresAt: result.expiresAt,
          credentials: {
            username: credentials?.username,
            password: credentials?.password,
            rememberCredentials: credentials?.rememberCredentials === true,
          },
        }
        return { success: true, requiresTwoFactor: true, message: result.message }
      }
      await requireMemberAccount(result)
      updateSavedCredentials(credentials)
      currentAccount = { username: credentials?.username || '' }
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
      const credentials = pendingTwoFactor.credentials
      pendingTwoFactor = null
      await requireMemberAccount(result)
      updateSavedCredentials(credentials)
      currentAccount = { username: credentials?.username || '' }
      await openUserWindow()
      return { success: true, authenticated: true, message: result.message }
    } catch (error) {
      return publicError(error, '两步验证失败')
    }
  })

  ipcMain.handle('auth:submit-registration-application', async (event, application) => {
    requireLoginPage(event)
    try {
      const registration = application || {}
      const result = await apiClient.submitRegistrationApplication(registration)
      pendingRegistration = {
        username: String(registration.username || '').trim(),
        password: String(registration.password || ''),
      }
      return result
    } catch (error) {
      return publicError(error, '提交申请失败')
    }
  })

  ipcMain.handle('auth:registration-application-status', async (event) => {
    requireLoginPage(event)
    if (!pendingRegistration) {
      return { success: false, message: '本次启动中没有可查询的注册申请' }
    }
    try {
      return await apiClient.getRegistrationApplicationStatus(pendingRegistration)
    } catch (error) {
      return publicError(error, '查询注册申请状态失败')
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
      credentialStore.clear()
      return result
    } catch (error) {
      return publicError(error, '重置密码失败')
    }
  })
}

app.whenReady().then(async () => {
  apiSession = session.fromPartition(USER_SESSION_PARTITION, { cache: true })
  apiSession.setPermissionCheckHandler(() => false)
  apiSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  apiSession.on('will-download', (event) => event.preventDefault())
  apiClient = new NewApiClient({ config: desktopConfig, session: apiSession })
  const homeDir = app.getPath('home')
  toolSyncManager = new ToolSyncManager({
    allowInsecureHttp: desktopConfig.allowInsecureHttp,
    adapters: new Map([
      ['claude-code', new ClaudeAdapter({ homeDir, launcher: launchTool })],
      ['codex-gpt', new CodexAdapter({ homeDir, launcher: launchTool })],
      ['gemini', new GeminiAdapter({ homeDir, launcher: launchTool })],
      ['kimi', new KimiAdapter({ homeDir, launcher: launchTool })],
    ]),
  })
  passwordResetStore = new PasswordResetStore({
    filePath: path.join(app.getPath('userData'), 'password-reset-request.bin'),
    safeStorage,
  })
  credentialStore = new CredentialStore({
    filePath: path.join(app.getPath('userData'), 'login-credentials.bin'),
    safeStorage,
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

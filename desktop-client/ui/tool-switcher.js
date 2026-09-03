// 获取 DOM 元素
const messageElement = document.querySelector('#message')
const appTitleElement = document.querySelector('#app-title')
const userNameElement = document.querySelector('#user-name')
const userAvatarElement = document.querySelector('#user-avatar')
const serverUrlElement = document.querySelector('#server-url-display')

// 账号与表单元素
const statusBadge = document.querySelector('#status-badge')
const enableLaunchBtn = document.querySelector('#enable-launch-btn')
const enableBtnText = document.querySelector('#enable-btn-text')
const disableBtn = document.querySelector('#disable-btn')

const providerNameInput = document.querySelector('#provider-name')
const providerNoteInput = document.querySelector('#provider-note')
const providerWebsiteInput = document.querySelector('#provider-website')
const providerApiKeyInput = document.querySelector('#provider-api-key')
const providerApiUrlInput = document.querySelector('#provider-api-url')
const providerDefaultModelInput = document.querySelector('#provider-default-model')
const mappingModelName = document.querySelector('#mapping-model-name')

const toggleKeyVisibilityBtn = document.querySelector('#toggle-key-visibility')
const eyeText = document.querySelector('#eye-text')
const copyKeyBtn = document.querySelector('#copy-key-btn')
const copyUrlBtn = document.querySelector('#copy-url-btn')

// 主题切换
const themeToggleBtn = document.querySelector('#theme-toggle-btn')
const themeText = themeToggleBtn.querySelector('.theme-text')

let currentToolData = null
let hideMessageTimer = null

// ================= 主题管理 (默认为浅色/白色) =================
function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark')
    themeText.textContent = '深色外观'
    localStorage.setItem('app_theme', 'dark')
  } else {
    root.setAttribute('data-theme', 'light')
    themeText.textContent = '浅色外观'
    localStorage.setItem('app_theme', 'light')
  }
}

// 初始化主题 (默认 light 浅色)
const savedTheme = localStorage.getItem('app_theme') || 'light'
applyTheme(savedTheme)

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light'
  applyTheme(current === 'light' ? 'dark' : 'light')
})

// ================= 消息提示 =================
function showMessage(message, type = 'info') {
  if (hideMessageTimer) {
    clearTimeout(hideMessageTimer)
    hideMessageTimer = null
  }

  if (!message) {
    messageElement.textContent = ''
    messageElement.className = 'message-banner'
    return
  }

  messageElement.textContent = message
  messageElement.className = `message-banner visible ${type === true || type === 'ok' ? 'ok' : (type === 'error' ? 'error' : '')}`

  hideMessageTimer = setTimeout(() => {
    messageElement.className = 'message-banner'
  }, 4000)
}

function setBusy(button, busy, loadingText = '处理中…') {
  button.disabled = busy
  if (busy) {
    button.dataset.originalHtml = button.innerHTML
    button.innerHTML = `
      <svg class="btn-svg spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
      </svg>
      <span>${loadingText}</span>
    `
  } else if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml
    delete button.dataset.originalHtml
  }
}

// ================= 数据渲染与表单填充 =================
function renderCodex(tool, appMeta = {}) {
  currentToolData = tool

  // 用户与应用信息
  if (appMeta.account?.username) {
    userNameElement.textContent = appMeta.account.username
    userAvatarElement.textContent = appMeta.account.username.slice(0, 1).toUpperCase()
    providerNoteInput.value = `${appMeta.account.username} · 实验室专属账号`
  } else {
    userNameElement.textContent = '当前用户'
    userAvatarElement.textContent = 'U'
    providerNoteInput.value = '实验室成员专属账号 · 预置锁定'
  }

  if (appMeta.serverUrl) {
    serverUrlElement.textContent = appMeta.serverUrl
  }

  if (appMeta.productName) {
    appTitleElement.textContent = appMeta.productName
  }

  if (!tool) {
    statusBadge.textContent = '未分配'
    statusBadge.className = 'status-indicator-badge status-unconfigured'
    enableLaunchBtn.disabled = true
    disableBtn.disabled = true
    return
  }

  // 填充表单字段 (全部只读)
  const defaultModel = tool.model || 'gpt-5.6-sol'
  const endpointUrl = tool.apiBaseUrl || `${appMeta.serverUrl || 'http://127.0.0.1:3000'}/v1`
  const secretKey = tool.apiKey || ''

  providerApiUrlInput.value = endpointUrl
  providerApiKeyInput.value = secretKey
  providerDefaultModelInput.value = defaultModel
  mappingModelName.textContent = defaultModel

  // 状态与按钮样式
  if (tool.status === 'enabled') {
    statusBadge.textContent = '已启用'
    statusBadge.className = 'status-indicator-badge status-enabled'
    enableBtnText.textContent = '启动 ChatGPT 客户端'
    enableLaunchBtn.classList.add('btn-launch-mode')
    enableLaunchBtn.disabled = false
    disableBtn.disabled = false
  } else if (tool.status === 'unconfigured') {
    statusBadge.textContent = '未分配'
    statusBadge.className = 'status-indicator-badge status-unconfigured'
    enableBtnText.textContent = '启用并启动'
    enableLaunchBtn.classList.remove('btn-launch-mode')
    enableLaunchBtn.disabled = true
    disableBtn.disabled = true
  } else {
    statusBadge.textContent = '未启用'
    statusBadge.className = 'status-indicator-badge status-disabled'
    enableBtnText.textContent = '启用并启动'
    enableLaunchBtn.classList.remove('btn-launch-mode')
    enableLaunchBtn.disabled = false
    disableBtn.disabled = true
  }
}

// ================= API Key 显示与复制交互 =================
toggleKeyVisibilityBtn.addEventListener('click', () => {
  if (providerApiKeyInput.type === 'password') {
    providerApiKeyInput.type = 'text'
    eyeText.textContent = '隐藏'
  } else {
    providerApiKeyInput.type = 'password'
    eyeText.textContent = '显示'
  }
})

copyKeyBtn.addEventListener('click', async () => {
  const key = providerApiKeyInput.value
  if (!key) return
  try {
    await navigator.clipboard.writeText(key)
    showMessage('API Key 已复制到剪贴板', 'ok')
  } catch {
    showMessage('复制失败', 'error')
  }
})

copyUrlBtn.addEventListener('click', async () => {
  const url = providerApiUrlInput.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    showMessage('API 请求地址已复制到剪贴板', 'ok')
  } catch {
    showMessage('复制失败', 'error')
  }
})

// ================= 启动与停用操作 =================
enableLaunchBtn.addEventListener('click', async () => {
  if (!currentToolData) return

  // 1. 已启用状态：直接唤起本地客户端
  if (currentToolData.status === 'enabled') {
    setBusy(enableLaunchBtn, true, '正在唤起…')
    try {
      const result = await window.desktopTools.launch('codex-gpt')
      setBusy(enableLaunchBtn, false)
      if (result.success) {
        showMessage(result.message || '已唤起 ChatGPT 桌面客户端', 'ok')
      } else {
        showMessage(result.message || '唤起客户端失败', 'error')
      }
    } catch (err) {
      setBusy(enableLaunchBtn, false)
      showMessage(err?.message || '启动异常', 'error')
    }
    return
  }

  // 2. 未启用状态：写入配置并直接唤起客户端
  setBusy(enableLaunchBtn, true, '正在写入配置…')
  showMessage('正在配置本地 ~/.codex/config.toml…')

  try {
    const result = await window.desktopTools.enable('codex-gpt')
    setBusy(enableLaunchBtn, false)

    if (!result.success) {
      showMessage(result.message || '配置写入失败', 'error')
      return
    }

    const launchText = result.launchMessage ? ` · ${result.launchMessage}` : ''
    showMessage(`配置写入成功${launchText}`, 'ok')
    await load()
  } catch (err) {
    setBusy(enableLaunchBtn, false)
    showMessage(err?.message || '启用异常', 'error')
  }
})

disableBtn.addEventListener('click', async () => {
  setBusy(disableBtn, true, '正在移除…')
  try {
    const result = await window.desktopTools.disable('codex-gpt')
    setBusy(disableBtn, false)

    if (!result.success) {
      showMessage(result.message || '停用失败', 'error')
      return
    }

    showMessage('已从本机环境安全清理该配置', 'ok')
    await load()
  } catch (err) {
    setBusy(disableBtn, false)
    showMessage(err?.message || '停用异常', 'error')
  }
})

// ================= 数据加载与同步 =================
async function load() {
  try {
    const result = await window.desktopTools.getState()
    if (!result.success) {
      showMessage(result.message || '无法读取工具配置', 'error')
      return
    }
    const codexTool = (result.tools || []).find((t) => t.id === 'codex-gpt')
    renderCodex(codexTool, {
      account: result.account,
      serverUrl: result.serverUrl,
      productName: result.productName,
    })
  } catch (err) {
    showMessage(err?.message || '无法连接至客户端主进程', 'error')
  }
}

document.querySelector('#refresh').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  setBusy(btn, true, '同步中…')
  showMessage('正在检查最新凭证与模型…')

  try {
    const result = await window.desktopTools.refresh()
    setBusy(btn, false)
    if (!result.success) {
      showMessage(result.message || '同步失败', 'error')
    } else {
      const codexTool = (result.tools || []).find((t) => t.id === 'codex-gpt')
      renderCodex(codexTool, {
        account: result.account,
        serverUrl: result.serverUrl,
        productName: result.productName,
      })
      showMessage('配置已成功同步至最新状态', 'ok')
    }
  } catch (err) {
    setBusy(btn, false)
    showMessage(err?.message || '同步异常', 'error')
  }
})

document.querySelector('#logout').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  setBusy(btn, true, '正在退出…')
  try {
    const result = await window.desktopTools.logout()
    if (!result.success) {
      setBusy(btn, false)
      showMessage(result.message || '退出登录失败', 'error')
    }
  } catch (err) {
    setBusy(btn, false)
    showMessage(err?.message || '退出异常', 'error')
  }
})

// 初始加载
load()

// DOM 根节点与状态提示
const messageElement = document.querySelector('#message')
const appTitleElement = document.querySelector('#app-title')
const userNameElement = document.querySelector('#user-name')
const userAvatarElement = document.querySelector('#user-avatar')
const serverUrlElement = document.querySelector('#server-url-display')

// 主界面卡片与操作控件 (对齐图二)
const providerCard = document.querySelector('#codex-provider-card')
const cardStatusBadge = document.querySelector('#card-status-badge')
const btnMainEnable = document.querySelector('#btn-main-enable')
const btnMainText = document.querySelector('#btn-main-text')

const btnViewConfig = document.querySelector('#btn-view-config')
const btnQuickCopy = document.querySelector('#btn-quick-copy')
const btnPing = document.querySelector('#btn-ping')
const btnUsage = document.querySelector('#btn-usage')
const btnDisable = document.querySelector('#btn-disable')

// 供应商配置详情弹窗 (Modal)
const configModal = document.querySelector('#config-modal')
const modalBackBtn = document.querySelector('#modal-back-btn')
const modalCloseBtn = document.querySelector('#modal-close-btn')
const modalBtnClose = document.querySelector('#modal-btn-close')

const modalProviderName = document.querySelector('#modal-provider-name')
const modalProviderNote = document.querySelector('#modal-provider-note')
const modalProviderWebsite = document.querySelector('#modal-provider-website')
const modalProviderKey = document.querySelector('#modal-provider-key')
const modalProviderUrl = document.querySelector('#modal-provider-url')
const modalProviderModel = document.querySelector('#modal-provider-model')
const modalMappingModel = document.querySelector('#modal-mapping-model')

const modalToggleEye = document.querySelector('#modal-toggle-eye')
const modalEyeText = document.querySelector('#modal-eye-text')
const modalCopyKey = document.querySelector('#modal-copy-key')
const modalCopyUrl = document.querySelector('#modal-copy-url')

// 主题切换
const themeToggleBtn = document.querySelector('#theme-toggle-btn')
const themeText = themeToggleBtn.querySelector('.theme-text')

let currentToolData = null
let currentAppMeta = {}
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
      <svg class="play-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
      </svg>
      <span>${loadingText}</span>
    `
  } else if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml
    delete button.dataset.originalHtml
  }
}

// ================= 弹窗控制 (Modal) =================
function openConfigModal() {
  configModal.classList.add('visible')
  configModal.setAttribute('aria-hidden', 'false')
}

function closeConfigModal() {
  configModal.classList.remove('visible')
  configModal.setAttribute('aria-hidden', 'true')
}

modalBackBtn.addEventListener('click', closeConfigModal)
modalCloseBtn.addEventListener('click', closeConfigModal)
modalBtnClose.addEventListener('click', closeConfigModal)

// 点击遮罩空白处关闭弹窗
configModal.addEventListener('click', (e) => {
  if (e.target === configModal) closeConfigModal()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && configModal.classList.contains('visible')) {
    closeConfigModal()
  }
})

// ================= 界面渲染与数据同步 =================
function render(tool, appMeta = {}) {
  currentToolData = tool
  currentAppMeta = appMeta

  // 侧边栏与页首
  if (appMeta.account?.username) {
    userNameElement.textContent = appMeta.account.username
    userAvatarElement.textContent = appMeta.account.username.slice(0, 1).toUpperCase()
    modalProviderNote.value = `${appMeta.account.username} · 实验室成员专属账号`
  } else {
    userNameElement.textContent = '当前用户'
    userAvatarElement.textContent = 'U'
    modalProviderNote.value = '实验室成员专属账号 · 管理端预分配'
  }

  if (appMeta.serverUrl) {
    serverUrlElement.textContent = appMeta.serverUrl
  }

  if (appMeta.productName) {
    appTitleElement.textContent = appMeta.productName
  }

  if (!tool) {
    cardStatusBadge.textContent = '未分配'
    cardStatusBadge.className = 'badge-status badge-disabled'
    btnMainEnable.disabled = true
    btnDisable.disabled = true
    return
  }

  // 填充弹窗表单字段 (全部只读)
  const defaultModel = tool.model || 'gpt-5.6-sol'
  const endpointUrl = tool.apiBaseUrl || `${appMeta.serverUrl || 'http://127.0.0.1:3000'}/v1`
  const secretKey = tool.apiKey || ''

  modalProviderUrl.value = endpointUrl
  modalProviderKey.value = secretKey
  modalProviderModel.value = defaultModel
  modalMappingModel.textContent = defaultModel

  // 主卡片状态与按钮形态 (1:1 还原图二)
  if (tool.status === 'enabled') {
    cardStatusBadge.textContent = '已启用'
    cardStatusBadge.className = 'badge-status badge-enabled'
    btnMainText.textContent = '启动客户端'
    btnMainEnable.classList.add('btn-in-use')
    btnMainEnable.disabled = false
    btnDisable.disabled = false
  } else if (tool.status === 'unconfigured') {
    cardStatusBadge.textContent = '未分配'
    cardStatusBadge.className = 'badge-status badge-disabled'
    btnMainText.textContent = '启用'
    btnMainEnable.classList.remove('btn-in-use')
    btnMainEnable.disabled = true
    btnDisable.disabled = true
  } else {
    cardStatusBadge.textContent = '未启用'
    cardStatusBadge.className = 'badge-status badge-disabled'
    btnMainText.textContent = '启用'
    btnMainEnable.classList.remove('btn-in-use')
    btnMainEnable.disabled = false
    btnDisable.disabled = true
  }
}

// ================= 图标操作事件绑定 =================

// 1. ✏️ 查看供应商配置详情 (打开弹窗)
btnViewConfig.addEventListener('click', () => {
  openConfigModal()
})

// 2. 📋 快速复制 API Key
btnQuickCopy.addEventListener('click', async () => {
  const key = currentToolData?.apiKey
  if (!key) {
    showMessage('暂无可用 API Key', 'error')
    return
  }
  try {
    await navigator.clipboard.writeText(key)
    showMessage('专属 API Key 已成功复制到剪贴板', 'ok')
  } catch {
    showMessage('复制失败', 'error')
  }
})

// 3. ⚡ 检测服务网关连通性与延迟
btnPing.addEventListener('click', async () => {
  showMessage('正在测试网关连接延迟…')
  try {
    const result = await window.desktopTools.ping()
    if (result.success) {
      showMessage(`服务网关连通正常 · 响应延迟: ${result.latencyMs}ms`, 'ok')
    } else {
      showMessage(result.message || '服务网关连接超时', 'error')
    }
  } catch {
    showMessage('测试网关异常', 'error')
  }
})

// 4. 📊 查看账号用量与额度统计
btnUsage.addEventListener('click', () => {
  const account = currentAppMeta.account
  if (!account) {
    showMessage('当前账号暂未同步额度信息', 'info')
    return
  }
  const quota = account.quota !== undefined ? `$${(account.quota / 500000).toFixed(2)}` : '已开通'
  const used = account.used_quota !== undefined ? `$${(account.used_quota / 500000).toFixed(2)}` : '$0.00'
  const reqCount = account.request_count || 0
  showMessage(`当前账号可用额度: ${quota} · 已使用: ${used} · 累计调用: ${reqCount}次`, 'ok')
})

// 5. ▷ 主按钮操作 (启用 / 启动客户端)
btnMainEnable.addEventListener('click', async () => {
  if (!currentToolData) return

  // 已启用态：直接唤起本地原生 ChatGPT 桌面版
  if (currentToolData.status === 'enabled') {
    setBusy(btnMainEnable, true, '启动中…')
    try {
      const result = await window.desktopTools.launch('codex-gpt')
      setBusy(btnMainEnable, false)
      if (result.success) {
        showMessage(result.message || '已唤起 ChatGPT 桌面客户端', 'ok')
      } else {
        showMessage(result.message || '唤起客户端失败，请检查是否安装了 ChatGPT 桌面版', 'error')
      }
    } catch (err) {
      setBusy(btnMainEnable, false)
      showMessage(err?.message || '启动异常', 'error')
    }
    return
  }

  // 未启用态：自动写入配置到 ~/.codex/config.toml 并唤起
  setBusy(btnMainEnable, true, '正在配置…')
  showMessage('正在同步配置到本机 ~/.codex/config.toml…')

  try {
    const result = await window.desktopTools.enable('codex-gpt')
    setBusy(btnMainEnable, false)

    if (!result.success) {
      showMessage(result.message || '配置写入失败', 'error')
      return
    }

    const launchText = result.launchMessage ? ` · ${result.launchMessage}` : ''
    showMessage(`配置已自动写入本地环境${launchText}`, 'ok')
    await load()
  } catch (err) {
    setBusy(btnMainEnable, false)
    showMessage(err?.message || '启用异常', 'error')
  }
})

// 6. 🗑️ 停用/清除配置
btnDisable.addEventListener('click', async () => {
  setBusy(btnDisable, true)
  try {
    const result = await window.desktopTools.disable('codex-gpt')
    setBusy(btnDisable, false)
    if (!result.success) {
      showMessage(result.message || '停用失败', 'error')
      return
    }
    showMessage('已从本机环境安全清理该配置', 'ok')
    await load()
  } catch (err) {
    setBusy(btnDisable, false)
    showMessage(err?.message || '停用异常', 'error')
  }
})

// ================= 弹窗内部操作 =================
modalToggleEye.addEventListener('click', () => {
  if (modalProviderKey.type === 'password') {
    modalProviderKey.type = 'text'
    modalEyeText.textContent = '隐藏'
  } else {
    modalProviderKey.type = 'password'
    modalEyeText.textContent = '显示'
  }
})

modalCopyKey.addEventListener('click', async () => {
  const key = modalProviderKey.value
  if (!key) return
  try {
    await navigator.clipboard.writeText(key)
    showMessage('API Key 已复制到剪贴板', 'ok')
  } catch {
    showMessage('复制失败', 'error')
  }
})

modalCopyUrl.addEventListener('click', async () => {
  const url = modalProviderUrl.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    showMessage('API 请求地址已复制到剪贴板', 'ok')
  } catch {
    showMessage('复制失败', 'error')
  }
})

// ================= 全局数据加载与刷新 =================
async function load() {
  try {
    const result = await window.desktopTools.getState()
    if (!result.success) {
      showMessage(result.message || '无法读取工具配置', 'error')
      return
    }
    const codexTool = (result.tools || []).find((t) => t.id === 'codex-gpt')
    render(codexTool, {
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
      render(codexTool, {
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
  setBusy(btn, true, '退出中…')
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

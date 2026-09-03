// DOM 根节点与提示
const messageElement = document.querySelector('#message')
const appTitleElement = document.querySelector('#app-title')
const userNameElement = document.querySelector('#user-name')
const userAvatarElement = document.querySelector('#user-avatar')
const serverUrlElement = document.querySelector('#server-url-display')
const providerCardsList = document.querySelector('#provider-cards-list')

// 弹窗元素 (Modal)
const configModal = document.querySelector('#config-modal')
const modalBackBtn = document.querySelector('#modal-back-btn')
const modalCloseBtn = document.querySelector('#modal-close-btn')
const modalBtnClose = document.querySelector('#modal-btn-close')
const modalDialogTitle = document.querySelector('#modal-dialog-title')
const modalBigIconBox = document.querySelector('#modal-big-icon-box')

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
const modalBtnSpeedtest = document.querySelector('#modal-btn-speedtest')

// 窗口控制按钮绑定
const winMinBtn = document.querySelector('#win-min-btn')
const winMaxBtn = document.querySelector('#win-max-btn')
const winCloseBtn = document.querySelector('#win-close-btn')

if (winMinBtn) winMinBtn.addEventListener('click', () => window.desktopWindow?.minimize())
if (winMaxBtn) winMaxBtn.addEventListener('click', () => window.desktopWindow?.maximize())
if (winCloseBtn) winCloseBtn.addEventListener('click', () => window.desktopWindow?.close())

// 主题切换
const themeToggleBtn = document.querySelector('#theme-toggle-btn')
const themeText = themeToggleBtn.querySelector('.theme-text')

let currentToolsList = []
let currentAppMeta = {}
let currentViewingTool = null
let hideMessageTimer = null

// SVG 图标定义 (OpenAI, Claude, Gemini)
const ICONS = {
  'codex-gpt': `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.66-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1401-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1635a.0804.0804 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.402-.6863zm2.0007-3.6231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L8.809 8.6298V6.2974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM11.9961 7.0565l3.832 2.2096v4.4144l-3.832 2.2096-3.832-2.2096V9.2661z"/>
    </svg>
  `,
  'claude-code': `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  `,
  'gemini': `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 24c-.2 0-.4-.1-.5-.2C9.2 21.2 7 18 5 15.5 3 13 1 10.5.2 8.5c-.4-1.2.2-2.5 1.5-2.9C3 5.2 4.5 5.5 5.5 6.5l4.5 4.5V2c0-1.1.9-2 2-2s2 .9 2 2v9l4.5-4.5c1-1 2.5-1.3 3.8-.9 1.3.4 1.9 1.7 1.5 2.9-.8 2-2.8 4.5-4.8 7-2 2.5-4.2 5.7-6.3 8.3-.3.1-.5.2-.7.2z"/>
    </svg>
  `,
}

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
function openModal(tool) {
  currentViewingTool = tool
  modalDialogTitle.textContent = `供应商配置 - ${tool.name}`

  // 顶部大图标
  modalBigIconBox.className = `modal-big-icon-box ${tool.id === 'codex-gpt' ? 'logo-codex' : (tool.id === 'claude-code' ? 'logo-claude' : 'logo-gemini')}`
  modalBigIconBox.innerHTML = ICONS[tool.id] || ICONS['codex-gpt']

  // 表单字段填充
  modalProviderName.value = tool.name
  modalProviderNote.value = `${currentAppMeta.account?.username || '用户'} · 专属账号`

  // 官网链接：严格按用户要求，统一指向当前 New API 服务端点
  modalProviderWebsite.value = currentAppMeta.serverUrl || 'http://127.0.0.1:3000'

  // 核心：把服务端分发的用户真实的 API Key 与 New API 的实际 URL 填充上去
  modalProviderKey.value = tool.apiKey || ''
  modalProviderUrl.value = tool.apiBaseUrl || `${currentAppMeta.serverUrl || 'http://127.0.0.1:3000'}/v1`
  modalProviderModel.value = tool.model || 'gpt-5.6-sol'
  modalMappingModel.textContent = tool.model || 'gpt-5.6-sol'

  // 动态同步高级选项里的 auth.json (JSON) 预览区
  const modalAuthJson = document.querySelector('#modal-auth-json')
  if (modalAuthJson) {
    const authObj = { OPENAI_API_KEY: tool.apiKey || "sk-your-api-key-here" }
    modalAuthJson.value = JSON.stringify(authObj, null, 2)
  }

  // 动态同步高级选项里的 config.toml (TOML) 预览区
  const modalConfigToml = document.querySelector('#modal-config-toml')
  if (modalConfigToml) {
    const tomlLines = [
      'model_provider = "yangtzeapi"',
      `model = "${tool.model || 'gpt-5.6-sol'}"`,
      'model_reasoning_effort = "medium"',
      'disable_response_storage = true',
      '',
      '[model_providers.yangtzeapi]',
      'name = "yangtzeapi"',
      `base_url = "${tool.apiBaseUrl || (currentAppMeta.serverUrl + '/v1')}"`,
      'wire_api = "responses"',
      'requires_openai_auth = false',
      `experimental_bearer_token = "${tool.apiKey || 'sk-your-api-key-here'}"`
    ]
    modalConfigToml.value = tomlLines.join('\n')
  }

  configModal.classList.add('visible')
  configModal.setAttribute('aria-hidden', 'false')
}

function closeModal() {
  configModal.classList.remove('visible')
  configModal.setAttribute('aria-hidden', 'true')
}

modalBackBtn.addEventListener('click', closeModal)
modalCloseBtn.addEventListener('click', closeModal)
modalBtnClose.addEventListener('click', closeModal)

configModal.addEventListener('click', (e) => {
  if (e.target === configModal) closeModal()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && configModal.classList.contains('visible')) {
    closeModal()
  }
})

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
    showMessage('API Key 已成功复制到剪贴板', 'ok')
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

modalBtnSpeedtest.addEventListener('click', async () => {
  showMessage('正在测试网关响应延迟…')
  try {
    const result = await window.desktopTools.ping()
    if (result.success) {
      showMessage(`服务网关响应延迟: ${result.latencyMs}ms`, 'ok')
    } else {
      showMessage(result.message || '连接超时', 'error')
    }
  } catch {
    showMessage('测速异常', 'error')
  }
})

// ================= 卡片渲染 (平铺列表模式，1:1 对齐图二) =================
function renderCards(tools, appMeta = {}) {
  currentToolsList = tools || []
  currentAppMeta = appMeta

  // 顶栏信息
  if (appMeta.account?.username) {
    userNameElement.textContent = appMeta.account.username
    userAvatarElement.textContent = appMeta.account.username.slice(0, 1).toUpperCase()
  }
  if (appMeta.serverUrl) {
    serverUrlElement.textContent = appMeta.serverUrl
  }
  if (appMeta.productName) {
    appTitleElement.textContent = appMeta.productName
  }

  providerCardsList.replaceChildren()

  for (const tool of currentToolsList) {
    const card = document.createElement('article')
    card.className = `provider-card ${tool.id === 'codex-gpt' ? 'card-active' : ''}`
    card.dataset.toolId = tool.id

    // 确定 Logo class 与 SVG
    let logoClass = 'logo-codex'
    let logoSvg = ICONS['codex-gpt']
    let subtitleHtml = '账号会随 Codex CLI 当前登录变化'

    if (tool.id === 'claude-code') {
      logoClass = 'logo-claude'
      logoSvg = ICONS['claude-code']
      subtitleHtml = `<a class="provider-desc-link" href="javascript:void(0)">${tool.apiBaseUrl || appMeta.serverUrl}</a>`
    } else if (tool.id === 'gemini') {
      logoClass = 'logo-gemini'
      logoSvg = ICONS['gemini']
      subtitleHtml = `<a class="provider-desc-link" href="javascript:void(0)">${tool.apiBaseUrl || appMeta.serverUrl}</a>`
    }

    // 状态徽章：只有真正处于 enabled 时才是已启用
    const isEnabled = tool.status === 'enabled'
    const statusBadgeHtml = isEnabled
      ? `<span class="badge-status badge-enabled">已启用</span>`
      : `<span class="badge-status badge-disabled">未启用</span>`

    // 关键修正：蓝边表示当前已激活/启用的配置！
    // 如果没有任何工具已启用，则默认激活第一个（Codex），一旦用户启用了某个工具，该工具显示蓝边
    const anyEnabled = currentToolsList.some((t) => t.status === 'enabled')
    const shouldHighlight = isEnabled || (!anyEnabled && tool.id === 'codex-gpt')

    card.className = `provider-card ${shouldHighlight ? 'card-active' : ''}`
    card.dataset.toolId = tool.id

    // 主按钮文本：未启用显示「启用」，已启用显示「启动客户端」
    const mainBtnText = isEnabled ? '启动客户端' : '启用'
    const mainBtnClass = isEnabled ? 'btn-primary-blue btn-in-use' : 'btn-primary-blue'

    card.innerHTML = `
      <div class="card-left-section">
        <div class="drag-handle" title="固定卡片">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/>
            <circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/>
            <circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>
          </svg>
        </div>

        <div class="provider-logo-box ${logoClass}">
          ${logoSvg}
        </div>

        <div class="provider-info-col">
          <div class="provider-title-line">
            <span class="provider-name-text">${tool.name}</span>
            ${statusBadgeHtml}
          </div>
          <div class="provider-desc-text">${subtitleHtml}</div>
        </div>
      </div>

      <div class="card-right-section">
        <button class="${mainBtnClass} btn-card-enable" type="button">
          <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 4 19 12 6 20 6 4"/>
          </svg>
          <span class="btn-text-span">${mainBtnText}</span>
        </button>

        <div class="action-icon-group">
          <!-- 1. ✏️ 查看供应商配置详情 (只读弹窗) -->
          <button class="icon-btn btn-view-edit" type="button" title="查看供应商配置详情">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

          <!-- 2. 📋 复制专属 Key -->
          <button class="icon-btn btn-copy-key" type="button" title="一键复制 API Key">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>

          <!-- 3. ⚡ 延迟检测 -->
          <button class="icon-btn btn-check-ping" type="button" title="检测服务网关连通性">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </button>

          <!-- 4. 📊 额度查询 -->
          <button class="icon-btn btn-view-quota" type="button" title="查看账号额度">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>

          <!-- 5. 🗑️ 停用清理 -->
          <button class="icon-btn icon-btn-danger btn-card-disable" type="button" title="停用该配置" ${!isEnabled ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `

    // 绑定事件
    const btnEnable = card.querySelector('.btn-card-enable')
    const btnViewEdit = card.querySelector('.btn-view-edit')
    const btnCopy = card.querySelector('.btn-copy-key')
    const btnCheck = card.querySelector('.btn-check-ping')
    const btnQuota = card.querySelector('.btn-view-quota')
    const btnDis = card.querySelector('.btn-card-disable')

    // 查看详情弹窗 (完全还原你的两张表单截图)
    btnViewEdit.addEventListener('click', () => {
      openModal(tool)
    })

    // 快速复制 Key
    btnCopy.addEventListener('click', async () => {
      if (!tool.apiKey) {
        showMessage('暂无可用 API Key', 'error')
        return
      }
      try {
        await navigator.clipboard.writeText(tool.apiKey)
        showMessage(`已成功复制 ${tool.name} 的 API 密钥`, 'ok')
      } catch {
        showMessage('复制失败', 'error')
      }
    })

    // 延迟检测
    btnCheck.addEventListener('click', async () => {
      showMessage(`正在检测 ${tool.name} 服务端点延迟…`)
      try {
        const result = await window.desktopTools.ping()
        if (result.success) {
          showMessage(`网关连通正常 · 延迟: ${result.latencyMs}ms`, 'ok')
        } else {
          showMessage(result.message || '连接网关超时', 'error')
        }
      } catch {
        showMessage('测试网络异常', 'error')
      }
    })

    // 额度查询
    btnQuota.addEventListener('click', () => {
      const account = currentAppMeta.account
      if (!account) {
        showMessage('当前账号暂未同步额度信息', 'info')
        return
      }
      const quota = account.quota !== undefined ? `$${(account.quota / 500000).toFixed(2)}` : '已开通'
      const used = account.used_quota !== undefined ? `$${(account.used_quota / 500000).toFixed(2)}` : '$0.00'
      showMessage(`账号: ${account.username || '当前用户'} · 额度: ${quota} · 已用: ${used}`, 'ok')
    })

    // 启用与启动
    btnEnable.addEventListener('click', async () => {
      // 已经启用：直接唤起对应客户端
      if (tool.status === 'enabled') {
        setBusy(btnEnable, true, '启动中…')
        try {
          const result = await window.desktopTools.launch(tool.id)
          setBusy(btnEnable, false)
          if (result.success) {
            showMessage(result.message || `已唤起 ${tool.name} 客户端`, 'ok')
          } else {
            showMessage(result.message || `唤起失败，请确保本地已安装客户端`, 'error')
          }
        } catch (err) {
          setBusy(btnEnable, false)
          showMessage(err?.message || '启动异常', 'error')
        }
        return
      }

      // 未启用：写入配置并直接唤起应用
      setBusy(btnEnable, true, '正在配置…')
      showMessage(`正在同步 ${tool.name} 配置到本机…`)

      try {
        const result = await window.desktopTools.enable(tool.id)
        setBusy(btnEnable, false)

        if (!result.success) {
          showMessage(result.message || '配置写入失败', 'error')
          return
        }

        const launchText = result.launchMessage ? ` · ${result.launchMessage}` : ''
        showMessage(`配置同步成功${launchText}`, 'ok')
        await load()
      } catch (err) {
        setBusy(btnEnable, false)
        showMessage(err?.message || '启用异常', 'error')
      }
    })

    // 停用清理
    btnDis.addEventListener('click', async () => {
      setBusy(btnDis, true)
      try {
        const result = await window.desktopTools.disable(tool.id)
        setBusy(btnDis, false)
        if (!result.success) {
          showMessage(result.message || '停用失败', 'error')
          return
        }
        showMessage(`已从本机环境安全清理 ${tool.name} 配置`, 'ok')
        await load()
      } catch (err) {
        setBusy(btnDis, false)
        showMessage(err?.message || '停用异常', 'error')
      }
    })

    providerCardsList.append(card)
  }
}

// ================= 全局数据加载与刷新 =================
async function load() {
  try {
    const result = await window.desktopTools.getState()
    if (!result.success) {
      showMessage(result.message || '无法读取工具配置', 'error')
      return
    }
    renderCards(result.tools, {
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
  btn.classList.add('spinning')
  showMessage('正在检查最新凭证与模型…')

  try {
    const result = await window.desktopTools.refresh()
    btn.classList.remove('spinning')
    if (!result.success) {
      showMessage(result.message || '同步失败', 'error')
    } else {
      renderCards(result.tools, {
        account: result.account,
        serverUrl: result.serverUrl,
        productName: result.productName,
      })
      showMessage('配置已成功同步至最新状态', 'ok')
    }
  } catch (err) {
    btn.classList.remove('spinning')
    showMessage(err?.message || '同步异常', 'error')
  }
})

document.querySelector('#logout').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  setBusy(btn, true)
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

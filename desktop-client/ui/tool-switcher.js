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

// Agent 图标使用随应用打包的本地资源，避免依赖外部网络。
const ICON_ASSETS = {
  'codex-gpt': 'assets/gpt-icon.png',
  'claude-code': 'assets/claude-icon.png',
  'gemini': 'assets/gemini-icon.png',
}

// SVG 作为资源加载失败时的兼容回退。
const ICONS = {
  'codex-gpt': `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.66-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1401-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1635a.0804.0804 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.402-.6863zm2.0007-3.6231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L8.809 8.6298V6.2974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM11.9961 7.0565l3.832 2.2096v4.4144l-3.832 2.2096-3.832-2.2096V9.2661z"/>
    </svg>
  `,
  'claude-code': `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1.5c.7 0 1.3.45 1.52 1.1l1.45 4.36 4.36-1.45a1.6 1.6 0 1 1 1.02 3.03l-4.36 1.45 4.36 1.45a1.6 1.6 0 1 1-1.02 3.03l-4.36-1.45-1.45 4.36a1.6 1.6 0 1 1-3.03 0l-1.45-4.36-4.36 1.45a1.6 1.6 0 1 1-1.02-3.03l4.36-1.45-4.36-1.45a1.6 1.6 0 1 1 1.02-3.03l4.36 1.45 1.45-4.36A1.6 1.6 0 0 1 12 1.5Z"/>
    </svg>
  `,
  'gemini': `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1.5c.45 4.95 2.55 7.05 7.5 7.5-4.95.45-7.05 2.55-7.5 7.5-.45-4.95-2.55-7.05-7.5-7.5 4.95-.45 7.05-2.55 7.5-7.5Zm7.35 14.3c.27 2.2.95 2.88 3.15 3.15-2.2.27-2.88.95-3.15 3.15-.27-2.2-.95-2.88-3.15-3.15 2.2-.27 2.88-.95 3.15-3.15Z"/>
    </svg>
  `,
  'kimi': `
    <svg viewBox="0 0 24 25" fill="currentColor">
      <path d="M21.7202 0.939941C22.9502 0.939941 23.9502 1.93994 23.9502 3.16994C23.9502 4.39994 22.9502 5.39994 21.7202 5.39994H19.7502C19.6002 5.39994 19.4902 5.27994 19.4902 5.13994V3.16994C19.4902 1.93994 20.4902 0.939941 21.7202 0.939941Z" fill="#1783FF"></path>
      <path d="M9.39 13.9501L17.82 5.59012C17.98 5.43012 17.89 5.12012 17.68 5.12012H13.14C13.14 5.12012 13.04 5.14012 13 5.18012L3.92 14.1901C3.78 14.3301 3.57 14.2101 3.57 13.9801V5.39012C3.57 5.24012 3.47 5.12012 3.35 5.12012H0.219999C0.0999993 5.12012 0 5.24012 0 5.39012V23.9201C0 24.0701 0.0999993 24.1901 0.219999 24.1901H3.35C3.47 24.1901 3.57 24.0701 3.57 23.9201V20.1401C3.57 20.0601 3.6 19.9801 3.65 19.9301L6.47 17.1401C6.54 17.0701 6.63 17.0601 6.71 17.1101L14.24 22.6501C15.47 23.4801 16.85 23.9901 18.25 24.1401C18.37 24.1501 18.48 24.0301 18.48 23.8701V20.3101C18.48 20.1701 18.4 20.0601 18.29 20.0501C17.47 19.9201 16.66 19.6001 15.94 19.1101L9.42 14.3901C9.28 14.3001 9.27 14.0701 9.39 13.9501Z" fill="#1783FF"></path>
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
  modalBigIconBox.className = `modal-big-icon-box ${tool.id === 'codex-gpt' ? 'logo-codex' : (tool.id === 'kimi' ? 'logo-kimi' : (tool.id === 'claude-code' ? 'logo-claude' : 'logo-gemini'))}`
  const iconAsset = ICON_ASSETS[tool.id]
  modalBigIconBox.innerHTML = iconAsset
    ? `<img class="agent-icon-image" src="${iconAsset}" alt="${tool.name} 图标">`
    : (ICONS[tool.id] || ICONS['codex-gpt'])

  // 表单字段填充
  modalProviderName.value = tool.name
  modalProviderNote.value = `${currentAppMeta.account?.username || '用户'} · 专属账号`

  // 官网链接：统一指向当前的 New API 服务端点
  modalProviderWebsite.value = currentAppMeta.serverUrl || 'http://127.0.0.1:3000'

  // 核心：真实 API Key 与真实 API 端点
  modalProviderKey.type = 'text'
  modalEyeText.textContent = '隐藏'
  modalProviderKey.value = tool.apiKey || ''
  modalProviderUrl.value = tool.apiBaseUrl || `${currentAppMeta.serverUrl || 'http://127.0.0.1:3000'}/v1`
  modalProviderModel.value = tool.model || 'gpt-5.6-luna'
  modalMappingModel.textContent = tool.model || 'gpt-5.6-luna'

  // 动态渲染模型映射列表（根据 URL 接口返回的真实可用模型动态生成）
  const mappingBox = document.querySelector('.mapping-preview-box')
  if (mappingBox) {
    const modelsList = (tool.availableModels && tool.availableModels.length > 0)
      ? tool.availableModels
      : [tool.model || 'gpt-5.6-luna']

    mappingBox.innerHTML = modelsList.map((m) => `
      <div class="mapping-row-item">
        <span class="mapping-green-dot"></span>
        <span class="mapping-model-id font-mono">${m}</span>
        <span class="mapping-sync-tag">${m === tool.model ? '当前默认 · 已同步' : '已映射可用'}</span>
      </div>
    `).join('')
  }

  // 动态同步高级选项里的 auth.json (JSON) 预览区
  const modalAuthJson = document.querySelector('#modal-auth-json')
  if (modalAuthJson) {
    const authObj = { OPENAI_API_KEY: tool.apiKey || "sk-your-api-key-here" }
    modalAuthJson.value = JSON.stringify(authObj, null, 2)
  }

  // 动态同步高级选项里的 config.toml (TOML) 预览区 (与本地写入格式 100% 严格一致)
  const modalConfigToml = document.querySelector('#modal-config-toml')
  if (modalConfigToml) {
    const tomlLines = [
      'model_provider = "custom"',
      `model = "${tool.model || 'gpt-5.6-luna'}"`,
      'model_reasoning_effort = "high"',
      'disable_response_storage = true',
      'windows_wsl_setup_acknowledged = true',
      '',
      '[model_providers.custom]',
      'name = "custom"',
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
  if (modalProviderKey.type === 'text') {
    modalProviderKey.type = 'password'
    modalEyeText.textContent = '显示'
  } else {
    modalProviderKey.type = 'text'
    modalEyeText.textContent = '隐藏'
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
    let logoAsset = ICON_ASSETS['codex-gpt']
    // 卡片副标题展示官网/服务端地址，不展示协议请求路径（例如 /v1）。
    const providerAddress = (appMeta.serverUrl || tool.apiBaseUrl || '未配置服务地址')
      .replace(/\/v1\/?$/i, '')
      .replace(/\/+$/, '') || '未配置服务地址'
    let subtitleHtml = `<a class="provider-desc-link" href="javascript:void(0)">${providerAddress}</a>`

    if (tool.id === 'claude-code') {
      logoClass = 'logo-claude'
      logoAsset = ICON_ASSETS['claude-code']
      subtitleHtml = `<a class="provider-desc-link" href="javascript:void(0)">${providerAddress}</a>`
    } else if (tool.id === 'gemini') {
      logoClass = 'logo-gemini'
      logoAsset = ICON_ASSETS['gemini']
      subtitleHtml = `<a class="provider-desc-link" href="javascript:void(0)">${providerAddress}</a>`
    } else if (tool.id === 'kimi') {
      logoClass = 'logo-kimi'
      logoAsset = null
      subtitleHtml = `<a class="provider-desc-link" href="javascript:void(0)">${providerAddress}</a>`
    }

    // 状态徽章：只有真正处于 enabled 时才是已启用
    const isEnabled = tool.status === 'enabled'
    const statusBadgeHtml = isEnabled
      ? `<span class="badge-status badge-enabled">已启用</span>`
      : `<span class="badge-status badge-disabled">未启用</span>`

    // 关键修正：蓝边严格代表“已启用”！未启用时没有任何蓝边
    card.className = `provider-card ${isEnabled ? 'card-active' : ''}`
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
          <img class="agent-icon-image" src="${logoAsset}" alt="${tool.name} 图标">
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

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
const fetchModelsButton = document.querySelector('#modal-fetch-models')
const applyModelsButton = document.querySelector('#modal-apply-models')
const modelSearch = document.querySelector('#modal-model-search')
const modelStatus = document.querySelector('#modal-model-status')
let draftModels = []
let defaultModel = ''
let modalRevision = 0
let applyingModels = false
let fetchingModels = false

const modalToggleEye = document.querySelector('#modal-toggle-eye')
const modalEyeText = document.querySelector('#modal-eye-text')
const modalCopyKey = document.querySelector('#modal-copy-key')
const modalCopyUrl = document.querySelector('#modal-copy-url')
const modalBtnSpeedtest = document.querySelector('#modal-btn-speedtest')

// Move existing fields intact so their values and event bindings survive tab changes.
const modalBody = document.querySelector('.modal-body')
const connectionFields = [...modalBody.children].slice(0, 5)
const modelFields = [modalProviderModel.closest('.form-row'), fetchModelsButton.closest('.form-group')]
const advancedFields = [document.querySelector('.advanced-card-content'), document.querySelector('#modal-auth-json').closest('.form-row'), document.querySelector('#modal-config-toml').closest('.form-row')]
for (const [name, fields] of Object.entries({ connection: connectionFields, models: modelFields, advanced: advancedFields })) {
  const panel = document.createElement('section')
  panel.id = `panel-${name}`
  panel.className = 'config-tab-panel'
  panel.setAttribute('role', 'tabpanel')
  panel.setAttribute('aria-labelledby', `tab-${name}`)
  panel.hidden = name !== 'connection'
  fields.forEach((field) => panel.append(field))
  modalBody.append(panel)
}
document.querySelector('.advanced-card').remove()
let modalOpener = null
function selectConfigTab(name) {
  document.querySelectorAll('.config-tab').forEach((tab) => {
    const selected = tab.dataset.tab === name
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    document.querySelector(`#panel-${tab.dataset.tab}`).hidden = !selected
  })
  modalBody.scrollTop = 0
}
document.querySelectorAll('.config-tab').forEach((tab, index, tabs) => {
  tab.addEventListener('click', () => selectConfigTab(tab.dataset.tab))
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    selectConfigTab(tabs[next].dataset.tab)
    tabs[next].focus()
  })
})

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
  modalOpener = document.activeElement
  selectConfigTab('connection')
  modalRevision += 1
  currentViewingTool = tool
  modalDialogTitle.textContent = `供应商配置 - ${tool.name}`

  // 顶部大图标
  modalBigIconBox.className = `modal-big-icon-box ${tool.id === 'codex-gpt' ? 'logo-codex' : 'logo-claude'}`
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
  const editable = Array.isArray(tool.availableModels)
  defaultModel = tool.model || ''
  draftModels = [...new Set(tool.availableModels || [])]
  modelSearch.value = ''
  modelSearch.hidden = !editable
  fetchModelsButton.hidden = !editable
  fetchModelsButton.disabled = false
  fetchingModels = false
  applyModelsButton.hidden = !editable
  modalProviderModel.disabled = !editable
  modelStatus.textContent = editable ? `${draftModels.length} 个授权模型` : ''
  document.querySelector('#modal-config-status').textContent = editable ? '模型可选' : '管理端预分配'
  renderModelSelection()

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
  configModal.inert = false
  document.querySelector('.app-topbar').inert = true
  document.querySelector('.content-body').inert = true
  configModal.setAttribute('aria-hidden', 'false')
  document.querySelector('#tab-connection').focus()
  renderModelSelection()
}

function closeModal() {
  if (applyingModels || fetchingModels) return
  modalRevision += 1
  configModal.classList.remove('visible')
  configModal.inert = true
  document.querySelector('.app-topbar').inert = false
  document.querySelector('.content-body').inert = false
  configModal.setAttribute('aria-hidden', 'true')
  modalOpener?.focus()
}

function renderModelSelection() {
  const editable = Array.isArray(currentViewingTool?.availableModels)
  const box = document.querySelector('.mapping-preview-box')
  box.replaceChildren()
  const allModels = draftModels
  for (const id of allModels.filter((id) => id.toLowerCase().includes(modelSearch.value.toLowerCase()))) {
    const row = document.createElement('div')
    row.className = 'mapping-row-item'
    const name = document.createElement('span')
    name.className = 'mapping-model-id font-mono'
    name.textContent = id.startsWith('kimi-') ? `Kimi · ${id.slice(5)} · ${id}` : id
    const status = document.createElement('span')
    status.className = 'mapping-sync-tag'
    status.textContent = id === defaultModel ? '默认' : ''
    row.append(name, status)
    box.append(row)
  }
  if (!box.children.length) box.textContent = modelSearch.value ? '没有匹配的模型' : '暂无模型'
  modalProviderModel.replaceChildren()
  for (const id of [...new Set([...draftModels, defaultModel].filter(Boolean))]) {
    const option = document.createElement('option')
    option.value = id
    option.textContent = id.startsWith('kimi-') ? `Kimi · ${id.slice(5)} (${id})` : id
    modalProviderModel.append(option)
  }
  modalProviderModel.value = defaultModel
  modalProviderModel.disabled = applyingModels || fetchingModels || !editable
  applyModelsButton.disabled = applyingModels || fetchingModels || !draftModels.includes(defaultModel)
  const preview = document.querySelector('#modal-config-toml')
  if (editable && preview) {
    preview.value = [
      'model_provider = "custom"', `model = ${JSON.stringify(defaultModel)}`,
      '# model_catalog_json: ' + draftModels.join(', '),
      'model_supports_reasoning_summaries = false', '', '[model_providers.custom]',
      `name = ${JSON.stringify(currentViewingTool.providerName || 'API')}`, `base_url = ${JSON.stringify(currentViewingTool.apiBaseUrl)}`,
      'wire_api = "responses"', 'requires_openai_auth = false', 'supports_websockets = false',
      `experimental_bearer_token = ${JSON.stringify(currentViewingTool.apiKey)}`,
    ].join('\n')
  }
}

modalProviderModel.addEventListener('change', () => {
  defaultModel = modalProviderModel.value
  renderModelSelection()
})
modelSearch.addEventListener('input', renderModelSelection)

fetchModelsButton.addEventListener('click', async () => {
  const revision = modalRevision
  fetchingModels = true
  renderModelSelection()
  fetchModelsButton.disabled = true
  modelStatus.textContent = '正在获取模型…'
  try {
    const result = await window.desktopTools.getModels(currentViewingTool.id)
    if (revision !== modalRevision) return
    if (!result.success) throw new Error(result.message || '获取模型失败')
    draftModels = result.models
    defaultModel = result.model
    renderCards(result.tools, currentAppMeta)
    currentViewingTool = result.tools.find((tool) => tool.id === currentViewingTool.id)
    modelStatus.textContent = `已同步 ${draftModels.length} 个模型 · 重启 Codex 后生效`
    document.querySelector('#modal-config-status').textContent = '全部模型已同步'
    renderModelSelection()
  } catch (error) {
    if (revision === modalRevision) modelStatus.textContent = error.message || '获取模型失败'
  } finally {
    if (revision === modalRevision) {
      fetchingModels = false
      fetchModelsButton.disabled = false
      renderModelSelection()
    }
  }
})

applyModelsButton.addEventListener('click', async () => {
  const revision = modalRevision
  applyingModels = true
  renderModelSelection()
  applyModelsButton.disabled = true
  fetchModelsButton.disabled = true
  modelStatus.textContent = '正在应用…'
  try {
    const result = await window.desktopTools.applyModels(currentViewingTool.id, { model: defaultModel })
    if (revision !== modalRevision) return
    if (!result.success) throw new Error(result.message || '应用失败')
    renderCards(result.tools, currentAppMeta)
    currentViewingTool = result.tools.find((tool) => tool.id === currentViewingTool.id)
    draftModels = currentViewingTool.availableModels
    modelStatus.textContent = result.message
    document.querySelector('#modal-config-status').textContent = '已应用 · 等待重启 Codex'
  } catch (error) {
    if (revision === modalRevision) modelStatus.textContent = error.message || '应用失败'
  } finally {
    applyingModels = false
    if (revision === modalRevision) {
      fetchModelsButton.disabled = false
      renderModelSelection()
    }
  }
})

modalBackBtn.addEventListener('click', closeModal)
modalCloseBtn.addEventListener('click', closeModal)
modalBtnClose.addEventListener('click', closeModal)

configModal.addEventListener('click', (e) => {
  if (e.target === configModal) closeModal()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && configModal.classList.contains('visible')) {
    const items = [...configModal.querySelectorAll('button, input, select, textarea, [tabindex]')].filter((item) => !item.disabled && item.tabIndex >= 0 && item.getClientRects().length)
    const first = items[0]
    const last = items.at(-1)
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }
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
  document.querySelector('#terminal-count').textContent = `${currentToolsList.length} 个终端 · ${currentToolsList.filter((tool) => tool.status === 'enabled').length} 个已启用`

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
    }

    // 状态徽章：只有真正处于 enabled 时才是已启用
    const isEnabled = tool.status === 'enabled'
    const statusBadgeHtml = isEnabled
      ? `<span class="badge-status badge-enabled">已启用</span>`
      : `<span class="badge-status badge-disabled">未启用</span>`

    // 关键修正：蓝边严格代表“已启用”！未启用时没有任何蓝边
    card.className = `provider-card ${isEnabled ? 'card-active' : ''}`
    card.dataset.toolId = tool.id

    const mainBtnText = '启用'
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
        <button class="${mainBtnClass} btn-card-enable" type="button" title="${isEnabled ? '已启用，点击启动客户端' : '启用并启动客户端'}">
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

const { NewApiClientError } = require('../new-api-client')
const { atomicWrite, readTextIfExists } = require('./base-sync')

function normalizeServerConfig(item, allowInsecureHttp = false) {
  if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/i.test(item.id)) return null
  const config = {
    id: item.id,
    name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.id,
    apiKey: item.api_key,
    apiBaseUrl: item.api_base_url,
    model: item.model,
    format: item.config_format,
    availableModels: Array.isArray(item.available_models) ? item.available_models : [],
  }
  for (const field of ['apiKey', 'apiBaseUrl', 'model']) {
    if (typeof config[field] !== 'string' || config[field].trim() === '') return null
  }
  let url
  try { url = new URL(config.apiBaseUrl) } catch { return null }
  if (url.protocol !== 'https:' && !(allowInsecureHttp && url.protocol === 'http:')) return null
  if (url.username || url.password || url.hash) return null
  return config
}

class ToolSyncManager {
  constructor({ adapters, allowInsecureHttp = false, preferencesPath }) {
    this.adapters = adapters
    this.allowInsecureHttp = allowInsecureHttp
    this.serverConfigs = new Map()
    this.preferencesPath = preferencesPath
    this.accountScope = ''
    this.preferences = preferencesPath ? JSON.parse(readTextIfExists(preferencesPath) || '{}') : {}
  }

  setAccountScope(scope, username = '') {
    this.accountScope = scope
    this.accountName = typeof username === 'string' ? username.trim() : ''
  }

  withSelection(config) {
    const saved = this.preferences[this.accountScope]?.[config.id]
    const models = config.availableModels || []
    const preferred = saved?.model || config.model
    return { ...config, providerName: this.accountName || 'API', model: models.length && !models.includes(preferred) ? models[0] : preferred }
  }

  setServerConfigs(items) {
    this.serverConfigs.clear()
    for (const item of items || []) {
      const config = normalizeServerConfig(item, this.allowInsecureHttp)
      if (config) {
        const adapter = this.adapters.get(config.id)
        if (adapter && config.format) adapter.format = config.format
        this.serverConfigs.set(config.id, this.withSelection(config))
      }
    }
  }

  getState() {
    return [...this.adapters.entries()].map(([id, adapter]) => {
      const config = this.serverConfigs.get(id)
      const local = adapter.getLocalState(config)
      if (config) {
        return { ...adapter.describe(config), status: local.configured ? 'enabled' : 'disabled' }
      }
      return {
        id,
        name: adapter.displayName,
        status: 'disabled',
        model: id === 'codex-gpt' ? 'gpt-5.6-luna' : (id === 'claude-code' ? 'claude-sonnet-4-20250514' : ''),
        apiBaseUrl: 'http://127.0.0.1:3000/v1',
        apiKey: '',
        apiKeyMasked: '未配置',
      }
    })
  }

  requireAdapter(toolId) {
    if (!this.adapters.has(toolId)) throw new NewApiClientError('不支持的工具', { code: 'INVALID_TOOL' })
    return this.adapters.get(toolId)
  }

  enable(toolId, config) {
    const adapter = this.requireAdapter(toolId)
    const normalized = normalizeServerConfig(config, this.allowInsecureHttp)
    if (!normalized || normalized.id !== toolId) throw new NewApiClientError('服务器返回的工具配置无效', { code: 'INVALID_RESPONSE' })
    const selected = this.withSelection(normalized)
    adapter.apply(selected)
    this.serverConfigs.set(toolId, selected)
    const launch = adapter.launch()
    return { success: true, status: 'enabled', launched: launch?.launched === true, launchMessage: launch?.message || '' }
  }

  disable(toolId) {
    const adapter = this.requireAdapter(toolId)
    adapter.remove()
    return { success: true, status: 'disabled' }
  }

  applyModels(toolId, selection, availableModels) {
    const adapter = this.requireAdapter(toolId)
    const config = this.serverConfigs.get(toolId)
    if (!config) throw new NewApiClientError('该工具尚未配置')
    if (!availableModels.length || !availableModels.includes(selection?.model)) {
      throw new NewApiClientError('默认模型已下架或未授权，请重新获取模型列表', { code: 'INVALID_MODEL' })
    }
    const next = { ...config, model: selection.model, availableModels: [...new Set(availableModels)] }
    adapter.apply(next)
    const previous = this.preferences
    this.preferences = { ...previous, [this.accountScope]: { ...previous[this.accountScope], [toolId]: { model: next.model } } }
    try {
      if (this.preferencesPath) atomicWrite(this.preferencesPath, JSON.stringify(this.preferences, null, 2))
    } catch (error) {
      this.preferences = previous
      adapter.apply(config)
      throw error
    }
    this.serverConfigs.set(toolId, next)
    return { success: true, tools: this.getState(), message: '已应用，重启 Codex 后生效' }
  }
}

module.exports = { ToolSyncManager, normalizeServerConfig }

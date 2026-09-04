const { NewApiClientError } = require('../new-api-client')

const TOOL_IDS = new Set(['claude-code', 'codex-gpt', 'gemini'])

function normalizeServerConfig(item, allowInsecureHttp = false) {
  if (!item || typeof item !== 'object' || !TOOL_IDS.has(item.id)) return null
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
  constructor({ adapters, allowInsecureHttp = false }) {
    this.adapters = adapters
    this.allowInsecureHttp = allowInsecureHttp
    this.serverConfigs = new Map()
  }

  setServerConfigs(items) {
    this.serverConfigs.clear()
    for (const item of items || []) {
      const config = normalizeServerConfig(item, this.allowInsecureHttp)
      if (config) {
        const adapter = this.adapters.get(config.id)
        if (adapter && config.format) adapter.format = config.format
        this.serverConfigs.set(config.id, config)
      }
    }
  }

  getState() {
    return [...this.adapters.entries()].map(([id, adapter]) => {
      const config = this.serverConfigs.get(id)
      const local = adapter.getLocalState()
      if (config) {
        return { ...adapter.describe(config), status: local.configured ? 'enabled' : 'disabled' }
      }
      return {
        id,
        name: adapter.displayName,
        status: 'disabled',
        model: id === 'codex-gpt' ? 'gpt-5.6-sol' : (id === 'claude-code' ? 'claude-sonnet-4-20250514' : 'gemini-2.5-pro'),
        apiBaseUrl: 'http://127.0.0.1:3000/v1',
        apiKey: '',
        apiKeyMasked: '未配置',
      }
    })
  }

  requireAdapter(toolId) {
    if (!TOOL_IDS.has(toolId) || !this.adapters.has(toolId)) throw new NewApiClientError('不支持的工具', { code: 'INVALID_TOOL' })
    return this.adapters.get(toolId)
  }

  enable(toolId, config) {
    const adapter = this.requireAdapter(toolId)
    const normalized = normalizeServerConfig(config, this.allowInsecureHttp)
    if (!normalized || normalized.id !== toolId) throw new NewApiClientError('服务器返回的工具配置无效', { code: 'INVALID_RESPONSE' })
    adapter.apply(normalized)
    this.serverConfigs.set(toolId, normalized)
    const launch = adapter.launch()
    return { success: true, status: 'enabled', launched: launch?.launched === true, launchMessage: launch?.message || '' }
  }

  disable(toolId) {
    const adapter = this.requireAdapter(toolId)
    adapter.remove()
    return { success: true, status: 'disabled' }
  }
}

module.exports = { ToolSyncManager, normalizeServerConfig }

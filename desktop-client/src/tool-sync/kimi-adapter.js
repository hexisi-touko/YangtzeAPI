const path = require('node:path')
const { BaseSyncAdapter, maskSecret } = require('./base-sync')

class KimiAdapter extends BaseSyncAdapter {
  constructor(options) {
    super(options)
    this.configPath = path.join(this.homeDir, '.kimi', 'config.json')
  }

  get toolId() { return 'kimi' }
  get displayName() { return 'Kimi (Moonshot)' }
  get configPaths() { return [this.configPath] }

  getLocalState() {
    return { configured: this.isConfigured === true }
  }

  apply(config) {
    this.isConfigured = true
    this.lastConfig = config
  }

  remove() {
    this.isConfigured = false
    this.lastConfig = null
  }

  launch() {
    return {
      launched: true,
      openChatWindow: true,
      message: '已打开 Kimi 智能助手对话窗口',
    }
  }

  describe(config) {
    return {
      id: this.toolId,
      name: this.displayName,
      model: config.model || 'moonshot-v1-8k',
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      apiKeyMasked: maskSecret(config.apiKey),
      availableModels: config.availableModels || [],
    }
  }
}

module.exports = { KimiAdapter }

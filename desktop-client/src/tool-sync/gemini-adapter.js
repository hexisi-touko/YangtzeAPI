const path = require('node:path')
const { BaseSyncAdapter, maskSecret } = require('./base-sync')

class GeminiAdapter extends BaseSyncAdapter {
  constructor(options) {
    super(options)
    this.configPath = path.join(this.homeDir, '.gemini', 'config.json')
  }

  get toolId() { return 'gemini' }
  get displayName() { return 'Gemini' }
  get configPaths() { return [this.configPath] }

  getLocalState() {
    return { configured: false }
  }

  apply() {
    // 预留后续扩展配置写入
  }

  remove() {
    // 预留后续清理
  }

  describe(config) {
    return {
      id: this.toolId,
      name: this.displayName,
      model: config.model || 'gemini-2.5-pro',
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      apiKeyMasked: maskSecret(config.apiKey),
    }
  }
}

module.exports = { GeminiAdapter }

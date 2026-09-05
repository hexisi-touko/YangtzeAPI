const fs = require('node:fs')
const path = require('node:path')
const { parseEnv } = require('node:util')
const { BaseSyncAdapter, atomicWrite, maskSecret, readTextIfExists } = require('./base-sync')

function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Claude 配置为空')
  for (const field of ['apiKey', 'apiBaseUrl', 'model']) {
    if (typeof config[field] !== 'string' || config[field].trim() === '') {
      throw new Error(`Claude 配置缺少 ${field}`)
    }
  }
}

function setEnvValue(text, key, value) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const escaped = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const line = `${key}="${escaped}"`
  let replaced = false
  const output = lines.map((item) => {
    if (new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(item)) {
      replaced = true
      return line
    }
    return item
  })
  if (!replaced) {
    while (output.length && output.at(-1) === '') output.pop()
    output.push(line)
  }
  return `${output.join('\n').replace(/\n+$/, '')}\n`
}

function removeEnvValue(text, key) {
  return `${text.split(/\r?\n/).filter((item) => !new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(item)).join('\n').replace(/\n+$/, '')}\n`
}

class ClaudeAdapter extends BaseSyncAdapter {
  constructor(options) {
    super(options)
    this.format = options.format || 'claude-settings-json'
    this.envPath = path.join(this.homeDir, '.claude', '.env')
    this.settingsPath = path.join(this.homeDir, '.claude', 'settings.json')
  }

  get toolId() { return 'claude-code' }
  get displayName() { return 'Claude Code' }
  get configPaths() { return [this.format === 'claude-env' ? this.envPath : this.settingsPath] }

  getLocalState(config) {
    const filePath = this.configPaths[0]
    if (!fs.existsSync(filePath)) return { configured: false }
    try {
      const text = readTextIfExists(filePath)
      const env = this.format === 'claude-env' ? parseEnv(text) : JSON.parse(text).env
      const fields = { ANTHROPIC_API_KEY: 'apiKey', ANTHROPIC_BASE_URL: 'apiBaseUrl', ANTHROPIC_MODEL: 'model' }
      const configured = Object.entries(fields).every(([key, field]) =>
        typeof env?.[key] === 'string' && env[key].trim() !== '' && (!config || env[key] === config[field]))
      return { configured }
    } catch {
      return { configured: false }
    }
  }

  apply(config) {
    validateConfig(config)
    if (config.format === 'claude-env' || config.format === 'claude-settings-json') this.format = config.format
    if (this.format === 'claude-env') {
      let text = readTextIfExists(this.envPath)
      text = setEnvValue(text, 'ANTHROPIC_API_KEY', config.apiKey)
      text = setEnvValue(text, 'ANTHROPIC_BASE_URL', config.apiBaseUrl)
      text = setEnvValue(text, 'ANTHROPIC_MODEL', config.model)
      atomicWrite(this.envPath, text)
    } else {
      let settings = {}
      const existing = readTextIfExists(this.settingsPath)
      if (existing.trim()) {
        try { settings = JSON.parse(existing) } catch { throw new Error('Claude settings.json 格式无法解析') }
      }
      settings.env = { ...(settings.env || {}), ANTHROPIC_API_KEY: config.apiKey, ANTHROPIC_BASE_URL: config.apiBaseUrl, ANTHROPIC_MODEL: config.model }
      atomicWrite(this.settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
    }
  }

  remove() {
    const filePath = this.configPaths[0]
    if (!fs.existsSync(filePath)) return
    if (this.format === 'claude-env') {
      let text = readTextIfExists(filePath)
      for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL']) text = removeEnvValue(text, key)
      atomicWrite(filePath, text)
    } else {
      const settings = JSON.parse(readTextIfExists(filePath))
      if (settings.env && typeof settings.env === 'object') {
        for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL']) delete settings.env[key]
        atomicWrite(filePath, `${JSON.stringify(settings, null, 2)}\n`)
      }
    }
  }

  describe(config) {
    return {
      id: this.toolId,
      name: this.displayName,
      model: config.model,
      availableModels: config.availableModels || [],
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      apiKeyMasked: maskSecret(config.apiKey),
    }
  }
}

module.exports = { ClaudeAdapter }

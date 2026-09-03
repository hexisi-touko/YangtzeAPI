const fs = require('node:fs')
const path = require('node:path')
const { BaseSyncAdapter, atomicWrite, maskSecret, readTextIfExists } = require('./base-sync')

const MANAGED_START = '# BEGIN YANGTZEAPI MANAGED CODEX'
const MANAGED_END = '# END YANGTZEAPI MANAGED CODEX'

function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Codex 配置为空')
  for (const field of ['apiKey', 'apiBaseUrl', 'model']) {
    if (typeof config[field] !== 'string' || config[field].trim() === '') throw new Error(`Codex 配置缺少 ${field}`)
  }
}

function tomlString(value) { return JSON.stringify(String(value)) }

function mergeToml(existing, config) {
  let text = existing.replace(new RegExp(`${MANAGED_START}[\\s\\S]*?${MANAGED_END}\\n?`, 'g'), '')
  text = text.replace(/# BEGIN YANGTZEAPI[\s\S]*?# END YANGTZEAPI\n?/g, '')
  text = text.replace(/\[model_providers\.(?:custom|yangtzeapi)\][\s\S]*?(?=\n\[|\Z)/g, '')

  const firstSectionIdx = text.search(/^\s*\[/m)
  let topText = firstSectionIdx >= 0 ? text.slice(0, firstSectionIdx) : text
  let restText = firstSectionIdx >= 0 ? text.slice(firstSectionIdx) : ''

  const managedKeys = new Set([
    'model_provider',
    'model',
    'model_reasoning_effort',
    'disable_response_storage',
    'windows_wsl_setup_acknowledged',
    'experimental_bearer_token',
    'base_url',
    'wire_api',
  ])

  const cleanTopLines = topText
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=/)
      if (!match) return false // 过滤非合法键值行
      if (managedKeys.has(match[1])) return false
      return true
    })
    .map((l) => l.trim())
    .filter(Boolean)

  const topBlock = [
    'model_provider = "custom"',
    `model = ${tomlString(config.model)}`,
    'model_reasoning_effort = "high"',
    'disable_response_storage = true',
    'windows_wsl_setup_acknowledged = true',
    ...cleanTopLines,
  ].join('\n')

  const managedSection = [
    '',
    MANAGED_START,
    '[model_providers.custom]',
    'name = "custom"',
    `base_url = ${tomlString(config.apiBaseUrl)}`,
    'wire_api = "responses"',
    'requires_openai_auth = false',
    `experimental_bearer_token = ${tomlString(config.apiKey)}`,
    MANAGED_END,
  ].join('\n')

  return `${topBlock}\n\n${restText.trim()}\n\n${managedSection.trim()}\n`
}

class CodexAdapter extends BaseSyncAdapter {
  constructor(options) {
    super(options)
    this.authPath = path.join(this.homeDir, '.codex', 'auth.json')
    this.configPath = path.join(this.homeDir, '.codex', 'config.toml')
  }

  get toolId() { return 'codex-gpt' }
  get displayName() { return 'Codex (ChatGPT)' }
  get configPaths() { return [this.authPath, this.configPath] }

  getLocalState() {
    if (!fs.existsSync(this.configPath)) return { configured: false }
    const content = readTextIfExists(this.configPath)
    return { configured: content.includes(MANAGED_START) }
  }

  apply(config) {
    validateConfig(config)
    let auth = {}
    const existing = readTextIfExists(this.authPath)
    if (existing.trim()) {
      try { auth = JSON.parse(existing) } catch { throw new Error('Codex auth.json 格式无法解析') }
    }
    auth.OPENAI_API_KEY = config.apiKey
    atomicWrite(this.authPath, `${JSON.stringify(auth, null, 2)}\n`)
    atomicWrite(this.configPath, mergeToml(readTextIfExists(this.configPath), config))
  }

  remove() {
    if (fs.existsSync(this.authPath)) {
      try {
        const auth = JSON.parse(readTextIfExists(this.authPath))
        delete auth.OPENAI_API_KEY
        atomicWrite(this.authPath, `${JSON.stringify(auth, null, 2)}\n`)
      } catch {
        // 忽略旧文件格式错误
      }
    }
    if (fs.existsSync(this.configPath)) {
      const text = readTextIfExists(this.configPath).replace(new RegExp(`\\n?${MANAGED_START}[\\s\\S]*?${MANAGED_END}\\n?`, 'g'), '\n')
      atomicWrite(this.configPath, text)
    }
  }

  describe(config) {
    return {
      id: this.toolId,
      name: this.displayName,
      model: config.model,
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      apiKeyMasked: maskSecret(config.apiKey),
    }
  }
}

module.exports = { CodexAdapter, mergeToml }

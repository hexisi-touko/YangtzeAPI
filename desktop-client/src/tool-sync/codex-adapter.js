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
  const withoutBlock = existing.replace(new RegExp(`${MANAGED_START}[\\s\\S]*?${MANAGED_END}\\n?`, 'g'), '')
  const lines = withoutBlock.split(/\r?\n/)
  let table = ''
  const filtered = lines.filter((line) => {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/)
    if (section) table = section[1]
    if (table === '' && /^\s*(model_provider|model)\s*=/.test(line)) return false
    return true
  })
  while (filtered.length && filtered.at(-1) === '') filtered.pop()
  filtered.push(
    '',
    MANAGED_START,
    'model_provider = "yangtzeapi"',
    `model = ${tomlString(config.model)}`,
    'model_reasoning_effort = "medium"',
    'disable_response_storage = true',
    '[model_providers.yangtzeapi]',
    'name = "yangtzeapi"',
    `base_url = ${tomlString(config.apiBaseUrl)}`,
    'wire_api = "responses"',
    'requires_openai_auth = false',
    `experimental_bearer_token = ${tomlString(config.apiKey)}`,
    MANAGED_END
  )
  return `${filtered.join('\n')}\n`
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

const fs = require('node:fs')
const path = require('node:path')
const TOML = require('@iarna/toml')
const { BaseSyncAdapter, atomicWrite, maskSecret, readTextIfExists } = require('./base-sync')

const MANAGED_START = '# BEGIN YANGTZEAPI MANAGED CODEX'
const MANAGED_END = '# END YANGTZEAPI MANAGED CODEX'
const MANAGED_KEYS = ['model', 'model_provider', 'model_catalog_json', 'model_reasoning_effort', 'model_context_window', 'model_auto_compact_token_limit', 'model_supports_reasoning_summaries']

function parseConfig(text) { return text.trim() ? TOML.parse(text) : {} }

// Only advertise documented levels; arbitrary aliases need upstream capability metadata.
function reasoningProfile(model) {
  if (['kimi-k3', 'kimi-k3-256k'].includes(model)) return { levels: ['low', 'high', 'max'], default: 'max' }
  if (['gpt-5.6-terra', 'gpt-5.6-luna'].includes(model)) return { levels: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], default: 'medium' }
  if (model === 'gpt-5.5') return { levels: ['none', 'low', 'medium', 'high', 'xhigh'], default: 'medium' }
  return { levels: [], default: null }
}

function buildCatalog(models, providerName = 'API') {
  return { models: models.map((slug, priority) => ({
    slug, display_name: slug.startsWith('kimi-') ? `Kimi · ${slug.slice(5)}` : slug,
    description: providerName, priority, visibility: 'list', supported_in_api: true,
    default_reasoning_level: reasoningProfile(slug).default,
    supported_reasoning_levels: reasoningProfile(slug).levels.map((effort) => ({ effort, description: effort })),
    shell_type: 'unified_exec', supports_reasoning_summaries: false,
    supports_reasoning_summary_parameter: false, default_reasoning_summary: 'none',
    support_verbosity: false, default_verbosity: null, apply_patch_tool_type: null,
    truncation_policy: { mode: 'bytes', limit: 10000 },
    input_modalities: ['text'], experimental_supported_tools: [],
    supports_parallel_tool_calls: false, prefer_websockets: false,
    base_instructions: 'You are a coding assistant. Inspect the workspace, use the provided tools to complete the user task, and verify your changes.',
    model_messages: { instructions_template: 'You are a coding assistant. Inspect the workspace, use the provided tools to complete the user task, and verify your changes.' },
  })) }
}

function mergeToml(existing, config) {
  const doc = parseConfig(existing)
  const profile = reasoningProfile(config.model)
  const previousEffort = doc.model === config.model ? doc.model_reasoning_effort : null
  for (const key of MANAGED_KEYS) delete doc[key]
  doc.model_provider = 'custom'
  doc.model = config.model
  doc.model_catalog_json = config.catalogPath
  const effort = profile.levels.includes(previousEffort) ? previousEffort : profile.default
  if (effort) doc.model_reasoning_effort = effort
  doc.model_supports_reasoning_summaries = false
  doc.model_providers ||= {}
  doc.model_providers.custom = {
    name: config.providerName || 'API', base_url: config.apiBaseUrl, wire_api: 'responses',
    requires_openai_auth: false, experimental_bearer_token: config.apiKey,
    supports_websockets: false,
  }
  return `${MANAGED_START}\n${TOML.stringify(doc)}\n${MANAGED_END}\n`
}

class CodexAdapter extends BaseSyncAdapter {
  constructor(options) {
    super(options)
    const directory = options.codexHome || path.join(this.homeDir, '.codex')
    this.authPath = path.join(directory, 'auth.json')
    this.configPath = path.join(directory, 'config.toml')
    this.catalogPath = path.join(directory, 'yangtze-model-catalog.json')
    this.backupPath = path.join(directory, 'yangtze-config-backup.json')
  }

  get toolId() { return 'codex-gpt' }
  get displayName() { return 'Codex' }
  get configPaths() { return [this.authPath, this.configPath, this.catalogPath] }

  getLocalState(config) {
    const text = readTextIfExists(this.configPath)
    const doc = parseConfig(text)
    const provider = doc.model_providers?.custom
    const matches = !config || (doc.model === config.model && provider?.base_url === config.apiBaseUrl && provider?.experimental_bearer_token === config.apiKey && provider?.name === (config.providerName || 'API'))
    return { configured: text.includes(MANAGED_START) && matches, model: doc.model }
  }

  apply(config) {
    if (!config || ['apiKey', 'apiBaseUrl', 'model'].some((key) => typeof config[key] !== 'string' || !config[key].trim())) {
      throw new Error('Codex 配置不完整')
    }
    const models = [...new Set(config.availableModels || [config.model])]
    if (!models.includes(config.model)) throw new Error('默认模型必须包含在授权模型中')
    const existing = readTextIfExists(this.configPath)
    const doc = parseConfig(existing)
    const oldAuth = readTextIfExists(this.authPath)
    const auth = oldAuth.trim() ? JSON.parse(oldAuth) : {}
    const catalog = JSON.stringify(buildCatalog(models, config.providerName), null, 2)
    const toml = mergeToml(existing, { ...config, catalogPath: this.catalogPath })
    const snapshots = [...this.configPaths, this.backupPath].map((file) => ({ file, exists: fs.existsSync(file), text: readTextIfExists(file) }))
    try {
      if (!fs.existsSync(this.backupPath)) {
        const keys = Object.fromEntries(MANAGED_KEYS.filter((key) => Object.hasOwn(doc, key)).map((key) => [key, doc[key]]))
        atomicWrite(this.backupPath, JSON.stringify({ keys, custom: doc.model_providers?.custom, apiKey: auth.OPENAI_API_KEY }))
      }
      auth.OPENAI_API_KEY = config.apiKey
      atomicWrite(this.catalogPath, `${catalog}\n`)
      atomicWrite(this.authPath, `${JSON.stringify(auth, null, 2)}\n`)
      atomicWrite(this.configPath, toml)
    } catch (error) {
      for (const snapshot of snapshots) {
        if (snapshot.exists) atomicWrite(snapshot.file, snapshot.text)
        else fs.rmSync(snapshot.file, { force: true })
      }
      throw error
    }
  }

  remove() {
    const existing = readTextIfExists(this.configPath)
    if (!existing.includes(MANAGED_START)) return
    const doc = parseConfig(existing)
    const backupText = readTextIfExists(this.backupPath)
    const backup = backupText ? JSON.parse(backupText) : { keys: {} }
    for (const key of MANAGED_KEYS) delete doc[key]
    Object.assign(doc, backup.keys)
    if (doc.model_providers) {
      delete doc.model_providers.custom
      if (backup.custom) doc.model_providers.custom = backup.custom
    }
    const auth = JSON.parse(readTextIfExists(this.authPath) || '{}')
    delete auth.OPENAI_API_KEY
    if (backup.apiKey !== undefined) auth.OPENAI_API_KEY = backup.apiKey
    atomicWrite(this.configPath, TOML.stringify(doc))
    atomicWrite(this.authPath, `${JSON.stringify(auth, null, 2)}\n`)
    fs.rmSync(this.catalogPath, { force: true })
    fs.rmSync(this.backupPath, { force: true })
  }

  describe(config) {
    return { id: this.toolId, name: this.displayName, model: config.model,
      providerName: config.providerName || 'API',
      apiBaseUrl: config.apiBaseUrl, apiKey: config.apiKey, apiKeyMasked: maskSecret(config.apiKey),
      availableModels: config.availableModels || [] }
  }
}

module.exports = { CodexAdapter, mergeToml, buildCatalog }

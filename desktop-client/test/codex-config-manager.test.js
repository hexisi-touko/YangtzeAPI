const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const TOML = require('@iarna/toml')
const { CodexConfigError, CodexConfigManager } = require('../src/codex-config-manager')

function createTestHome(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yangtze-codex-'))
  const codexHome = path.join(root, '.codex')
  const ccSwitchHome = path.join(root, '.cc-switch')
  fs.mkdirSync(codexHome)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return { codexHome, ccSwitchHome }
}

test('configure preserves CC Switch providers, comments, and official login', (t) => {
  const { codexHome, ccSwitchHome } = createTestHome(t)
  const configPath = path.join(codexHome, 'config.toml')
  const authPath = path.join(codexHome, 'auth.json')
  const originalConfig = `# keep this comment
model_provider = "custom" # switched by CC Switch
model = "existing-model"

[model_providers.custom]
name = "Existing provider"
base_url = "https://existing.example/v1"
wire_api = "responses"
experimental_bearer_token = "sk-existing-provider"

[features]
js_repl = false # keep feature note
`
  const originalAuth = `${JSON.stringify({
    auth_mode: 'chatgpt',
    tokens: { access_token: 'official-login-token' },
    last_refresh: '2026-09-01T00:00:00Z',
  }, null, 2)}\n`
  fs.writeFileSync(configPath, originalConfig)
  fs.writeFileSync(authPath, originalAuth)
  fs.mkdirSync(ccSwitchHome)
  fs.writeFileSync(path.join(ccSwitchHome, 'settings.json'), '{}\n')

  const manager = new CodexConfigManager({
    codexHome,
    ccSwitchHome,
    serverUrl: 'https://api.example.com',
    providerName: '测试中转站',
  })
  const before = manager.inspect()
  const result = manager.configure('sk-member-key')
  const text = fs.readFileSync(configPath, 'utf8')
  const config = TOML.parse(text)

  assert.equal(before.ccSwitchDetected, true)
  assert.equal(before.externalProviderActive, true)
  assert.equal(result.configured, true)
  assert.equal(result.backupCreated, true)
  assert.equal(result.officialLoginPreserved, true)
  assert.equal(result.keyStorage, 'provider')
  assert.equal(result.externalProviderActive, false)
  assert.equal(config.model, 'existing-model')
  assert.equal(config.features.js_repl, false)
  assert.equal(config.model_provider, 'yangtze_api')
  assert.equal(config.model_providers.custom.experimental_bearer_token, 'sk-existing-provider')
  assert.equal(config.model_providers.yangtze_api.base_url, 'https://api.example.com/v1')
  assert.equal(config.model_providers.yangtze_api.experimental_bearer_token, 'sk-member-key')
  assert.equal(config.model_providers.yangtze_api.requires_openai_auth, true)
  assert.match(text, /^# keep this comment/m)
  assert.match(text, /# switched by CC Switch/)
  assert.match(text, /# keep feature note/)
  assert.equal(fs.readFileSync(authPath, 'utf8'), originalAuth)
  assert.equal(fs.readdirSync(path.join(codexHome, '.yangtze-backups')).length, 1)
  assert.equal(JSON.stringify(result).includes('sk-member-key'), false)
})

test('configure creates a standalone provider without creating auth.json', (t) => {
  const { codexHome, ccSwitchHome } = createTestHome(t)
  const manager = new CodexConfigManager({
    codexHome,
    ccSwitchHome,
    serverUrl: 'https://api.example.com',
  })

  const first = manager.configure('sk-first-key')
  const second = manager.configure('sk-second-key')
  const configText = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8')
  const config = TOML.parse(configText)

  assert.equal(first.backupCreated, false)
  assert.equal(second.backupCreated, true)
  assert.equal(config.model_provider, 'yangtze_api')
  assert.equal(config.model_providers.yangtze_api.experimental_bearer_token, 'sk-second-key')
  assert.equal(config.model_providers.yangtze_api.requires_openai_auth, false)
  assert.equal((configText.match(/\[model_providers\.yangtze_api\]/g) || []).length, 1)
  assert.equal(fs.existsSync(path.join(codexHome, 'auth.json')), false)
})

test('configure upgrades the legacy auth.json provider without changing auth.json or MCP settings', (t) => {
  const { codexHome, ccSwitchHome } = createTestHome(t)
  const configPath = path.join(codexHome, 'config.toml')
  const authPath = path.join(codexHome, 'auth.json')
  fs.writeFileSync(
    configPath,
    `model_provider = "yangtze_api"

[model_providers.yangtze_api]
name = "Legacy"
base_url = "https://api.example.com/v1"
wire_api = "responses"
requires_openai_auth = true

[mcp_servers.demo]
command = "demo-command"
`,
  )
  const originalAuth = '{"OPENAI_API_KEY":"sk-legacy-key","OTHER_SECRET":"keep-me"}\n'
  fs.writeFileSync(authPath, originalAuth)
  const manager = new CodexConfigManager({ codexHome, ccSwitchHome, serverUrl: 'https://api.example.com' })

  const before = manager.inspect('sk-legacy-key')
  const result = manager.configure('sk-new-key')
  const config = TOML.parse(fs.readFileSync(configPath, 'utf8'))

  assert.equal(before.legacyConfiguration, true)
  assert.equal(before.configured, true)
  assert.equal(result.legacyConfiguration, false)
  assert.equal(result.configured, true)
  assert.equal(config.model_providers.yangtze_api.experimental_bearer_token, 'sk-new-key')
  assert.equal(config.model_providers.yangtze_api.requires_openai_auth, false)
  assert.equal(config.mcp_servers.demo.command, 'demo-command')
  assert.equal(fs.readFileSync(authPath, 'utf8'), originalAuth)
})

test('inspect detects a mismatched server key without exposing either key', (t) => {
  const { codexHome, ccSwitchHome } = createTestHome(t)
  const manager = new CodexConfigManager({ codexHome, ccSwitchHome, serverUrl: 'https://api.example.com' })
  manager.configure('sk-first-key')

  const unchecked = manager.inspect()
  assert.equal(unchecked.keyPresent, true)
  assert.equal(unchecked.keyConfigured, false)
  assert.equal(unchecked.configured, false)

  const result = manager.inspect('sk-second-key')
  assert.equal(result.providerConfigured, true)
  assert.equal(result.keyConfigured, false)
  assert.equal(result.configured, false)
  assert.equal(JSON.stringify(result).includes('sk-first-key'), false)
  assert.equal(JSON.stringify(result).includes('sk-second-key'), false)
})

test('unsupported inline provider configuration is rejected without changing files', (t) => {
  const { codexHome, ccSwitchHome } = createTestHome(t)
  const configPath = path.join(codexHome, 'config.toml')
  const original = `model_provider = "yangtze_api"
model_providers = { yangtze_api = { name = "Inline", base_url = "https://old.example/v1", wire_api = "responses" } }
`
  fs.writeFileSync(configPath, original)
  const manager = new CodexConfigManager({ codexHome, ccSwitchHome, serverUrl: 'https://api.example.com' })

  assert.throws(
    () => manager.configure('sk-new-key'),
    (error) => error instanceof CodexConfigError && error.code === 'UNSUPPORTED_CODEX_TOML',
  )
  assert.equal(fs.readFileSync(configPath, 'utf8'), original)
  assert.equal(fs.existsSync(path.join(codexHome, '.yangtze-backups')), false)
})

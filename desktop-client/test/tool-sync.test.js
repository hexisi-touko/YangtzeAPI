const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { ClaudeAdapter } = require('../src/tool-sync/claude-adapter')
const { CodexAdapter } = require('../src/tool-sync/codex-adapter')
const { ToolSyncManager } = require('../src/tool-sync/manager')
const TOML = require('@iarna/toml')

function tempHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'yangtze-tools-')) }
function config(id = 'codex-gpt') { return { id, apiKey: 'sk-secret-value', apiBaseUrl: 'https://relay.example.com/v1', model: 'gpt-5.2' } }

test('Claude state requires matching credentials and remains disabled after removal', () => {
  for (const format of ['claude-settings-json', 'claude-env']) {
    const adapter = new ClaudeAdapter({ homeDir: tempHome(), format })
    const expected = config('claude-code')
    const file = adapter.configPaths[0]
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, format === 'claude-env' ? 'OTHER="keep"\n' : '{"permissions":{"allow":["Read"]}}')
    assert.equal(adapter.getLocalState(expected).configured, false)
    adapter.apply(expected)
    assert.equal(adapter.getLocalState(expected).configured, true)
    for (const field of ['apiKey', 'apiBaseUrl', 'model']) {
      assert.equal(adapter.getLocalState({ ...expected, [field]: 'different' }).configured, false)
    }
    adapter.remove()
    assert.equal(fs.existsSync(file), true)
    assert.equal(adapter.getLocalState(expected).configured, false)
    fs.writeFileSync(file, 'broken = [')
    assert.equal(adapter.getLocalState(expected).configured, false)
  }
})

test('Claude accepts the account-wide model list and persists a Kimi default', () => {
  const homeDir = tempHome()
  const adapter = new ClaudeAdapter({ homeDir })
  const manager = new ToolSyncManager({ adapters: new Map([['claude-code', adapter]]) })
  manager.setAccountScope('server:alice', 'alice')
  const server = { id: 'claude-code', api_key: 'sk-secret', api_base_url: 'https://relay.example.com', model: 'claude-sonnet', available_models: ['gpt-5.6-terra', 'kimi-k3', 'kimi-k2.6'] }
  manager.setServerConfigs([server])
  manager.applyModels('claude-code', { model: 'kimi-k3' }, server.available_models)
  const settings = JSON.parse(fs.readFileSync(path.join(homeDir, '.claude', 'settings.json'), 'utf8'))
  assert.equal(settings.env.ANTHROPIC_MODEL, 'kimi-k3')
  assert.deepEqual(manager.getState()[0].availableModels, server.available_models)
})

test('Claude adapter preserves unrelated settings and removes only managed env values', () => {
  const homeDir = tempHome()
  const adapter = new ClaudeAdapter({ homeDir, format: 'claude-settings-json' })
  const filePath = path.join(homeDir, '.claude', 'settings.json')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify({ permissions: { allow: ['Read'] }, env: { OTHER: 'keep' } }))
  adapter.apply(config('claude-code'))
  const written = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  assert.equal(written.permissions.allow[0], 'Read')
  assert.equal(written.env.ANTHROPIC_API_KEY, 'sk-secret-value')
  adapter.remove()
  const removed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  assert.equal(removed.env.OTHER, 'keep')
  assert.equal(removed.env.ANTHROPIC_API_KEY, undefined)
})

test('Codex adapter writes auth.json and a managed TOML block', () => {
  const homeDir = tempHome()
  const adapter = new CodexAdapter({ homeDir })
  adapter.apply(config())
  const auth = JSON.parse(fs.readFileSync(path.join(homeDir, '.codex', 'auth.json'), 'utf8'))
  const toml = fs.readFileSync(path.join(homeDir, '.codex', 'config.toml'), 'utf8')
  assert.equal(auth.OPENAI_API_KEY, 'sk-secret-value')
  assert.match(toml, /model_provider = "custom"/)
  assert.match(toml, /base_url = "https:\/\/relay\.example\.com\/v1"/)
  assert.match(toml, /experimental_bearer_token = "sk-secret-value"/)
  assert.equal(adapter.getLocalState().configured, true)
  adapter.remove()
  assert.equal(JSON.parse(fs.readFileSync(path.join(homeDir, '.codex', 'auth.json'), 'utf8')).OPENAI_API_KEY, undefined)
  assert.equal(adapter.getLocalState().configured, false)
})

test('Codex catalog contains all authorized models and restores previous settings on disable', () => {
  const adapter = new CodexAdapter({ homeDir: tempHome() })
  fs.mkdirSync(path.dirname(adapter.configPath), { recursive: true })
  const original = { model: 'original', model_reasoning_effort: 'high', model_context_window: 900000,
    model_catalog_json: 'original.json', model_providers: { custom: { name: 'previous' }, other: { name: 'keep' } },
    projects: { 'D:\\work': { trust_level: 'trusted' } } }
  fs.writeFileSync(adapter.configPath, TOML.stringify(original))
  fs.writeFileSync(adapter.authPath, JSON.stringify({ OPENAI_API_KEY: 'old-key', tokens: { access_token: 'keep' } }))
  adapter.apply({ ...config(), model: 'kimi-k3', availableModels: ['kimi-k3', 'gpt-5.6-terra'] })
  adapter.apply({ ...config(), model: 'kimi-k3', availableModels: ['kimi-k3', 'gpt-5.6-terra'], selectedModels: ['kimi-k3'] })
  const written = TOML.parse(fs.readFileSync(adapter.configPath, 'utf8'))
  assert.equal(written.model, 'kimi-k3')
  assert.equal(written.model_reasoning_effort, 'max')
  assert.equal(written.model_context_window, undefined)
  const catalog = JSON.parse(fs.readFileSync(written.model_catalog_json, 'utf8'))
  assert.deepEqual(catalog.models.map((m) => m.slug), ['kimi-k3', 'gpt-5.6-terra'])
  assert.equal(catalog.models[0].display_name, 'Kimi · k3')
  assert.deepEqual(catalog.models[0].supported_reasoning_levels.map((level) => level.effort), ['low', 'high', 'max'])
  assert.equal(written.projects['D:\\work'].trust_level, 'trusted')
  written.projects['D:\\new'] = { trust_level: 'trusted' }
  fs.writeFileSync(adapter.configPath, '# BEGIN YANGTZEAPI MANAGED CODEX\n' + TOML.stringify(written))
  adapter.remove()
  const restored = TOML.parse(fs.readFileSync(adapter.configPath, 'utf8'))
  assert.equal(restored.model, original.model)
  assert.equal(restored.model_context_window, 900000)
  assert.deepEqual(restored.model_providers, original.model_providers)
  assert.equal(restored.projects['D:\\new'].trust_level, 'trusted')
  assert.equal(JSON.parse(fs.readFileSync(adapter.authPath, 'utf8')).OPENAI_API_KEY, 'old-key')
  assert.equal(fs.existsSync(adapter.catalogPath), false)
})

test('Codex sync preserves valid effort and repairs incompatible effort for the selected model', () => {
  const adapter = new CodexAdapter({ homeDir: tempHome() })
  const kimi = { ...config(), model: 'kimi-k3-256k', providerName: 'alice', availableModels: ['kimi-k3-256k', 'gpt-5.5', 'kimi-k2'] }
  adapter.apply(kimi)
  const read = () => TOML.parse(fs.readFileSync(adapter.configPath, 'utf8'))
  assert.equal(read().model_providers.custom.name, 'alice')
  for (const effort of ['low', 'high', 'max', 'medium']) {
    fs.writeFileSync(adapter.configPath, TOML.stringify({ ...read(), model_reasoning_effort: effort }))
    adapter.apply(kimi)
    assert.equal(read().model_reasoning_effort, effort === 'medium' ? 'max' : effort)
  }
  adapter.apply({ ...kimi, model: 'gpt-5.5' })
  assert.equal(read().model_reasoning_effort, 'medium')
  adapter.apply({ ...kimi, model: 'kimi-k2' })
  assert.equal(read().model_reasoning_effort, undefined)
  assert.equal(JSON.parse(fs.readFileSync(adapter.catalogPath)).models[2].supported_reasoning_levels.length, 0)
})

test('invalid existing Codex configuration is rejected before writing any files', () => {
  const adapter = new CodexAdapter({ homeDir: tempHome() })
  fs.mkdirSync(path.dirname(adapter.configPath), { recursive: true })
  fs.writeFileSync(adapter.configPath, 'broken = [')
  assert.throws(() => adapter.apply(config()))
  assert.equal(fs.readFileSync(adapter.configPath, 'utf8'), 'broken = [')
  assert.equal(fs.existsSync(adapter.authPath), false)
  assert.equal(fs.existsSync(adapter.catalogPath), false)
})

test('model selection survives restart, isolates accounts, and rejects unauthorized models', () => {
  const directory = tempHome()
  const preferencesPath = path.join(directory, 'preferences.json')
  const adapter = new CodexAdapter({ homeDir: directory })
  const options = { preferencesPath, adapters: new Map([['codex-gpt', adapter]]) }
  const server = { id: 'codex-gpt', api_key: 'sk-secret', api_base_url: 'https://relay.example.com/v1', model: 'gpt-5.6-terra', available_models: ['gpt-5.6-terra', 'kimi-k3'] }
  let manager = new ToolSyncManager(options)
  manager.setAccountScope('server:alice', 'alice')
  manager.setServerConfigs([server, { ...server, id: 'bad id' }])
  assert.equal(manager.serverConfigs.has('bad id'), false)
  manager.applyModels('codex-gpt', { model: 'kimi-k3' }, server.available_models)
  assert.equal(TOML.parse(fs.readFileSync(adapter.configPath, 'utf8')).model_providers.custom.name, 'alice')
  assert.equal(manager.getState()[0].providerName, 'alice')
  assert.deepEqual(JSON.parse(fs.readFileSync(adapter.catalogPath, 'utf8')).models.map((m) => m.slug), server.available_models)
  manager = new ToolSyncManager(options)
  manager.setAccountScope('server:alice', 'alice')
  manager.setServerConfigs([server])
  assert.equal(manager.getState()[0].model, 'kimi-k3')
  assert.deepEqual(manager.getState()[0].availableModels, server.available_models)
  assert.throws(() => manager.applyModels('codex-gpt', { model: 'unknown', selectedModels: ['unknown'] }, server.available_models))
  assert.equal(TOML.parse(fs.readFileSync(adapter.configPath, 'utf8')).model, 'kimi-k3')
  manager.setAccountScope('server:bob', 'bob')
  manager.setServerConfigs([server])
  assert.equal(manager.getState()[0].model, server.model)
  assert.equal(manager.getState()[0].status, 'disabled')
  manager.applyModels('codex-gpt', { model: 'kimi-k3' }, server.available_models)
  assert.equal(TOML.parse(fs.readFileSync(adapter.configPath, 'utf8')).model_providers.custom.name, 'bob')
  assert.doesNotMatch(fs.readFileSync(preferencesPath, 'utf8'), /sk-secret/)
  assert.doesNotMatch(fs.readFileSync(preferencesPath, 'utf8'), /selectedModels/)
})

test('legacy checkbox preferences do not hide models and a removed default falls back to an authorized model', () => {
  const directory = tempHome()
  const preferencesPath = path.join(directory, 'preferences.json')
  fs.writeFileSync(preferencesPath, JSON.stringify({ alice: { 'codex-gpt': { model: 'removed', selectedModels: ['removed'] } } }))
  const adapter = new CodexAdapter({ homeDir: directory })
  const manager = new ToolSyncManager({ preferencesPath, adapters: new Map([['codex-gpt', adapter]]) })
  manager.setAccountScope('alice')
  const server = { id: 'codex-gpt', api_key: 'sk-secret', api_base_url: 'https://relay.example.com/v1', model: 'removed', available_models: ['kimi-k3', 'new-model'] }
  manager.setServerConfigs([server])
  assert.equal(manager.getState()[0].model, 'kimi-k3')
  manager.enable('codex-gpt', server)
  assert.deepEqual(JSON.parse(fs.readFileSync(adapter.catalogPath, 'utf8')).models.map((m) => m.slug), server.available_models)
  assert.throws(() => manager.applyModels('codex-gpt', { model: 'kimi-k3' }, []))
  assert.equal(JSON.parse(fs.readFileSync(adapter.catalogPath, 'utf8')).models.length, 2)
})

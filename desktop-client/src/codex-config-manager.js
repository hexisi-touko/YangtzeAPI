const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const TOML = require('@iarna/toml')

const PROVIDER_ID = 'yangtze_api'
const PROBE_KEY = '__yangtze_table_probe__'

class CodexConfigError extends Error {
  constructor(message, code = 'CODEX_CONFIG_ERROR') {
    super(message)
    this.name = 'CodexConfigError'
    this.code = code
  }
}

function readConfigText(filePath) {
  if (!fs.existsSync(filePath)) return ''
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    throw new CodexConfigError(`无法读取 Codex 配置：${error.message}`, 'CODEX_READ_FAILED')
  }
}

function parseToml(text) {
  if (!text.trim()) return {}
  try {
    return TOML.parse(text)
  } catch {
    throw new CodexConfigError('Codex 的 config.toml 格式有误，未修改任何配置', 'INVALID_CODEX_TOML')
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {}
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid object')
    return parsed
  } catch {
    throw new CodexConfigError('Codex 的 auth.json 格式有误，未修改任何配置', 'INVALID_CODEX_AUTH')
  }
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

function tomlString(value) {
  return JSON.stringify(String(value))
}

function tableBoundary(line) {
  return /^\s*\[\[?.*\]\]?\s*(?:#.*)?$/.test(line)
}

function findProbePath(value, currentPath = []) {
  if (!value || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    if (key === PROBE_KEY) return currentPath
    const found = findProbePath(child, [...currentPath, key])
    if (found) return found
  }
  return null
}

function tableHeaderPath(line) {
  const match = line.match(/^\s*(\[(?!\[).+\])\s*(?:#.*)?$/)
  if (!match) return null
  try {
    return findProbePath(TOML.parse(`${match[1]}\n${PROBE_KEY} = true\n`))
  } catch {
    return null
  }
}

function unquotedCommentIndex(line) {
  let quote = ''
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (quote === '"' && character === '\\' && !escaped) {
      escaped = true
      continue
    }
    if ((character === '"' || character === "'") && !escaped) {
      if (!quote) quote = character
      else if (quote === character) quote = ''
    }
    if (character === '#' && !quote) return index
    escaped = false
  }
  return -1
}

function replaceActiveProvider(lines, parsedConfig) {
  const firstTable = lines.findIndex(tableBoundary)
  const topLevelEnd = firstTable === -1 ? lines.length : firstTable
  const matches = []

  for (let index = 0; index < topLevelEnd; index += 1) {
    const commentIndex = unquotedCommentIndex(lines[index])
    const assignment = commentIndex === -1 ? lines[index] : lines[index].slice(0, commentIndex)
    if (/^\s*model_provider\s*=/.test(assignment)) matches.push({ index, commentIndex })
  }

  if (matches.length === 0 && parsedConfig.model_provider !== undefined) {
    throw new CodexConfigError(
      'config.toml 使用了客户端暂不支持的 model_provider 写法，未修改配置',
      'UNSUPPORTED_CODEX_TOML',
    )
  }

  if (matches.length > 0) {
    const { index, commentIndex } = matches[0]
    const indent = lines[index].match(/^\s*/)?.[0] || ''
    const comment = commentIndex === -1 ? '' : ` ${lines[index].slice(commentIndex).trimStart()}`
    lines[index] = `${indent}model_provider = ${tomlString(PROVIDER_ID)}${comment}`
    return lines
  }

  const insertionIndex = firstTable === -1 ? lines.length : firstTable
  const inserted = [`model_provider = ${tomlString(PROVIDER_ID)}`]
  if (insertionIndex < lines.length && lines[insertionIndex - 1]?.trim()) inserted.push('')
  lines.splice(insertionIndex, 0, ...inserted)
  return lines
}

function removeManagedProviderSections(lines, parsedConfig) {
  const headers = []
  for (let index = 0; index < lines.length; index += 1) {
    if (tableBoundary(lines[index])) headers.push({ index, path: tableHeaderPath(lines[index]) })
  }

  const managedHeaders = headers.filter(
    (header) => header.path?.[0] === 'model_providers' && header.path?.[1] === PROVIDER_ID,
  )
  const existingProvider = parsedConfig.model_providers?.[PROVIDER_ID]
  if (existingProvider !== undefined && managedHeaders.length === 0) {
    throw new CodexConfigError(
      '长江 API 供应商使用了客户端暂不支持的内联 TOML 写法，未修改配置',
      'UNSUPPORTED_CODEX_TOML',
    )
  }

  const ranges = managedHeaders.map((header) => {
    const nextHeader = headers.find((candidate) => candidate.index > header.index)
    return { start: header.index, end: nextHeader?.index ?? lines.length }
  })
  for (const range of ranges.reverse()) lines.splice(range.start, range.end - range.start)
  return lines
}

function buildManagedConfig(currentText, parsedConfig, { baseUrl, providerName, apiKey, preserveLogin }) {
  const eol = currentText.includes('\r\n') ? '\r\n' : '\n'
  const lines = currentText ? currentText.split(/\r?\n/) : []
  replaceActiveProvider(lines, parsedConfig)
  removeManagedProviderSections(lines, parsedConfig)
  while (lines.length > 0 && !lines.at(-1).trim()) lines.pop()

  if (lines.length > 0) lines.push('')
  lines.push(
    `[model_providers.${PROVIDER_ID}]`,
    `name = ${tomlString(providerName)}`,
    `base_url = ${tomlString(baseUrl)}`,
    'wire_api = "responses"',
    `experimental_bearer_token = ${tomlString(apiKey)}`,
    `requires_openai_auth = ${preserveLogin ? 'true' : 'false'}`,
  )

  const result = `${lines.join(eol)}${eol}`
  const parsedResult = parseToml(result)
  const provider = parsedResult.model_providers?.[PROVIDER_ID]
  if (
    parsedResult.model_provider !== PROVIDER_ID ||
    provider?.base_url !== baseUrl ||
    provider?.wire_api !== 'responses' ||
    provider?.experimental_bearer_token !== apiKey
  ) {
    throw new CodexConfigError('生成的 Codex 配置校验失败，未修改任何文件', 'CODEX_CONFIG_VALIDATION_FAILED')
  }
  return result
}

function hasOfficialLogin(auth) {
  return (
    auth.auth_mode === 'chatgpt' &&
    auth.tokens &&
    typeof auth.tokens === 'object' &&
    !Array.isArray(auth.tokens)
  )
}

function fileContents(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null
}

function writeTextAtomic(filePath, contents, expectedContents) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  )
  let descriptor
  try {
    descriptor = fs.openSync(tempPath, 'wx', 0o600)
    fs.writeFileSync(descriptor, contents, 'utf8')
    fs.fsyncSync(descriptor)
    fs.closeSync(descriptor)
    descriptor = undefined

    const currentContents = fileContents(filePath)
    const unchanged =
      currentContents === null
        ? expectedContents === null
        : expectedContents !== null && currentContents.equals(expectedContents)
    if (!unchanged) {
      throw new CodexConfigError(
        '检测到 CC Switch 或其他程序刚刚修改了 config.toml，请重新点击配置',
        'CODEX_CONFIG_CHANGED',
      )
    }
    fs.renameSync(tempPath, filePath)
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor)
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
}

class CodexConfigManager {
  constructor({ codexHome, serverUrl, providerName, ccSwitchHome }) {
    if (!path.isAbsolute(codexHome)) throw new TypeError('codexHome must be an absolute path')
    this.codexHome = path.resolve(codexHome)
    this.configPath = path.join(this.codexHome, 'config.toml')
    this.authPath = path.join(this.codexHome, 'auth.json')
    this.backupDirectory = path.join(this.codexHome, '.yangtze-backups')
    this.ccSwitchHome = ccSwitchHome
      ? path.resolve(ccSwitchHome)
      : path.join(path.dirname(this.codexHome), '.cc-switch')
    this.serverUrl = new URL(serverUrl).origin
    this.baseUrl = `${this.serverUrl}/v1`
    this.providerName = String(providerName || 'New API').trim().slice(0, 64) || 'New API'
  }

  inspect(expectedApiKey) {
    const configExists = fs.existsSync(this.configPath)
    const authExists = fs.existsSync(this.authPath)
    const config = parseToml(readConfigText(this.configPath))
    const auth = readJson(this.authPath)
    const provider = config.model_providers?.[PROVIDER_ID]
    const activeProvider = typeof config.model_provider === 'string' ? config.model_provider : ''
    const providerConfigured =
      activeProvider === PROVIDER_ID &&
      provider?.base_url === this.baseUrl &&
      provider?.wire_api === 'responses'
    const providerKey =
      typeof provider?.experimental_bearer_token === 'string'
        ? provider.experimental_bearer_token
        : ''
    const legacyKey =
      provider?.requires_openai_auth === true && typeof auth.OPENAI_API_KEY === 'string'
        ? auth.OPENAI_API_KEY
        : ''
    const storedKey = providerKey || legacyKey
    const keyPresent = storedKey.startsWith('sk-')
    const keyConfigured = typeof expectedApiKey === 'string' && storedKey === expectedApiKey
    const ccSwitchDetected =
      fs.existsSync(path.join(this.ccSwitchHome, 'cc-switch.db')) ||
      fs.existsSync(path.join(this.ccSwitchHome, 'settings.json'))
    const externalProviderActive = Boolean(activeProvider && activeProvider !== PROVIDER_ID)

    return {
      success: true,
      configured: providerConfigured && keyConfigured,
      locallyConfigured: providerConfigured && keyPresent,
      providerConfigured,
      keyConfigured,
      keyPresent,
      keyStorage: providerKey ? 'provider' : legacyKey ? 'legacy-auth' : 'none',
      legacyConfiguration: Boolean(providerConfigured && !providerKey && legacyKey),
      configExists,
      authExists,
      officialLoginPreserved: hasOfficialLogin(auth),
      ccSwitchDetected,
      externalProviderActive,
      activeProvider,
      codexHome: this.codexHome,
      serviceUrl: this.serverUrl,
    }
  }

  configure(apiKey) {
    if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-') || apiKey.length > 256) {
      throw new CodexConfigError('服务器未返回有效的 API Key', 'INVALID_API_KEY')
    }

    fs.mkdirSync(this.codexHome, { recursive: true })
    const expectedContents = fileContents(this.configPath)
    const currentText = expectedContents?.toString('utf8') || ''
    const parsedConfig = parseToml(currentText)
    const auth = readJson(this.authPath)
    const nextText = buildManagedConfig(currentText, parsedConfig, {
      baseUrl: this.baseUrl,
      providerName: this.providerName,
      apiKey,
      preserveLogin: hasOfficialLogin(auth),
    })

    let backupCreated = false
    if (expectedContents !== null) {
      fs.mkdirSync(this.backupDirectory, { recursive: true })
      const backupPath = path.join(this.backupDirectory, `config.toml.${timestamp()}.bak`)
      fs.copyFileSync(this.configPath, backupPath)
      backupCreated = true
    }

    try {
      writeTextAtomic(this.configPath, nextText, expectedContents)
    } catch (error) {
      if (error instanceof CodexConfigError) throw error
      throw new CodexConfigError(`写入 Codex 配置失败：${error.message}`, 'CODEX_WRITE_FAILED')
    }

    return { ...this.inspect(apiKey), backupCreated }
  }
}

module.exports = {
  CodexConfigError,
  CodexConfigManager,
  PROVIDER_ID,
  buildManagedConfig,
}

const fs = require('node:fs')
const path = require('node:path')

const PROJECT_ROOT = path.join(__dirname, '..')
const LOCAL_CONFIG_PATH = path.join(PROJECT_ROOT, 'desktop.config.json')
const EXAMPLE_CONFIG_PATH = path.join(PROJECT_ROOT, 'desktop.config.example.json')
const CONFIG_FILE_PATTERN = /^desktop\.config(?:\.[a-z0-9-]+)?\.json$/i
const WINDOWS_RESERVED_NAME = /[<>:"/\\|?*\u0000-\u001f]/
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

function requireText(value, name, maxLength = 120) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} 必须是非空字符串`)
  }
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error(`${name} 不能超过 ${maxLength} 个字符`)
  return normalized
}

function validateWindowsName(value, fieldName) {
  const name = requireText(value, fieldName, 64)
  if (WINDOWS_RESERVED_NAME.test(name) || WINDOWS_DEVICE_NAME.test(name) || /[. ]$/.test(name)) {
    throw new Error(`${fieldName} 包含 Windows 文件名不允许的字符或保留名称`)
  }
  return name
}

function validateLogoPath(value) {
  const normalized = requireText(value, 'logoPath', 160).replaceAll('\\', '/')
  if (!/^ui\/assets\/[a-zA-Z0-9._-]+\.(svg|png)$/i.test(normalized)) {
    throw new Error('logoPath 必须指向 ui/assets 下的 SVG 或 PNG 文件')
  }
  return normalized
}

function validateAppIconPath(value) {
  const normalized = requireText(value, 'appIconPath', 160).replaceAll('\\', '/')
  if (!/^build\/[a-zA-Z0-9._-]+\.ico$/i.test(normalized)) {
    throw new Error('appIconPath 必须指向 build 目录下的 ICO 文件')
  }
  return normalized
}

function validateAppId(value) {
  const appId = requireText(value, 'appId', 160)
  if (!/^[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)+$/.test(appId)) {
    throw new Error('appId 必须是由字母、数字、点或连字符组成的反向域名')
  }
  return appId
}

function validateSessionPartition(value) {
  const partition = requireText(value, 'sessionPartition', 120)
  if (!/^persist:[a-zA-Z0-9._-]+$/.test(partition)) {
    throw new Error('sessionPartition 必须使用 persist: 前缀且只包含安全字符')
  }
  return partition
}

function validateServerUrl(value, allowInsecureHttp) {
  const raw = requireText(value, 'serverUrl', 300)
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('serverUrl 不是有效网址')
  }
  if (parsed.protocol !== 'https:' && !(allowInsecureHttp && parsed.protocol === 'http:')) {
    throw new Error('serverUrl 必须使用 HTTPS；本地测试 HTTP 时需启用 allowInsecureHttp')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('serverUrl 不能包含账号、密码、查询参数或锚点')
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error('serverUrl 只能填写站点根地址，不能包含路径')
  }
  return parsed.origin
}

function validatePath(value, name) {
  const candidate = requireText(value, name, 200)
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    throw new Error(`${name} 必须是以单个 / 开头的站内路径`)
  }
  const parsed = new URL(candidate, 'https://config.invalid')
  if (parsed.origin !== 'https://config.invalid' || parsed.hash) {
    throw new Error(`${name} 必须是安全的站内路径`)
  }
  return `${parsed.pathname}${parsed.search}`
}

function freezeConfig(config) {
  Object.freeze(config.apiPaths)
  return Object.freeze(config)
}

function parseConfig(raw) {
  const allowInsecureHttp = raw.allowInsecureHttp === true
  const apiPaths = raw.apiPaths || {}
  return freezeConfig({
    productName: validateWindowsName(raw.productName, 'productName'),
    artifactBaseName: validateWindowsName(raw.artifactBaseName || 'API-Client', 'artifactBaseName'),
    appId: validateAppId(raw.appId || 'com.apirelay.desktop'),
    userDataDirectoryName: raw.userDataDirectoryName === undefined
      ? null
      : validateWindowsName(raw.userDataDirectoryName, 'userDataDirectoryName'),
    sessionPartition: validateSessionPartition(raw.sessionPartition || 'persist:new-api-user'),
    logoPath: validateLogoPath(raw.logoPath || 'ui/assets/logo.svg'),
    appIconPath: validateAppIconPath(raw.appIconPath || 'build/icon.ico'),
    serverUrl: validateServerUrl(raw.serverUrl, allowInsecureHttp),
    userPagePath: validatePath(raw.userPagePath || '/dashboard', 'userPagePath'),
    allowInsecureHttp,
    apiPaths: {
      status: validatePath(apiPaths.status || '/api/status', 'apiPaths.status'),
      login: validatePath(apiPaths.login || '/api/user/login', 'apiPaths.login'),
      login2fa: validatePath(apiPaths.login2fa || '/api/user/login/2fa', 'apiPaths.login2fa'),
      registrationApplication: validatePath(
        apiPaths.registrationApplication || '/api/user/registration-applications',
        'apiPaths.registrationApplication',
      ),
      registrationApplicationStatus: validatePath(
        apiPaths.registrationApplicationStatus || '/api/user/application/status',
        'apiPaths.registrationApplicationStatus',
      ),
      passwordResetApplication: validatePath(
        apiPaths.passwordResetApplication || '/api/user/password-reset-applications',
        'apiPaths.passwordResetApplication',
      ),
      passwordResetStatus: validatePath(
        apiPaths.passwordResetStatus || '/api/user/password-reset-applications/status',
        'apiPaths.passwordResetStatus',
      ),
      passwordResetComplete: validatePath(
        apiPaths.passwordResetComplete || '/api/user/password-reset-applications/complete',
        'apiPaths.passwordResetComplete',
      ),
    },
  })
}

function resolveConfigPath(configFileName) {
  if (!configFileName) {
    return fs.existsSync(LOCAL_CONFIG_PATH) ? LOCAL_CONFIG_PATH : EXAMPLE_CONFIG_PATH
  }
  const fileName = path.basename(configFileName)
  if (fileName !== configFileName || !CONFIG_FILE_PATTERN.test(fileName)) {
    throw new Error('桌面客户端配置文件名不合法')
  }
  return path.join(PROJECT_ROOT, fileName)
}

function loadDesktopConfig(configFileName = process.env.DESKTOP_CONFIG_FILE) {
  const configPath = resolveConfigPath(configFileName)
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    throw new Error(`无法读取桌面客户端配置 ${configPath}: ${error.message}`)
  }
  return parseConfig(raw)
}

function logoPathForLoginPage(config) {
  return config.logoPath.slice('ui/'.length)
}

module.exports = {
  loadDesktopConfig,
  logoPathForLoginPage,
  parseConfig,
  resolveConfigPath,
}

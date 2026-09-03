const fs = require('node:fs')
const path = require('node:path')

function maskSecret(value) {
  if (typeof value !== 'string' || value.length === 0) return ''
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}${'*'.repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`
}

function atomicWrite(filePath, content) {
  const directory = path.dirname(filePath)
  fs.mkdirSync(directory, { recursive: true })
  const temporaryPath = `${filePath}.yangtze-${process.pid}-${Date.now()}.tmp`
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(temporaryPath, filePath)
  } finally {
    try { fs.rmSync(temporaryPath, { force: true }) } catch { /* best effort */ }
  }
}

function readTextIfExists(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

class BaseSyncAdapter {
  constructor({ homeDir, launcher }) {
    this.homeDir = homeDir
    this.launcher = launcher
  }

  get toolId() { throw new Error('toolId must be implemented') }
  get displayName() { return this.toolId }
  get configPaths() { return [] }

  getLocalState() {
    return { configured: this.configPaths.some((filePath) => fs.existsSync(filePath)) }
  }

  apply() { throw new Error('apply must be implemented') }
  remove() { throw new Error('remove must be implemented') }

  launch() {
    if (!this.launcher) return { launched: false, reason: 'launcher-unavailable' }
    return this.launcher(this.toolId)
  }
}

module.exports = {
  BaseSyncAdapter,
  atomicWrite,
  maskSecret,
  readTextIfExists,
}

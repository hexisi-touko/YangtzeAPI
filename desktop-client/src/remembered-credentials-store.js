const fs = require('node:fs')
const path = require('node:path')

class RememberedCredentialsStore {
  constructor({ filePath, safeStorage, fsModule = fs }) {
    this.filePath = filePath
    this.safeStorage = safeStorage
    this.fs = fsModule
  }

  encryptionAvailable() {
    return this.safeStorage?.isEncryptionAvailable() === true
  }

  save(credentials) {
    if (!this.encryptionAvailable()) throw new Error('系统安全存储当前不可用')
    if (
      !credentials ||
      typeof credentials.username !== 'string' ||
      credentials.username.length === 0 ||
      typeof credentials.password !== 'string' ||
      credentials.password.length === 0
    ) {
      throw new Error('登录凭据无效')
    }

    const encrypted = this.safeStorage.encryptString(JSON.stringify({
      version: 1,
      username: credentials.username,
      password: credentials.password,
    }))
    this.fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    this.fs.writeFileSync(this.filePath, encrypted)
  }

  load() {
    if (!this.encryptionAvailable() || !this.fs.existsSync(this.filePath)) return null
    try {
      const decrypted = this.safeStorage.decryptString(this.fs.readFileSync(this.filePath))
      const credentials = JSON.parse(decrypted)
      if (
        credentials?.version !== 1 ||
        typeof credentials.username !== 'string' ||
        credentials.username.length === 0 ||
        typeof credentials.password !== 'string' ||
        credentials.password.length === 0
      ) {
        return null
      }
      return { username: credentials.username, password: credentials.password }
    } catch {
      return null
    }
  }

  clear() {
    if (this.fs.existsSync(this.filePath)) this.fs.rmSync(this.filePath, { force: true })
  }
}

module.exports = { RememberedCredentialsStore }

const fs = require('node:fs')
const path = require('node:path')

class PasswordResetStore {
  constructor({ filePath, safeStorage, fsModule = fs }) {
    this.filePath = filePath
    this.safeStorage = safeStorage
    this.fs = fsModule
  }

  encryptionAvailable() {
    return this.safeStorage?.isEncryptionAvailable() === true
  }

  save(tracking) {
    if (!this.encryptionAvailable()) throw new Error('系统安全存储当前不可用')
    const encrypted = this.safeStorage.encryptString(JSON.stringify(tracking))
    this.fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    this.fs.writeFileSync(this.filePath, encrypted)
  }

  load() {
    if (!this.encryptionAvailable() || !this.fs.existsSync(this.filePath)) return null
    try {
      const decrypted = this.safeStorage.decryptString(this.fs.readFileSync(this.filePath))
      const tracking = JSON.parse(decrypted)
      if (!tracking || typeof tracking.applicationId !== 'string' || typeof tracking.secret !== 'string') return null
      return tracking
    } catch {
      return null
    }
  }

  clear() {
    if (this.fs.existsSync(this.filePath)) this.fs.rmSync(this.filePath, { force: true })
  }
}

module.exports = { PasswordResetStore }

const test = require('node:test')
const assert = require('node:assert/strict')
const { PasswordResetStore } = require('../src/password-reset-store')

function memoryFileSystem() {
  let file = null
  return {
    mkdirSync() {},
    writeFileSync(_path, value) { file = Buffer.from(value) },
    existsSync() { return file !== null },
    readFileSync() { return Buffer.from(file) },
    rmSync() { file = null },
    contents() { return file },
  }
}

function reversingSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(Array.from(value).reverse().join('')),
    decryptString: (value) => Array.from(value.toString()).reverse().join(''),
  }
}

test('password reset tracking is persisted through the safe storage adapter', () => {
  const fsModule = memoryFileSystem()
  const store = new PasswordResetStore({
    filePath: 'C:\\test-data\\password-reset-request.bin',
    safeStorage: reversingSafeStorage(),
    fsModule,
  })
  const tracking = { applicationId: '51', secret: 'one-time-secret', username: 'locked-user' }

  store.save(tracking)
  assert.equal(fsModule.contents().includes(Buffer.from('one-time-secret')), false)
  assert.deepEqual(store.load(), tracking)

  store.clear()
  assert.equal(store.load(), null)
})

test('password reset tracking refuses plaintext fallback when encryption is unavailable', () => {
  const store = new PasswordResetStore({
    filePath: 'C:\\test-data\\password-reset-request.bin',
    safeStorage: reversingSafeStorage(false),
    fsModule: memoryFileSystem(),
  })
  assert.throws(() => store.save({ applicationId: '1', secret: 'secret' }), /安全存储/)
  assert.equal(store.load(), null)
})

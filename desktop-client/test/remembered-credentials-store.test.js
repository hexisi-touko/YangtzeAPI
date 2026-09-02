const test = require('node:test')
const assert = require('node:assert/strict')
const { RememberedCredentialsStore } = require('../src/remembered-credentials-store')

function memoryFileSystem(initialFile = null) {
  let file = initialFile === null ? null : Buffer.from(initialFile)
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

test('remembered credentials are encrypted, loaded, and cleared', () => {
  const fsModule = memoryFileSystem()
  const store = new RememberedCredentialsStore({
    filePath: 'C:\\test-data\\remembered-credentials.bin',
    safeStorage: reversingSafeStorage(),
    fsModule,
  })
  const credentials = { username: 'alice', password: 'correct horse battery staple' }

  store.save(credentials)
  assert.equal(fsModule.contents().includes(Buffer.from(credentials.password)), false)
  assert.deepEqual(store.load(), credentials)

  store.clear()
  assert.equal(store.load(), null)
})

test('remembered credentials refuse plaintext fallback when encryption is unavailable', () => {
  const fsModule = memoryFileSystem()
  const store = new RememberedCredentialsStore({
    filePath: 'C:\\test-data\\remembered-credentials.bin',
    safeStorage: reversingSafeStorage(false),
    fsModule,
  })

  assert.throws(() => store.save({ username: 'alice', password: 'secret' }), /安全存储/)
  assert.equal(store.load(), null)
  assert.equal(fsModule.contents(), null)
})

test('remembered credentials ignore corrupted or invalid encrypted data', () => {
  const corruptedFileSystem = memoryFileSystem(Buffer.from('not encrypted json'))
  const corruptedStore = new RememberedCredentialsStore({
    filePath: 'C:\\test-data\\remembered-credentials.bin',
    safeStorage: reversingSafeStorage(),
    fsModule: corruptedFileSystem,
  })
  assert.equal(corruptedStore.load(), null)

  const invalidFileSystem = memoryFileSystem()
  const invalidStore = new RememberedCredentialsStore({
    filePath: 'C:\\test-data\\remembered-credentials.bin',
    safeStorage: reversingSafeStorage(),
    fsModule: invalidFileSystem,
  })
  assert.throws(() => invalidStore.save({ username: 'alice', password: '' }), /登录凭据无效/)
})

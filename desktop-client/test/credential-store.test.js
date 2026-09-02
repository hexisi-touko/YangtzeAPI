const assert = require('node:assert/strict')
const test = require('node:test')

const { CredentialStore } = require('../src/credential-store')

function memoryFileSystem() {
  let value = null
  return {
    existsSync: () => value !== null,
    mkdirSync: () => {},
    writeFileSync: (_path, nextValue) => { value = Buffer.from(nextValue) },
    readFileSync: () => Buffer.from(value),
    rmSync: () => { value = null },
    contents: () => value,
  }
}

function reversingSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(Array.from(value).reverse().join('')),
    decryptString: (value) => Array.from(value.toString()).reverse().join(''),
  }
}

test('login credentials are encrypted, restored, and cleared', () => {
  const fsModule = memoryFileSystem()
  const store = new CredentialStore({
    filePath: 'C:\\test-data\\login-credentials.bin',
    safeStorage: reversingSafeStorage(),
    fsModule,
  })

  store.save({ username: ' member ', password: 'Member777777' })

  assert.equal(fsModule.contents().includes(Buffer.from('Member777777')), false)
  assert.deepEqual(store.load(), { username: 'member', password: 'Member777777' })
  store.clear()
  assert.equal(store.load(), null)
})

test('login credentials never fall back to plaintext storage', () => {
  const store = new CredentialStore({
    filePath: 'C:\\test-data\\login-credentials.bin',
    safeStorage: reversingSafeStorage(false),
    fsModule: memoryFileSystem(),
  })

  assert.throws(() => store.save({ username: 'member', password: 'secret' }), /安全存储/)
  assert.equal(store.load(), null)
})

test('invalid stored credentials are ignored', () => {
  const fsModule = memoryFileSystem()
  const safeStorage = reversingSafeStorage()
  fsModule.writeFileSync('ignored', safeStorage.encryptString(JSON.stringify({ username: '', password: '' })))
  const store = new CredentialStore({
    filePath: 'C:\\test-data\\login-credentials.bin',
    safeStorage,
    fsModule,
  })

  assert.equal(store.load(), null)
})

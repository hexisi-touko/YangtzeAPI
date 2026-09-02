const { app, safeStorage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const { CredentialStore } = require('../src/credential-store')

app.whenReady().then(() => {
  const mode = process.env.CREDENTIAL_STORE_TEST_MODE
  const filePath = path.join(app.getPath('temp'), 'api-client-credential-store-integration.bin')
  const store = new CredentialStore({ filePath, safeStorage })

  if (mode === 'write') {
    store.save({ username: 'persistent-user', password: 'Persistent666666' })
    const contents = fs.readFileSync(filePath)
    if (contents.includes(Buffer.from('Persistent666666'))) throw new Error('password was stored as plaintext')
    console.log('CREDENTIAL_STORE_WRITE_OK')
  } else if (mode === 'read') {
    const credentials = store.load()
    if (credentials?.username !== 'persistent-user' || credentials?.password !== 'Persistent666666') {
      throw new Error('credentials did not persist across Electron launches')
    }
    store.clear()
    console.log('CREDENTIAL_STORE_READ_OK')
  } else {
    throw new Error('unknown credential store integration mode')
  }

  app.exit(0)
}).catch((error) => {
  console.error(error)
  app.exit(1)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { validateBuildConfig } = require('../scripts/validate-build-config')

test('production rejects local and insecure endpoints but permits a configured HTTPS service', () => {
  for (const serverUrl of ['http://api.example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://0.0.0.0']) {
    assert.throws(() => validateBuildConfig({ serverUrl, allowInsecureHttp: false }, 'Production'))
  }
  assert.throws(() => validateBuildConfig({ serverUrl: 'https://api.example.com', allowInsecureHttp: true }, 'Production'))
  assert.doesNotThrow(() => validateBuildConfig({ serverUrl: 'https://api.example.com', allowInsecureHttp: false }, 'Production'))
  assert.doesNotThrow(() => validateBuildConfig({ serverUrl: 'http://127.0.0.1:3000', allowInsecureHttp: true }, 'LocalTest'))
})

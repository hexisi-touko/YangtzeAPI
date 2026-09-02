const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { parseConfig, resolveConfigPath } = require('../src/config')

function validConfig(overrides = {}) {
  return {
    productName: '测试客户端',
    artifactBaseName: 'Test-Client',
    logoPath: 'ui/assets/logo.svg',
    appIconPath: 'build/icon.ico',
    serverUrl: 'https://api.example.com',
    userPagePath: '/dashboard',
    allowInsecureHttp: false,
    apiPaths: {},
    ...overrides,
  }
}

test('parseConfig normalizes the public desktop settings', () => {
  const config = parseConfig(validConfig({ serverUrl: 'https://api.example.com/' }))
  assert.equal(config.serverUrl, 'https://api.example.com')
  assert.equal(config.appId, 'com.apirelay.desktop')
  assert.equal(config.sessionPartition, 'persist:new-api-user')
  assert.equal(config.apiPaths.login, '/api/user/login')
  assert.equal(config.apiPaths.registrationApplication, '/api/user/registration-applications')
  assert.equal(config.apiPaths.registrationApplicationStatus, '/api/user/application/status')
  assert.equal(config.apiPaths.passwordResetApplication, '/api/user/password-reset-applications')
  assert.equal(config.apiPaths.passwordResetStatus, '/api/user/password-reset-applications/status')
  assert.equal(config.apiPaths.passwordResetComplete, '/api/user/password-reset-applications/complete')
  assert.ok(Object.isFrozen(config))
})

test('parseConfig rejects HTTP unless it is explicitly enabled', () => {
  assert.throws(
    () => parseConfig(validConfig({ serverUrl: 'http://127.0.0.1:3000' })),
    /必须使用 HTTPS/,
  )
  const config = parseConfig(validConfig({
    serverUrl: 'http://127.0.0.1:3000',
    allowInsecureHttp: true,
  }))
  assert.equal(config.serverUrl, 'http://127.0.0.1:3000')
})

test('parseConfig limits logos and API paths to expected locations', () => {
  assert.throws(() => parseConfig(validConfig({ logoPath: '../logo.svg' })), /ui\/assets/)
  assert.throws(
    () => parseConfig(validConfig({ apiPaths: { login: 'https://other.example/login' } })),
    /站内路径/,
  )
})

test('parseConfig rejects Windows reserved product and artifact names', () => {
  assert.throws(() => parseConfig(validConfig({ productName: 'CON' })), /保留名称/)
  assert.throws(() => parseConfig(validConfig({ artifactBaseName: 'bad:name' })), /不允许的字符/)
})

test('parseConfig accepts an isolated local test identity', () => {
  const config = parseConfig(validConfig({
    appId: 'com.apirelay.desktop.localtest',
    userDataDirectoryName: '测试客户端-LocalTest',
    sessionPartition: 'persist:new-api-user-local-test',
  }))
  assert.equal(config.appId, 'com.apirelay.desktop.localtest')
  assert.equal(config.userDataDirectoryName, '测试客户端-LocalTest')
  assert.equal(config.sessionPartition, 'persist:new-api-user-local-test')
})

test('resolveConfigPath only accepts desktop config files in the project root', () => {
  assert.equal(
    path.basename(resolveConfigPath('desktop.config.local-test.json')),
    'desktop.config.local-test.json',
  )
  assert.throws(() => resolveConfigPath('../desktop.config.local-test.json'), /文件名不合法/)
  assert.throws(() => resolveConfigPath('package.json'), /文件名不合法/)
})

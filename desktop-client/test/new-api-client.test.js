const test = require('node:test')
const assert = require('node:assert/strict')
const { parseConfig } = require('../src/config')
const { NewApiClient, NewApiClientError } = require('../src/new-api-client')

function config() {
  return parseConfig({
    productName: '测试客户端',
    artifactBaseName: 'Test-Client',
    logoPath: 'ui/assets/logo.svg',
    appIconPath: 'build/icon.ico',
    serverUrl: 'https://api.example.com',
    userPagePath: '/client',
    allowInsecureHttp: false,
    apiPaths: {},
  })
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  }
}

function clientWith(handler) {
  const requests = []
  const session = {
    fetch: async (url, options) => {
      requests.push({ url, options })
      return handler(url, options)
    },
  }
  return { client: new NewApiClient({ config: config(), session }), requests }
}

test('login sends only username and password to the fixed login endpoint', async () => {
  const { client, requests } = clientWith(() => response({ success: true, data: { access_token: 'secret', session: { sid: 'session-1' } } }))
  const result = await client.login({ username: 'alice', password: 'correct horse' })
  assert.equal(result.authenticated, true)
  assert.equal(requests[0].url, 'https://api.example.com/api/user/login')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    username: 'alice',
    password: 'correct horse',
  })
  assert.equal(requests[0].options.credentials, 'include')
})

test('login returns the temporary 2FA flow without exposing an authenticated result', async () => {
  const { client } = clientWith(() => response({
    success: true,
    message: '需要两步验证',
    data: { require_2fa: true, flow_token: 'flow-token', expires_at: 2000000000 },
  }))
  const result = await client.login({ username: 'alice', password: 'password' })
  assert.equal(result.authenticated, false)
  assert.equal(result.requiresTwoFactor, true)
  assert.equal(result.flowToken, 'flow-token')
})

test('registration application uses the future review endpoint and exact fields', async () => {
  const { client, requests } = clientWith(() => response({
    success: true,
    data: { application_id: 42 },
  }))
  const result = await client.submitRegistrationApplication({
    username: 'new-user',
    password: 'password123',
    reason: '课程科研项目使用',
  })
  assert.equal(requests[0].url, 'https://api.example.com/api/user/registration-applications')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    username: 'new-user',
    password: 'password123',
    reason: '课程科研项目使用',
  })
  assert.equal(result.applicationId, 42)
})

test('password reset application sends username and reason without email', async () => {
  const { client, requests } = clientWith(() => response({
    success: true,
    data: { application_id: 51, application_secret: 'one-time-secret' },
  }))
  const result = await client.submitPasswordResetApplication({
    username: 'locked-user',
    reason: '原密码遗失，申请人工核验',
  })
  assert.equal(requests[0].url, 'https://api.example.com/api/user/password-reset-applications')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    username: 'locked-user',
    reason: '原密码遗失，申请人工核验',
  })
  assert.equal(result.applicationId, '51')
  assert.equal(result.applicationSecret, 'one-time-secret')
})

test('password reset status uses the stored application capability', async () => {
  const { client, requests } = clientWith(() => response({
    success: true,
    message: '申请已通过',
    data: { status: 'approved', review_note: '身份已核验' },
  }))
  const result = await client.getPasswordResetStatus({
    applicationId: '51',
    applicationSecret: 'one-time-secret',
  })
  assert.equal(requests[0].url, 'https://api.example.com/api/user/password-reset-applications/status')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    application_id: '51',
    application_secret: 'one-time-secret',
  })
  assert.equal(result.status, 'approved')
  assert.equal(result.reviewNote, '身份已核验')
})

test('password reset completion sends one new password field only', async () => {
  const { client, requests } = clientWith(() => response({ success: true }))
  const result = await client.completePasswordReset({
    applicationId: '51',
    applicationSecret: 'one-time-secret',
    newPassword: 'new-password-123',
  })
  assert.equal(requests[0].url, 'https://api.example.com/api/user/password-reset-applications/complete')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    application_id: '51',
    application_secret: 'one-time-secret',
    new_password: 'new-password-123',
  })
  assert.equal(result.success, true)
})

test('server business errors are returned as bounded client errors', async () => {
  const { client } = clientWith(() => response({ success: false, code: 'ACCOUNT_PENDING', message: '申请正在审核' }))
  await assert.rejects(
    () => client.login({ username: 'alice', password: 'password' }),
    (error) => error instanceof NewApiClientError && error.code === 'ACCOUNT_PENDING',
  )
})

test('approved client key is selected and fetched without leaking it through the list', async () => {
  const { client, requests } = clientWith((url) => {
    if (url.endsWith('/api/token/?p=1&size=100')) {
      return response({
        success: true,
        data: { items: [{ id: 7, name: 'alice approved access key', status: 1, key: 'sk-****' }] },
      })
    }
    return response({ success: true, data: { key: 'sk-approved-member-key' } })
  })
  client.accessToken = 'dashboard-token'
  client.sessionId = 'session-1'

  const key = await client.getApprovedApiKey()
  assert.equal(key, 'sk-approved-member-key')
  assert.equal(requests[0].options.headers.Authorization, 'Bearer dashboard-token')
  assert.equal(requests[1].url, 'https://api.example.com/api/token/7/key')
})

test('authenticated request refreshes a rotated browser session once and retries', async () => {
  let tokenListAttempts = 0
  const { client, requests } = clientWith((url) => {
    if (url.endsWith('/api/user/auth/refresh')) {
      return response({
        success: true,
        data: { access_token: 'refreshed-token', session: { sid: 'session-1' } },
      })
    }
    if (url.endsWith('/api/token/?p=1&size=100')) {
      tokenListAttempts += 1
      if (tokenListAttempts === 1) return response({ success: false }, 401)
      return response({ success: true, data: { items: [{ id: 8, name: 'approved', status: 1 }] } })
    }
    return response({ success: true, data: { key: 'sk-refreshed-key' } })
  })
  client.accessToken = 'expired-token'
  client.sessionId = 'session-1'

  assert.equal(await client.getApprovedApiKey(), 'sk-refreshed-key')
  const refreshRequest = requests.find((request) => request.url.endsWith('/api/user/auth/refresh'))
  assert.equal(refreshRequest.options.headers.Origin, 'https://api.example.com')
  assert.equal(refreshRequest.options.headers['X-Auth-Session'], 'session-1')
  assert.equal(requests.at(-1).options.headers.Authorization, 'Bearer refreshed-token')
})

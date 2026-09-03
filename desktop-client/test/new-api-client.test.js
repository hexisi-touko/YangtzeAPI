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
    userPagePath: '/dashboard',
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
  const { client, requests } = clientWith(() => response({
    success: true,
    data: { access_token: 'secret', user: { role: 1 } },
  }))
  const result = await client.login({ username: 'alice', password: 'correct horse' })
  assert.equal(result.authenticated, true)
  assert.equal(result.accountRole, 1)
  assert.equal(requests[0].url, 'https://api.example.com/api/user/login')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    username: 'alice',
    password: 'correct horse',
  })
  assert.equal(requests[0].options.credentials, 'include')
})

test('desktop tools endpoint returns the assigned tool payload', async () => {
  const { client, requests } = clientWith(() => response({
    success: true,
    data: { tools: [{ id: 'codex-gpt', api_key: 'sk-test', api_base_url: 'https://api.example.com/v1', model: 'gpt-5.2' }] },
  }))
  const result = await client.getDesktopTools()
  assert.equal(requests[0].url, 'https://api.example.com/api/user/desktop-tools')
  assert.equal(result.tools[0].id, 'codex-gpt')
})

test('login returns the account role so the desktop shell can reject administrators', async () => {
  const { client } = clientWith(() => response({
    success: true,
    data: { access_token: 'secret', user: { role: 100 } },
  }))
  const result = await client.login({ username: 'admin', password: 'password' })
  assert.equal(result.accountRole, 100)
})

test('login rejects authenticated responses without a role', async () => {
  const { client } = clientWith(() => response({
    success: true,
    data: { access_token: 'secret', user: {} },
  }))
  await assert.rejects(
    () => client.login({ username: 'alice', password: 'password' }),
    (error) => error instanceof NewApiClientError && error.code === 'INVALID_RESPONSE',
  )
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
  assert.equal(result.status, 'pending')
})

test('registration application accepts a reason longer than the former limit', async () => {
  const longReason = '长'.repeat(1200)
  const { client, requests } = clientWith(() => response({
    success: true,
    data: { application_id: 43, application_status: 'pending' },
  }))
  await client.submitRegistrationApplication({
    username: 'long-reason-user',
    password: 'password123',
    reason: longReason,
  })
  assert.equal(JSON.parse(requests[0].options.body).reason, longReason)
})

test('registration application status refresh returns the latest review decision', async () => {
  const { client, requests } = clientWith(() => response({
    success: true,
    data: {
      application_id: 42,
      application_status: 'approved',
      review_comment: '已核实项目用途',
      reviewed_at: 1788336000,
    },
  }))
  const result = await client.getRegistrationApplicationStatus({
    username: 'new-user',
    password: 'password123',
  })
  assert.equal(requests[0].url, 'https://api.example.com/api/user/application/status')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    username: 'new-user',
    password: 'password123',
  })
  assert.deepEqual(result, {
    success: true,
    applicationId: 42,
    status: 'approved',
    reviewComment: '已核实项目用途',
    reviewedAt: 1788336000,
  })
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

test('password reset application accepts a reason longer than the former limit', async () => {
  const longReason = '长'.repeat(1200)
  const { client, requests } = clientWith(() => response({
    success: true,
    data: { application_id: 52, application_secret: 'one-time-secret' },
  }))
  await client.submitPasswordResetApplication({ username: 'locked-user', reason: longReason })
  assert.equal(JSON.parse(requests[0].options.body).reason, longReason)
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

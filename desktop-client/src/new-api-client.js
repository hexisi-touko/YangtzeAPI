const MAX_RESPONSE_LENGTH = 1024 * 1024
const DEFAULT_TIMEOUT_MS = 15_000

class NewApiClientError extends Error {
  constructor(message, { code = 'CLIENT_ERROR', status = 0 } = {}) {
    super(message)
    this.name = 'NewApiClientError'
    this.code = code
    this.status = status
  }
}

function requireValue(value, name, maxLength) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new NewApiClientError(`${name}不能为空`, { code: 'INVALID_INPUT' })
  }
  const normalized = value.trim()
  if (normalized.length > maxLength) {
    throw new NewApiClientError(`${name}长度超过限制`, { code: 'INVALID_INPUT' })
  }
  return normalized
}

function responseMessage(payload, fallback) {
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message.trim().slice(0, 300)
  }
  return fallback
}

class NewApiClient {
  constructor({ config, session, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    if (!config || !session || typeof session.fetch !== 'function') {
      throw new TypeError('NewApiClient requires validated config and an Electron session')
    }
    this.config = config
    this.session = session
    this.timeoutMs = timeoutMs
  }

  buildUrl(apiPath, query = {}) {
    const url = new URL(apiPath, this.config.serverUrl)
    if (url.origin !== this.config.serverUrl) throw new NewApiClientError('请求地址不在配置的服务器内')
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    }
    return url.toString()
  }

  async request(apiPath, { method = 'GET', body, query } = {}) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    let response
    try {
      response = await this.session.fetch(this.buildUrl(apiPath, query), {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new NewApiClientError('连接服务器超时，请稍后重试', { code: 'TIMEOUT' })
      }
      throw new NewApiClientError('无法连接服务器，请检查网络或服务器地址', { code: 'NETWORK_ERROR' })
    } finally {
      clearTimeout(timeout)
    }

    const text = await response.text()
    if (text.length > MAX_RESPONSE_LENGTH) {
      throw new NewApiClientError('服务器响应过大，已拒绝处理', {
        code: 'INVALID_RESPONSE',
        status: response.status,
      })
    }

    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      throw new NewApiClientError('服务器返回了无法识别的内容', {
        code: 'INVALID_RESPONSE',
        status: response.status,
      })
    }

    if (!response.ok || payload?.success === false) {
      throw new NewApiClientError(responseMessage(payload, `服务器请求失败（${response.status}）`), {
        code: typeof payload?.code === 'string' ? payload.code : 'SERVER_ERROR',
        status: response.status,
      })
    }
    return payload
  }

  async getStatus() {
    const payload = await this.request(this.config.apiPaths.status)
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload
    return {
      success: true,
      systemName: typeof data.system_name === 'string' ? data.system_name : '',
      passwordLoginEnabled: data.password_login_enabled !== false,
      registrationApplicationEnabled:
        data.registration_application_enabled === true ||
        (data.registration_application_enabled === undefined &&
          data.register_enabled !== false &&
          data.password_register_enabled !== false),
      passwordResetApplicationEnabled: data.password_reset_application_enabled !== false,
      turnstileRequired: data.turnstile_check === true,
      emailVerificationRequired: data.email_verification === true,
    }
  }

  async login({ username, password }) {
    const payload = await this.request(this.config.apiPaths.login, {
      method: 'POST',
      body: {
        username: requireValue(username, '用户名', 64),
        password: requireValue(password, '密码', 256),
      },
    })
    if (payload?.data?.require_2fa === true) {
      return {
        authenticated: false,
        requiresTwoFactor: true,
        flowToken: requireValue(payload.data.flow_token, '两步验证流程令牌', 2048),
        expiresAt: Number(payload.data.expires_at) || 0,
        message: responseMessage(payload, '请输入两步验证码'),
      }
    }
    return { authenticated: true, requiresTwoFactor: false, message: '登录成功' }
  }

  async verifyTwoFactor({ code, flowToken }) {
    await this.request(this.config.apiPaths.login2fa, {
      method: 'POST',
      body: {
        code: requireValue(code, '验证码', 16),
        flow_token: requireValue(flowToken, '两步验证流程令牌', 2048),
      },
    })
    return { authenticated: true, message: '验证成功' }
  }

  async submitRegistrationApplication({ username, password, reason }) {
    const payload = await this.request(this.config.apiPaths.registrationApplication, {
      method: 'POST',
      body: {
        username: requireValue(username, '用户名', 64),
        password: requireValue(password, '密码', 256),
        reason: requireValue(reason, '申请理由', 300),
      },
    })
    return {
      success: true,
      message: responseMessage(payload, '申请已提交，请等待管理员审核'),
      applicationId: payload?.data?.application_id ?? payload?.data?.id ?? null,
    }
  }

  async submitPasswordResetApplication({ username, reason }) {
    const payload = await this.request(this.config.apiPaths.passwordResetApplication, {
      method: 'POST',
      body: {
        username: requireValue(username, '用户名', 64),
        reason: requireValue(reason, '申请理由', 300),
      },
    })
    return {
      success: true,
      message: responseMessage(payload, '找回密码申请已提交，请等待管理员处理'),
      applicationId: requireValue(
        String(payload?.data?.application_id ?? payload?.data?.id ?? ''),
        '申请编号',
        128,
      ),
      applicationSecret: requireValue(payload?.data?.application_secret, '申请凭证', 2048),
      username: requireValue(username, '用户名', 64),
    }
  }

  async getPasswordResetStatus({ applicationId, applicationSecret }) {
    const payload = await this.request(this.config.apiPaths.passwordResetStatus, {
      method: 'POST',
      body: {
        application_id: requireValue(applicationId, '申请编号', 128),
        application_secret: requireValue(applicationSecret, '申请凭证', 2048),
      },
    })
    const status = requireValue(payload?.data?.status, '审核状态', 32).toLowerCase()
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new NewApiClientError('服务器返回了未知的审核状态', { code: 'INVALID_RESPONSE' })
    }
    return {
      success: true,
      status,
      message: responseMessage(payload, status === 'approved' ? '申请已批准，请设置新密码' : '申请仍在审核中'),
      reviewNote: typeof payload?.data?.review_note === 'string' ? payload.data.review_note.slice(0, 300) : '',
    }
  }

  async completePasswordReset({ applicationId, applicationSecret, newPassword }) {
    const payload = await this.request(this.config.apiPaths.passwordResetComplete, {
      method: 'POST',
      body: {
        application_id: requireValue(applicationId, '申请编号', 128),
        application_secret: requireValue(applicationSecret, '申请凭证', 2048),
        new_password: requireValue(newPassword, '重置密码', 256),
      },
    })
    return { success: true, message: responseMessage(payload, '密码重置成功，请返回登录') }
  }
}

module.exports = {
  NewApiClient,
  NewApiClientError,
}

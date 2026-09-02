const query = new URLSearchParams(window.location.search)
const productName = (query.get('productName') || '桌面客户端').trim().slice(0, 64)
const configuredLogoPath = (query.get('logoPath') || 'assets/logo.svg').trim()

document.title = `${productName} - 登录`
document.querySelectorAll('[data-product-name]').forEach((element) => { element.textContent = productName })

const authAdapter = {
  async getStatus() {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.getStatus()
  },
  async getSavedCredentials() {
    if (!window.desktopAuth) return { success: true, credentials: null }
    return window.desktopAuth.getSavedCredentials()
  },
  async clearSavedCredentials() {
    if (!window.desktopAuth) return { success: true }
    return window.desktopAuth.clearSavedCredentials()
  },
  async login(payload) {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.login(payload)
  },
  async verifyTwoFactor(code) {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.verifyTwoFactor(code)
  },
  async register(payload) {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.submitRegistrationApplication(payload)
  },
  async getRegistrationApplicationStatus() {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.getRegistrationApplicationStatus()
  },
  async submitPasswordResetApplication(payload) {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.submitPasswordResetApplication(payload)
  },
  async getPasswordResetState() {
    if (!window.desktopAuth) return { success: true, hasApplication: false, username: '' }
    return window.desktopAuth.getPasswordResetState()
  },
  async getPasswordResetStatus() {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.getPasswordResetStatus()
  },
  async completePasswordReset(newPassword) {
    if (!window.desktopAuth) return { success: false, message: '认证桥接不可用' }
    return window.desktopAuth.completePasswordReset(newPassword)
  },
}

const message = document.querySelector('#form-message')
const views = Array.from(document.querySelectorAll('.auth-view'))
const brandLogo = document.querySelector('#brand-logo')
const brandLogoImage = document.querySelector('#brand-logo-image')
const brandLogoFallback = document.querySelector('#brand-logo-fallback')
const registerViewButton = document.querySelector('[data-view="register-view"]')
const passwordResetButton = document.querySelector('#password-reset-button')
const forgotApplicationStage = document.querySelector('#forgot-application-stage')
const forgotStatusStage = document.querySelector('#forgot-status-stage')
const forgotResetStage = document.querySelector('#forgot-reset-stage')
const forgotStatusUsername = document.querySelector('#forgot-status-username')
const applicationStatusDialog = document.querySelector('#application-status-dialog')
const applicationStatusMessage = document.querySelector('#application-status-message')
const applicationStatusLabel = document.querySelector('#application-status-label')
const applicationStatusReview = document.querySelector('#application-status-review')
const applicationStatusReviewComment = document.querySelector('#application-status-review-comment')
const applicationStatusUpdatedAt = document.querySelector('#application-status-updated-at')
const applicationStatusError = document.querySelector('#application-status-error')
const applicationStatusRefresh = document.querySelector('#application-status-refresh')
const logoCandidates = Array.from(new Set([configuredLogoPath, 'assets/logo.svg', 'assets/logo.png']))
let logoCandidateIndex = 0

brandLogoImage.alt = `${productName} Logo`
brandLogoFallback.textContent = productName.slice(0, 1) || '智'

function showCustomLogo() {
  if (brandLogoImage.naturalWidth > 0 && brandLogoImage.naturalHeight > 0) {
    brandLogo.classList.add('has-image')
  }
}

function loadNextLogo() {
  brandLogo.classList.remove('has-image')
  if (logoCandidateIndex >= logoCandidates.length) {
    brandLogoImage.removeAttribute('src')
    return
  }
  brandLogoImage.src = logoCandidates[logoCandidateIndex]
  logoCandidateIndex += 1
}

brandLogoImage.addEventListener('load', showCustomLogo)
brandLogoImage.addEventListener('error', loadNextLogo)
loadNextLogo()

function showMessage(text, type = 'info') {
  message.textContent = text || ''
  message.className = text ? `form-message visible ${type}` : 'form-message'
}

function updateApplicationStatus(result = {}) {
  const status = ['pending', 'approved', 'rejected'].includes(result.status) ? result.status : 'pending'
  const content = {
    pending: {
      label: '待审核',
      message: result.message || '申请已提交，正在等待管理员审核。',
    },
    approved: {
      label: '审核已通过',
      message: result.message || '账号已启用，现在可以返回登录。',
    },
    rejected: {
      label: '审核未通过',
      message: result.message || '注册申请未通过管理员审核。',
    },
  }[status]
  applicationStatusDialog.dataset.status = status
  applicationStatusLabel.textContent = content.label
  applicationStatusMessage.textContent = content.message
  const reviewComment = String(result.reviewComment || '').trim()
  applicationStatusReview.hidden = status === 'pending'
  applicationStatusReviewComment.textContent = reviewComment || '管理员未填写审核意见'
  applicationStatusUpdatedAt.textContent = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function showApplicationStatus(result) {
  showMessage('')
  applicationStatusError.hidden = true
  updateApplicationStatus(result)
  if (!applicationStatusDialog.open) applicationStatusDialog.showModal()
  applicationStatusRefresh.focus()
}

async function refreshApplicationStatus() {
  applicationStatusRefresh.disabled = true
  applicationStatusRefresh.classList.add('is-refreshing')
  applicationStatusError.hidden = true
  try {
    const result = await authAdapter.getRegistrationApplicationStatus()
    if (!result.success) {
      applicationStatusError.textContent = result.message || '刷新申请状态失败'
      applicationStatusError.hidden = false
      return
    }
    updateApplicationStatus(result)
  } catch (error) {
    applicationStatusError.textContent = error?.message || '刷新申请状态失败'
    applicationStatusError.hidden = false
  } finally {
    applicationStatusRefresh.disabled = false
    applicationStatusRefresh.classList.remove('is-refreshing')
    applicationStatusRefresh.focus()
  }
}

function hideAllPasswords() {
  document.querySelectorAll('[data-password-target]').forEach((button) => {
    const input = document.getElementById(button.dataset.passwordTarget)
    if (!input) return
    input.type = 'password'
    button.classList.remove('is-visible')
    button.setAttribute('aria-label', '显示密码')
    button.setAttribute('aria-pressed', 'false')
  })
}

function showView(id) {
  hideAllPasswords()
  views.forEach((view) => view.classList.toggle('active', view.id === id))
  document.body.classList.toggle('register-view-active', id === 'register-view')
  showMessage('')
  document.querySelector(`#${id} input, #${id} textarea`)?.focus()
  if (id === 'forgot-view') void refreshPasswordResetState()
}

function showPasswordResetStage(stage, username = '') {
  forgotApplicationStage.hidden = stage !== 'application'
  forgotStatusStage.hidden = stage !== 'status'
  forgotResetStage.hidden = stage !== 'approved'
  forgotStatusUsername.textContent = username
  const activeStage = stage === 'approved' ? forgotResetStage : stage === 'status' ? forgotStatusStage : forgotApplicationStage
  activeStage.querySelector('input, textarea, button')?.focus()
}

async function refreshPasswordResetState() {
  try {
    const state = await authAdapter.getPasswordResetState()
    showPasswordResetStage(state.success && state.hasApplication ? 'status' : 'application', state.username)
  } catch {
    showPasswordResetStage('application')
  }
}

function setBusy(form, busy) {
  form.querySelectorAll('button, input, textarea').forEach((element) => { element.disabled = busy })
}

document.querySelector('#minimize-button').addEventListener('click', () => window.desktopWindow.minimize())
document.querySelector('#close-button').addEventListener('click', () => window.desktopWindow.close())
document.querySelector('#application-status-confirm').addEventListener('click', () => {
  applicationStatusDialog.close()
  showView('login-view')
})
applicationStatusRefresh.addEventListener('click', () => { void refreshApplicationStatus() })

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view))
})

document.querySelectorAll('[data-password-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.passwordTarget)
    if (!input) return
    const shouldShow = input.type === 'password'
    input.type = shouldShow ? 'text' : 'password'
    button.classList.toggle('is-visible', shouldShow)
    button.setAttribute('aria-label', shouldShow ? '隐藏密码' : '显示密码')
    button.setAttribute('aria-pressed', String(shouldShow))
    input.focus()
  })
})

const rememberCredentials = document.querySelector('#remember-credentials')

async function loadSavedCredentials() {
  try {
    const result = await authAdapter.getSavedCredentials()
    if (!result.success || !result.credentials) return
    document.querySelector('#login-username').value = result.credentials.username || ''
    document.querySelector('#login-password').value = result.credentials.password || ''
    rememberCredentials.checked = true
  } catch {
    // 安全存储不可用时保留空表单，用户仍可正常手动登录。
  }
}

rememberCredentials.addEventListener('change', () => {
  if (!rememberCredentials.checked) void authAdapter.clearSavedCredentials()
})

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const username = document.querySelector('#login-username').value.trim()
  const password = document.querySelector('#login-password').value
  setBusy(form, true)
  try {
    const result = await authAdapter.login({
      username,
      password,
      rememberCredentials: rememberCredentials.checked,
    })
    if (result.requiresTwoFactor) {
      showView('two-factor-view')
      showMessage(result.message || '请输入两步验证码', 'info')
      return
    }
    showMessage(result.message, result.success ? 'success' : 'error')
  } catch (error) {
    showMessage(error?.message || '登录失败', 'error')
  } finally {
    setBusy(form, false)
  }
})

document.querySelector('#two-factor-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  setBusy(form, true)
  try {
    const result = await authAdapter.verifyTwoFactor(document.querySelector('#two-factor-code').value.trim())
    showMessage(result.message, result.success ? 'success' : 'error')
  } catch (error) {
    showMessage(error?.message || '两步验证失败', 'error')
  } finally {
    setBusy(form, false)
  }
})

document.querySelector('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const password = document.querySelector('#register-password').value
  if (password !== document.querySelector('#register-confirm').value) {
    showMessage('两次输入的密码不一致', 'error')
    return
  }
  setBusy(form, true)
  try {
    const result = await authAdapter.register({
      username: document.querySelector('#register-username').value.trim(),
      password,
      reason: document.querySelector('#register-reason').value.trim(),
    })
    if (result.success) {
      form.reset()
      showApplicationStatus(result)
    } else {
      showMessage(result.message, 'error')
    }
  } catch (error) {
    showMessage(error?.message || '提交申请失败', 'error')
  } finally {
    setBusy(form, false)
  }
})

document.querySelector('#forgot-status-button').addEventListener('click', async (event) => {
  const button = event.currentTarget
  button.disabled = true
  try {
    const result = await authAdapter.getPasswordResetStatus()
    if (!result.success) {
      showMessage(result.message, 'error')
      return
    }
    if (result.status === 'approved') {
      showPasswordResetStage('approved')
      showMessage(result.message || '申请已通过，请设置新密码', 'success')
      return
    }
    if (result.status === 'rejected') {
      showPasswordResetStage('application')
      showMessage(result.reviewNote || result.message || '申请未通过，请重新提交', 'error')
      return
    }
    showMessage(result.message || '申请仍在审核中', 'info')
  } catch (error) {
    showMessage(error?.message || '查询审核状态失败', 'error')
  } finally {
    button.disabled = false
  }
})

document.querySelector('#password-reset-complete-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const newPassword = document.querySelector('#reset-new-password').value
  if (newPassword !== document.querySelector('#reset-confirm-password').value) {
    showMessage('两次输入的重置密码不一致', 'error')
    return
  }
  setBusy(form, true)
  try {
    const result = await authAdapter.completePasswordReset(newPassword)
    showMessage(result.message, result.success ? 'success' : 'error')
    if (result.success) {
      form.reset()
      showPasswordResetStage('application')
    }
  } catch (error) {
    showMessage(error?.message || '重置密码失败', 'error')
  } finally {
    setBusy(form, false)
  }
})

document.querySelector('#forgot-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  setBusy(form, true)
  try {
    const result = await authAdapter.submitPasswordResetApplication({
      username: document.querySelector('#forgot-username').value.trim(),
      reason: document.querySelector('#forgot-reason').value.trim(),
    })
    showMessage(result.message, result.success ? 'success' : 'error')
    if (result.success) {
      const username = document.querySelector('#forgot-username').value.trim()
      form.reset()
      showPasswordResetStage('status', username)
    }
  } catch (error) {
    showMessage(error?.message || '提交找回密码申请失败', 'error')
  } finally {
    setBusy(form, false)
  }
})

async function loadServerStatus() {
  try {
    const status = await authAdapter.getStatus()
    if (!status.success) return
    registerViewButton.hidden = status.registrationApplicationEnabled === false
    passwordResetButton.hidden = status.passwordResetApplicationEnabled === false
    if (status.passwordLoginEnabled === false) {
      showMessage('服务器当前已关闭账号密码登录', 'info')
    } else if (status.turnstileRequired) {
      showMessage('服务器启用了人机验证，桌面登录需等待服务端开放客户端验证方式', 'info')
    }
  } catch {
    // 启动时的状态检查失败不阻止用户填写表单，提交时会显示具体网络错误。
  }
}

void loadServerStatus()
void loadSavedCredentials()

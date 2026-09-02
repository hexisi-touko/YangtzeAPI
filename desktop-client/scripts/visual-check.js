const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { loadDesktopConfig, logoPathForLoginPage } = require('../src/config')

const desktopConfig = loadDesktopConfig()

app.enableSandbox()
app.disableHardwareAcceleration()
app.setPath('userData', path.join(app.getPath('temp'), `api-client-visual-check-${process.pid}`))

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function captureWindow(window) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const image = await window.capturePage(
        { x: 0, y: 0, width: 420, height: 620 },
        { stayAwake: true },
      )
      if (!image.isEmpty()) return image.toPNG()
      lastError = new Error(`Empty screenshot on attempt ${attempt}`)
    } catch (error) {
      lastError = error
    }
    await wait(250)
  }
  throw lastError
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 420,
    height: 620,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  })
  window.setContentSize(420, 620)
  await window.loadFile(path.join(__dirname, '..', 'ui', 'login.html'), {
    query: {
      productName: desktopConfig.productName,
      logoPath: logoPathForLoginPage(desktopConfig),
    },
  })
  await wait(250)
  const [contentWidth, contentHeight] = window.getContentSize()
  if (contentWidth !== 420 || contentHeight !== 620 || window.isResizable() || window.isMaximizable() || window.isFullScreenable()) {
    throw new Error(`Unexpected window behavior: ${contentWidth}x${contentHeight}`)
  }
  const logoSlot = await window.webContents.executeJavaScript(`(() => {
    const rect = document.querySelector('#brand-logo').getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })()`)
  if (logoSlot.width !== logoSlot.height || logoSlot.width < 58 || logoSlot.width > 82) {
    throw new Error(`Unexpected logo slot size: ${logoSlot.width}x${logoSlot.height}`)
  }
  const logoState = await window.webContents.executeJavaScript(`({
    mode: document.querySelector('#brand-logo').classList.contains('has-image') ? 'custom' : 'fallback',
    source: document.querySelector('#brand-logo-image').getAttribute('src') || ''
  })`)
  console.log(`LOGO_STATE=${logoState.mode} SOURCE=${logoState.source || 'none'}`)
  const renderedProductName = await window.webContents.executeJavaScript(
    "document.querySelector('[data-product-name]').textContent",
  )
  if (renderedProductName !== desktopConfig.productName) {
    throw new Error(`Unexpected product name: ${renderedProductName}`)
  }
  const loginLayout = await window.webContents.executeJavaScript(`({
    viewportHeight: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight
  })`)
  if (loginLayout.pageHeight > loginLayout.viewportHeight) {
    throw new Error(`Login view overflows: ${loginLayout.pageHeight}px > ${loginLayout.viewportHeight}px`)
  }
  const rememberLabel = await window.webContents.executeJavaScript(
    "document.querySelector('#remember-credentials').parentElement.textContent.trim()",
  )
  if (rememberLabel !== '记住账号和密码') {
    throw new Error(`Unexpected remember-credentials label: ${rememberLabel}`)
  }
  const restoredCredentialsState = await window.webContents.executeJavaScript(`(async () => {
    window.__clearSavedCredentialsCalls = 0
    window.desktopAuth = {
      getSavedCredentials: async () => ({
        success: true,
        credentials: { username: 'restored-user', password: 'restored-password' }
      }),
      clearSavedCredentials: async () => {
        window.__clearSavedCredentialsCalls += 1
        return { success: true }
      }
    }
    await loadSavedCredentials()
    const checkbox = document.querySelector('#remember-credentials')
    const checkedAfterRestore = checkbox.checked
    checkbox.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = {
      username: document.querySelector('#login-username').value,
      password: document.querySelector('#login-password').value,
      passwordType: document.querySelector('#login-password').type,
      checkedAfterRestore,
      uncheckedAfterClick: !checkbox.checked,
      clearCalls: window.__clearSavedCredentialsCalls
    }
    checkbox.click()
    return state
  })()`)
  if (
    restoredCredentialsState.username !== 'restored-user' ||
    restoredCredentialsState.password !== 'restored-password' ||
    restoredCredentialsState.passwordType !== 'password' ||
    !restoredCredentialsState.checkedAfterRestore ||
    !restoredCredentialsState.uncheckedAfterClick ||
    restoredCredentialsState.clearCalls !== 1
  ) {
    throw new Error(`Saved credential UI failed: ${JSON.stringify(restoredCredentialsState)}`)
  }
  const passwordToggleState = await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('#login-password')
    const button = document.querySelector('[data-password-target="login-password"]')
    input.value = 'visibility-check'
    button.click()
    return {
      inputType: input.type,
      pressed: button.getAttribute('aria-pressed'),
      visibleClass: button.classList.contains('is-visible'),
      eyeVisible: getComputedStyle(button.querySelector('.password-icon-on')).display !== 'none',
      value: input.value
    }
  })()`)
  if (
    passwordToggleState.inputType !== 'text' ||
    passwordToggleState.pressed !== 'true' ||
    !passwordToggleState.visibleClass ||
    !passwordToggleState.eyeVisible ||
    passwordToggleState.value !== 'visibility-check'
  ) {
    throw new Error(`Password visibility toggle failed: ${JSON.stringify(passwordToggleState)}`)
  }
  await window.webContents.executeJavaScript("showView('login-view')")
  const hiddenPasswordState = await window.webContents.executeJavaScript(`({
    inputType: document.querySelector('#login-password').type,
    visibleClass: document.querySelector('[data-password-target="login-password"]').classList.contains('is-visible'),
    eyeOffVisible: getComputedStyle(document.querySelector('[data-password-target="login-password"] .password-icon-off')).display !== 'none'
  })`)
  if (hiddenPasswordState.inputType !== 'password' || hiddenPasswordState.visibleClass || !hiddenPasswordState.eyeOffVisible) {
    throw new Error(`Password visibility did not reset: ${JSON.stringify(hiddenPasswordState)}`)
  }
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#login-username').value = ''
    document.querySelector('#login-password').value = ''
    document.querySelector('#login-username').focus()
  })()`)
  await wait(100)
  const outputDir = path.join(__dirname, '..', 'artifacts')
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'login-window.png'), await captureWindow(window))
  await window.webContents.executeJavaScript("showView('register-view')")
  await wait(150)
  const registerState = await window.webContents.executeJavaScript(`(() => ({
    fields: Array.from(document.querySelectorAll('#register-form input, #register-form textarea')).map((field) => field.id),
    reasonMinLength: document.querySelector('#register-reason').getAttribute('minlength'),
    reasonMaxLength: document.querySelector('#register-reason').getAttribute('maxlength'),
    titlebarRegion: getComputedStyle(document.querySelector('.titlebar')).getPropertyValue('-webkit-app-region'),
    viewportHeight: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight
  }))()`)
  const expectedRegisterFields = ['register-username', 'register-password', 'register-confirm', 'register-reason']
  if (JSON.stringify(registerState.fields) !== JSON.stringify(expectedRegisterFields)) {
    throw new Error(`Unexpected register fields: ${registerState.fields.join(', ')}`)
  }
  if (registerState.reasonMinLength !== null || registerState.reasonMaxLength !== null) {
    throw new Error(`Registration reason still has a character limit: ${JSON.stringify(registerState)}`)
  }
  if (registerState.titlebarRegion !== 'no-drag') {
    throw new Error(`Register titlebar is draggable: ${registerState.titlebarRegion}`)
  }
  if (registerState.pageHeight > registerState.viewportHeight) {
    throw new Error(`Register view overflows: ${registerState.pageHeight}px > ${registerState.viewportHeight}px`)
  }
  fs.writeFileSync(path.join(outputDir, 'register-window.png'), await captureWindow(window))
  const registerErrorScrollState = await window.webContents.executeJavaScript(`(async () => {
    showMessage('两次输入的密码不一致', 'error')
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    window.scrollTo(0, 10000)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const message = document.querySelector('#form-message')
    const rect = message.getBoundingClientRect()
    const logoRect = document.querySelector('#brand-logo').getBoundingClientRect()
    return {
      viewportHeight: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
      messagePosition: getComputedStyle(message).position,
      messageTop: rect.top,
      messageBottom: rect.bottom,
      overlapsLogo: !(
        rect.right <= logoRect.left ||
        rect.left >= logoRect.right ||
        rect.bottom <= logoRect.top ||
        rect.top >= logoRect.bottom
      )
    }
  })()`)
  if (
    registerErrorScrollState.pageHeight > registerErrorScrollState.viewportHeight ||
    registerErrorScrollState.scrollY !== 0 ||
    registerErrorScrollState.messagePosition === 'fixed' ||
    registerErrorScrollState.messageTop < 0 ||
    registerErrorScrollState.messageBottom > registerErrorScrollState.viewportHeight ||
    registerErrorScrollState.overlapsLogo
  ) {
    throw new Error(`Register error allows page scrolling: ${JSON.stringify(registerErrorScrollState)}`)
  }
  fs.writeFileSync(path.join(outputDir, 'register-error-no-scroll.png'), await captureWindow(window))
  await window.webContents.executeJavaScript("showMessage('')")
  const registrationStatusState = await window.webContents.executeJavaScript(`(async () => {
    window.__registrationRefreshCalls = 0
    window.__registrationRefreshResult = { success: true, status: 'pending' }
    window.desktopAuth = {
      submitRegistrationApplication: async () => ({
        success: true,
        message: '申请已提交，请等待管理员审核',
        status: 'pending'
      }),
      getRegistrationApplicationStatus: async () => {
        window.__registrationRefreshCalls += 1
        return window.__registrationRefreshResult
      }
    }
    document.querySelector('#register-username').value = 'visual-check-user'
    document.querySelector('#register-password').value = 'password123'
    document.querySelector('#register-confirm').value = 'password123'
    document.querySelector('#register-reason').value = '用于检查注册申请弹窗'
    document.querySelector('#register-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const dialog = document.querySelector('#application-status-dialog')
    const state = {
      exists: Boolean(dialog),
      open: Boolean(dialog?.open),
      title: dialog?.querySelector('#application-status-title')?.textContent.trim() || '',
      status: dialog?.dataset.status || '',
      statusLabel: dialog?.querySelector('#application-status-label')?.textContent.trim() || '',
      message: dialog?.querySelector('#application-status-message')?.textContent.trim() || '',
      refreshHasIcon: Boolean(dialog?.querySelector('#application-status-refresh svg')),
      refreshButtonText: dialog?.querySelector('#application-status-refresh')?.textContent.trim() || '',
      refreshTitle: dialog?.querySelector('#application-status-refresh')?.getAttribute('title') || '',
      inlineMessageVisible: document.querySelector('#form-message').classList.contains('visible')
    }
    window.__registrationStatusDialog = dialog
    return state
  })()`)
  await wait(150)
  fs.writeFileSync(path.join(outputDir, 'registration-status-dialog.png'), await captureWindow(window))
  const approvedRegistrationState = await window.webContents.executeJavaScript(`(async () => {
    window.__registrationRefreshResult = {
      success: true,
      status: 'approved',
      reviewComment: '已核实项目用途'
    }
    document.querySelector('#application-status-refresh')?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const dialog = document.querySelector('#application-status-dialog')
    return {
      status: dialog?.dataset.status || '',
      statusLabel: dialog?.querySelector('#application-status-label')?.textContent.trim() || '',
      reviewComment: dialog?.querySelector('#application-status-review-comment')?.textContent.trim() || '',
      reviewVisible: !dialog?.querySelector('#application-status-review')?.hidden,
      updatedAt: dialog?.querySelector('#application-status-updated-at')?.textContent.trim() || ''
    }
  })()`)
  fs.writeFileSync(path.join(outputDir, 'registration-status-approved.png'), await captureWindow(window))
  const rejectedRegistrationState = await window.webContents.executeJavaScript(`(async () => {
    window.__registrationRefreshResult = {
      success: true,
      status: 'rejected',
      reviewComment: '申请理由需要更具体'
    }
    document.querySelector('#application-status-refresh')?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const dialog = document.querySelector('#application-status-dialog')
    return {
      status: dialog?.dataset.status || '',
      statusLabel: dialog?.querySelector('#application-status-label')?.textContent.trim() || '',
      reviewComment: dialog?.querySelector('#application-status-review-comment')?.textContent.trim() || '',
      reviewVisible: !dialog?.querySelector('#application-status-review')?.hidden,
      refreshCalls: window.__registrationRefreshCalls
    }
  })()`)
  const registrationStatusCloseState = await window.webContents.executeJavaScript(`(async () => {
    window.__registrationStatusDialog?.querySelector('#application-status-confirm')?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = {
      closedAfterConfirm: !window.__registrationStatusDialog?.open,
      returnedToLogin: document.querySelector('#login-view').classList.contains('active')
    }
    delete window.__registrationStatusDialog
    delete window.__registrationRefreshCalls
    delete window.__registrationRefreshResult
    return state
  })()`)
  if (
    !registrationStatusState.exists ||
    !registrationStatusState.open ||
    registrationStatusState.title !== '注册申请状态' ||
    registrationStatusState.status !== 'pending' ||
    registrationStatusState.statusLabel !== '待审核' ||
    !registrationStatusState.refreshHasIcon ||
    registrationStatusState.refreshButtonText !== '' ||
    registrationStatusState.refreshTitle !== '刷新申请状态' ||
    registrationStatusState.inlineMessageVisible ||
    approvedRegistrationState.status !== 'approved' ||
    approvedRegistrationState.statusLabel !== '审核已通过' ||
    !approvedRegistrationState.reviewVisible ||
    approvedRegistrationState.reviewComment !== '已核实项目用途' ||
    !approvedRegistrationState.updatedAt ||
    rejectedRegistrationState.status !== 'rejected' ||
    rejectedRegistrationState.statusLabel !== '审核未通过' ||
    !rejectedRegistrationState.reviewVisible ||
    rejectedRegistrationState.reviewComment !== '申请理由需要更具体' ||
    rejectedRegistrationState.refreshCalls !== 2 ||
    !registrationStatusCloseState.closedAfterConfirm ||
    !registrationStatusCloseState.returnedToLogin
  ) {
    throw new Error(`Registration status dialog failed: ${JSON.stringify({ initial: registrationStatusState, approved: approvedRegistrationState, rejected: rejectedRegistrationState, closed: registrationStatusCloseState })}`)
  }
  await window.webContents.executeJavaScript("showView('forgot-view')")
  await wait(150)
  const forgotState = await window.webContents.executeJavaScript(`(() => ({
    fields: Array.from(document.querySelectorAll('#forgot-form input, #forgot-form textarea')).map((field) => field.id),
    reasonMinLength: document.querySelector('#forgot-reason').getAttribute('minlength'),
    reasonMaxLength: document.querySelector('#forgot-reason').getAttribute('maxlength'),
    viewportHeight: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight
  }))()`)
  const expectedForgotFields = ['forgot-username', 'forgot-reason']
  if (JSON.stringify(forgotState.fields) !== JSON.stringify(expectedForgotFields)) {
    throw new Error(`Unexpected password reset fields: ${forgotState.fields.join(', ')}`)
  }
  if (forgotState.reasonMinLength !== null || forgotState.reasonMaxLength !== null) {
    throw new Error(`Password reset reason still has a character limit: ${JSON.stringify(forgotState)}`)
  }
  if (forgotState.pageHeight > forgotState.viewportHeight) {
    throw new Error(`Password reset view overflows: ${forgotState.pageHeight}px > ${forgotState.viewportHeight}px`)
  }
  fs.writeFileSync(path.join(outputDir, 'forgot-window.png'), await captureWindow(window))
  await window.webContents.executeJavaScript("showPasswordResetStage('approved')")
  await wait(150)
  const approvedResetState = await window.webContents.executeJavaScript(`(() => ({
    fields: Array.from(document.querySelectorAll('#password-reset-complete-form input')).map((field) => field.id),
    viewportHeight: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight
  }))()`)
  const expectedApprovedResetFields = ['reset-new-password', 'reset-confirm-password']
  if (JSON.stringify(approvedResetState.fields) !== JSON.stringify(expectedApprovedResetFields)) {
    throw new Error(`Unexpected approved password reset fields: ${approvedResetState.fields.join(', ')}`)
  }
  if (approvedResetState.pageHeight > approvedResetState.viewportHeight) {
    throw new Error(`Approved password reset view overflows: ${approvedResetState.pageHeight}px > ${approvedResetState.viewportHeight}px`)
  }
  fs.writeFileSync(path.join(outputDir, 'password-reset-approved-window.png'), await captureWindow(window))
  const noScrollStates = await window.webContents.executeJavaScript(`(async () => {
    const cases = [
      { view: 'login-view' },
      { view: 'register-view' },
      { view: 'two-factor-view' },
      { view: 'forgot-view', stage: 'application' },
      { view: 'forgot-view', stage: 'status' },
      { view: 'forgot-view', stage: 'approved' }
    ]
    const results = []
    for (const testCase of cases) {
      showView(testCase.view)
      if (testCase.stage) showPasswordResetStage(testCase.stage, 'scroll-check-user')
      showMessage('这是一条用于检查任何状态提示都不会改变页面高度的较长消息。'.repeat(4), 'error')
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      window.scrollTo(0, 10000)
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const activeView = document.querySelector('.auth-view.active').getBoundingClientRect()
      const messageRect = document.querySelector('#form-message').getBoundingClientRect()
      const logoRect = document.querySelector('#brand-logo').getBoundingClientRect()
      results.push({
        name: testCase.stage ? testCase.view + ':' + testCase.stage : testCase.view,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        scrollY: window.scrollY,
        activeViewBottom: activeView.bottom,
        messageTop: messageRect.top,
        messageBottom: messageRect.bottom,
        overlapsLogo: !(
          messageRect.right <= logoRect.left ||
          messageRect.left >= logoRect.right ||
          messageRect.bottom <= logoRect.top ||
          messageRect.top >= logoRect.bottom
        )
      })
      showMessage('')
    }
    return results
  })()`)
  const scrollingState = noScrollStates.find((state) => (
    state.documentHeight > state.viewportHeight ||
    state.bodyHeight > state.viewportHeight ||
    state.scrollY !== 0 ||
    state.activeViewBottom > state.viewportHeight ||
    state.messageTop < 0 ||
    state.messageBottom > state.viewportHeight ||
    state.overlapsLogo
  ))
  if (scrollingState) {
    throw new Error(`Auth state allows page scrolling: ${JSON.stringify(scrollingState)}`)
  }
  window.destroy()
  app.exit(0)
}).catch((error) => {
  console.error(error)
  app.exit(1)
})

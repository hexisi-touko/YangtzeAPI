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
  const outputDir = path.join(__dirname, '..', 'artifacts')
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'login-window.png'), await captureWindow(window))
  await window.webContents.executeJavaScript("showView('register-view')")
  await wait(150)
  const registerState = await window.webContents.executeJavaScript(`(() => ({
    fields: Array.from(document.querySelectorAll('#register-form input, #register-form textarea')).map((field) => field.id),
    titlebarRegion: getComputedStyle(document.querySelector('.titlebar')).getPropertyValue('-webkit-app-region'),
    viewportHeight: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight
  }))()`)
  const expectedRegisterFields = ['register-username', 'register-password', 'register-confirm', 'register-reason']
  if (JSON.stringify(registerState.fields) !== JSON.stringify(expectedRegisterFields)) {
    throw new Error(`Unexpected register fields: ${registerState.fields.join(', ')}`)
  }
  if (registerState.titlebarRegion !== 'no-drag') {
    throw new Error(`Register titlebar is draggable: ${registerState.titlebarRegion}`)
  }
  if (registerState.pageHeight > registerState.viewportHeight) {
    throw new Error(`Register view overflows: ${registerState.pageHeight}px > ${registerState.viewportHeight}px`)
  }
  fs.writeFileSync(path.join(outputDir, 'register-window.png'), await captureWindow(window))
  await window.webContents.executeJavaScript("showView('forgot-view')")
  await wait(150)
  const forgotState = await window.webContents.executeJavaScript(`(() => ({
    fields: Array.from(document.querySelectorAll('#forgot-form input, #forgot-form textarea')).map((field) => field.id),
    viewportHeight: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight
  }))()`)
  const expectedForgotFields = ['forgot-username', 'forgot-reason']
  if (JSON.stringify(forgotState.fields) !== JSON.stringify(expectedForgotFields)) {
    throw new Error(`Unexpected password reset fields: ${forgotState.fields.join(', ')}`)
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
  window.destroy()
  app.exit(0)
}).catch((error) => {
  console.error(error)
  app.exit(1)
})

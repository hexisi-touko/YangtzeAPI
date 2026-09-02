const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { loadDesktopConfig } = require('../src/config')

app.enableSandbox()
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.setPath('userData', path.join(app.getPath('temp'), `api-client-icon-${process.pid}`))

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function captureIcon(window) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const image = await window.capturePage(
        { x: 0, y: 0, width: 256, height: 256 },
        { stayAwake: true },
      )
      if (!image.isEmpty()) return image.toPNG()
      lastError = new Error(`第 ${attempt} 次捕获到空图标`)
    } catch (error) {
      lastError = error
    }
    await wait(250)
  }
  throw lastError
}

function pngToIco(png) {
  const icoHeaderAndEntry = Buffer.alloc(22)
  icoHeaderAndEntry.writeUInt16LE(0, 0)
  icoHeaderAndEntry.writeUInt16LE(1, 2)
  icoHeaderAndEntry.writeUInt16LE(1, 4)
  icoHeaderAndEntry.writeUInt8(0, 6)
  icoHeaderAndEntry.writeUInt8(0, 7)
  icoHeaderAndEntry.writeUInt8(0, 8)
  icoHeaderAndEntry.writeUInt8(0, 9)
  icoHeaderAndEntry.writeUInt16LE(1, 10)
  icoHeaderAndEntry.writeUInt16LE(32, 12)
  icoHeaderAndEntry.writeUInt32LE(png.length, 14)
  icoHeaderAndEntry.writeUInt32LE(22, 18)
  return Buffer.concat([icoHeaderAndEntry, png])
}

app.whenReady().then(async () => {
  const config = loadDesktopConfig()
  const projectRoot = path.join(__dirname, '..')
  const logoPath = path.join(projectRoot, ...config.logoPath.split('/'))
  const outputPath = path.join(projectRoot, ...config.appIconPath.split('/'))
  if (!fs.existsSync(logoPath)) throw new Error(`Logo 文件不存在：${logoPath}`)

  const window = new BrowserWindow({
    width: 256,
    height: 256,
    x: -10_000,
    y: -10_000,
    show: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })
  window.setContentSize(256, 256)
  await window.loadFile(path.join(__dirname, 'icon-render.html'), {
    query: { logo: pathToFileURL(logoPath).toString() },
  })
  await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const image = document.querySelector('#icon-source')
    if (image.complete && image.naturalWidth > 0) return resolve()
    image.addEventListener('load', resolve, { once: true })
    image.addEventListener('error', () => reject(new Error('Logo 渲染失败')), { once: true })
  })`)
  await wait(250)

  const png = await captureIcon(window)
  if (png.length < 1000) throw new Error('生成的图标内容为空')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, pngToIco(png))
  console.log(`ICON_GENERATED=${outputPath}`)
  window.destroy()
  app.exit(0)
}).catch((error) => {
  console.error(error.message)
  app.exit(1)
})

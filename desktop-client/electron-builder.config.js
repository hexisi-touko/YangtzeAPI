const { loadDesktopConfig } = require('./src/config')

const desktopConfig = loadDesktopConfig()

module.exports = {
  publish: null,
  appId: 'com.apirelay.desktop',
  productName: desktopConfig.productName,
  asar: true,
  directories: {
    output: 'dist',
  },
  files: [
    'main.js',
    'preload.js',
    'user-preload.js',
    'src/**/*.js',
    'build/icon.ico',
    'desktop.config.json',
    'desktop.config.example.json',
    'ui/*.html',
    'ui/*.css',
    'ui/*.js',
    'ui/assets/*.svg',
    'ui/assets/*.png',
  ],
  win: {
    target: ['nsis', 'portable'],
    artifactName: `${desktopConfig.artifactBaseName}-\${version}-\${arch}-\${ext}`,
    icon: desktopConfig.appIconPath,
  },
  nsis: {
    artifactName: `${desktopConfig.artifactBaseName}-Setup-\${version}-\${arch}.\${ext}`,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: desktopConfig.productName,
  },
  portable: {
    artifactName: `${desktopConfig.artifactBaseName}-Portable-\${version}-\${arch}.\${ext}`,
  },
}

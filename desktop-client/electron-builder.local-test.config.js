process.env.DESKTOP_CONFIG_FILE = 'desktop.config.local-test.json'

const baseConfig = require('./electron-builder.config')

module.exports = {
  ...baseConfig,
  electronDist: 'node_modules/electron/dist',
  directories: {
    ...baseConfig.directories,
    output: 'dist-local-test',
  },
  extraMetadata: {
    main: 'main.local-test.js',
  },
  files: [
    ...baseConfig.files,
    'main.local-test.js',
    'desktop.config.local-test.json',
  ],
}

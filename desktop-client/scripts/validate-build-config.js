const { loadDesktopConfig } = require('../src/config')

function validateBuildConfig(config, mode) {
  if (!['LocalTest', 'Production'].includes(mode)) throw new Error('Unknown build mode')
  const url = new URL(config.serverUrl)
  if (mode === 'Production') {
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (url.protocol !== 'https:' || config.allowInsecureHttp ||
        host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        host === '::1' || host === '::' || /^127\./.test(host) || host === '0.0.0.0') {
      throw new Error('Production requires a non-loopback HTTPS server and allowInsecureHttp=false. Use LocalTest for local builds.')
    }
  }
}

if (require.main === module) {
  const mode = process.argv[2]
  const config = loadDesktopConfig(mode === 'Production' ? 'desktop.config.json' : 'desktop.config.local-test.json')
  validateBuildConfig(config, mode)
  console.log(`${mode} configuration valid: ${config.serverUrl}`)
}
module.exports = { validateBuildConfig }

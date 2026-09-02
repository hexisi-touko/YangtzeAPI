export {}

type CodexIntegrationResult = {
  success: boolean
  configured?: boolean
  locallyConfigured?: boolean
  providerConfigured?: boolean
  keyConfigured?: boolean
  keyPresent?: boolean
  configExists?: boolean
  authExists?: boolean
  serviceReachable?: boolean | null
  backupCreated?: boolean
  keyStorage?: 'provider' | 'legacy-auth' | 'none'
  legacyConfiguration?: boolean
  officialLoginPreserved?: boolean
  ccSwitchDetected?: boolean
  externalProviderActive?: boolean
  activeProvider?: string
  codexHome?: string
  serviceUrl?: string
  message?: string
  code?: string
}

declare global {
  interface Window {
    yangtzeDesktop?: {
      getCodexStatus: () => Promise<CodexIntegrationResult>
      configureCodex: () => Promise<CodexIntegrationResult>
      detectCodex: () => Promise<CodexIntegrationResult>
    }
  }
}

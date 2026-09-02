export {}

type CodexIntegrationResult = {
  success: boolean
  configured?: boolean
  providerConfigured?: boolean
  keyConfigured?: boolean
  keyPresent?: boolean
  configExists?: boolean
  authExists?: boolean
  serviceReachable?: boolean | null
  backupCreated?: boolean
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

// Browser-only preview. Electron always supplies the real IPC bridge.
if (!window.desktopTools && new URLSearchParams(location.search).get('preview') === '1') {
  const models = ['gpt-5.5', 'gpt-5.6-luna', 'gpt-5.6-terra', 'kimi-k2', 'kimi-k2-thinking', 'kimi-k2.5', 'kimi-k2.6', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k3', 'kimi-k3-256k']
  let tools = [
    { id: 'claude-code', name: 'Claude Code', model: 'claude-sonnet-4-20250514', status: 'disabled' },
    { id: 'codex-gpt', name: 'Codex', model: 'kimi-k3', status: 'enabled' },
  ].map((tool) => ({ ...tool, providerName: 'test9', apiKey: 'sk-preview-example', apiBaseUrl: 'http://127.0.0.1:3000/v1', availableModels: models }))
  const state = () => ({ success: true, tools, account: { username: 'test9' }, serverUrl: 'http://127.0.0.1:3000', productName: '长大计科智慧油田 LocalTest' })
  window.desktopTools = {
    getState: async () => state(), refresh: async () => state(),
    getModels: async () => ({ ...state(), models, model: tools.find((tool) => tool.id === 'codex-gpt').model }),
    applyModels: async (id, selection) => {
      tools = tools.map((tool) => tool.id === id ? { ...tool, model: selection.model } : tool)
      return { ...state(), message: '预览中的模型已更新' }
    },
    ping: async () => ({ success: true, latencyMs: 24 }),
    enable: async (id) => { tools = tools.map((tool) => tool.id === id ? { ...tool, status: 'enabled' } : tool); return { success: true } },
    disable: async (id) => { tools = tools.map((tool) => tool.id === id ? { ...tool, status: 'disabled' } : tool); return { success: true } },
    launch: async () => ({ success: true, launched: false, message: '预览模式：未启动本机应用' }),
    openDashboard: async () => ({ success: false, message: '预览模式：未连接管理后台' }),
    logout: async () => ({ success: false, message: '预览模式：当前为示例账号' }),
  }
}

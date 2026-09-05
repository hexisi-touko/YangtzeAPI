async (page) => {
  await page.evaluate(async () => {
    window.__modelFailure = false
    const available = ['gpt-5.6-terra', 'kimi-k3', 'kimi-k3-256k', 'model-with-a-very-long-name-for-layout-verification-2026']
    let tools = [
      { id: 'codex-gpt', name: 'Codex', providerName: 'model-test', model: 'gpt-5.6-terra', status: 'disabled', apiKey: 'sk-ui-test', apiBaseUrl: 'http://127.0.0.1:3000/v1', availableModels: ['gpt-5.6-terra'] },
      { id: 'claude-code', name: 'Claude Code', model: 'claude-sonnet', status: 'disabled' },
      { id: 'gemini', name: 'Gemini', model: 'gemini-pro', status: 'disabled' },
    ]
    window.desktopTools = {
      getState: async () => ({ success: true, tools, account: { username: 'model-test' }, serverUrl: 'http://127.0.0.1:3000', productName: '长大计科智慧油田' }),
      getModels: async () => {
        if (window.__modelFailure) return { success: false, message: '测试：模型列表暂不可用' }
        tools = tools.map((tool) => tool.id === 'codex-gpt' ? { ...tool, availableModels: available, status: 'enabled' } : tool)
        window.__syncedModels = available
        return { success: true, tools, models: available, model: tools[0].model }
      },
      applyModels: async (_id, selection) => {
        window.__appliedSelection = selection
        tools = tools.map((tool) => tool.id === 'codex-gpt' ? { ...tool, ...selection, status: 'enabled', availableModels: available } : tool)
        return { success: true, tools, message: '已应用，重启 Codex 后生效' }
      },
    }
    await load()
  })
  if (await page.locator('.provider-card').count() !== 2) throw new Error('Expected two tool cards')
  await page.setViewportSize({ width: 1060, height: 720 })
  await page.locator('[data-tool-id="codex-gpt"] .btn-view-edit').click()
  await page.locator('#tab-models').click()
  await page.locator('#modal-fetch-models').click()
  if (!(await page.locator('#modal-config-toml').inputValue()).includes('name = "model-test"')) throw new Error('Provider preview must use the current account name')
  if (await page.locator('.mapping-preview-box input[type="checkbox"]').count()) throw new Error('Model checkboxes must be removed')
  if (await page.locator('#modal-provider-model option').count() !== 4) throw new Error('Every fetched model must be selectable')
  if ((await page.evaluate(() => window.__syncedModels)).length !== 4) throw new Error('Fetching must sync all models')
  await page.locator('#modal-provider-model').selectOption('kimi-k3')
  await page.locator('#modal-model-search').fill('kimi')
  if (await page.locator('.mapping-row-item').count() !== 2) throw new Error('Search did not filter models')
  await page.locator('#modal-apply-models').click()
  await page.waitForFunction(() => document.querySelector('#modal-model-status').textContent.includes('重启 Codex'))
  const applied = await page.evaluate(() => window.__appliedSelection)
  if (applied.model !== 'kimi-k3' || Object.hasOwn(applied, 'selectedModels')) throw new Error('Only the default model should be submitted')
  await page.locator('#modal-model-search').fill('')
  await page.locator('#modal-fetch-models').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'output/playwright/model-picker-desktop.png' })
  await page.setViewportSize({ width: 840, height: 580 })
  await page.locator('.mapping-preview-box').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'output/playwright/model-picker-compact.png' })
  const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    images: [...document.querySelectorAll('.agent-icon-image')].every((image) => image.complete && image.naturalWidth > 0),
    footer: document.querySelector('.modal-footer').getBoundingClientRect().bottom,
  }))
  if (layout.scroll > layout.width || !layout.images || layout.footer > 580) throw new Error(JSON.stringify(layout))
  await page.evaluate(() => { window.__modelFailure = true })
  await page.locator('#modal-fetch-models').click()
  await page.waitForFunction(() => document.querySelector('#modal-model-status').textContent.includes('暂不可用'))
  if (await page.locator('#modal-provider-model').inputValue() !== 'kimi-k3') throw new Error('Failed refresh reset selection')
  await page.locator('#modal-btn-close').click()
  await page.locator('[data-tool-id="codex-gpt"] .btn-view-edit').click()
  await page.locator('#tab-models').click()
  if (await page.locator('#modal-provider-model').inputValue() !== 'kimi-k3') throw new Error('Reopening reset selection')
  return { cards: 2, selected: applied, layout, refreshFailurePreservesSelection: true }
}

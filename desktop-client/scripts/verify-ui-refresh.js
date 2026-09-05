async (page) => {
  await page.goto('http://127.0.0.1:4319/tool-switcher.html?preview=1')
  await page.setViewportSize({ width: 1360, height: 860 })
  const inspect = async () => {
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      images: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      actions: document.querySelectorAll('.provider-card .action-icon-group button').length,
      modelsOnCards: /kimi|gpt-5|claude-sonnet/.test(document.querySelector('#provider-cards-list').textContent),
    }))
    if (result.overflow || !result.images || result.modelsOnCards || result.actions !== 10) throw new Error(JSON.stringify(result))
  }
  await inspect()
  await page.screenshot({ path: 'output/playwright/ui-refresh-main.png', animations: 'disabled' })
  await page.locator('[data-tool-id="codex-gpt"] .btn-view-edit').click()
  if (!(await page.locator('#panel-connection').isVisible())) throw new Error('Connection must be the initial tab')
  await page.screenshot({ path: 'output/playwright/ui-refresh-connection.png', animations: 'disabled' })
  await page.locator('#tab-models').click()
  await page.locator('#modal-fetch-models').click()
  await page.locator('#modal-provider-model').selectOption('kimi-k2.6')
  await page.locator('#modal-model-search').fill('kimi')
  if (await page.locator('.mapping-row-item').count() !== 8) throw new Error('Model search failed')
  await page.locator('#modal-apply-models').click()
  await page.screenshot({ path: 'output/playwright/ui-refresh-models.png', animations: 'disabled' })
  await page.locator('#tab-models').focus()
  await page.keyboard.press('ArrowRight')
  if (!(await page.locator('#panel-advanced').isVisible())) throw new Error('Keyboard tab selection failed')
  await page.screenshot({ path: 'output/playwright/ui-refresh-advanced.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await page.locator('[data-tool-id="claude-code"] .btn-view-edit').click()
  await page.locator('#tab-models').click()
  await page.locator('#modal-provider-model').selectOption('kimi-k3')
  await page.locator('#modal-apply-models').click()
  if (await page.locator('#modal-model-status').textContent() !== '预览中的模型已更新') throw new Error('Claude must apply a shared model')
  await page.keyboard.press('Escape')
  await page.locator('#theme-toggle-btn').click()
  await page.screenshot({ path: 'output/playwright/ui-refresh-dark.png', animations: 'disabled' })
  for (const width of [840, 390]) {
    await page.setViewportSize({ width, height: 720 })
    await inspect()
    await page.locator('[data-tool-id="codex-gpt"] .btn-view-edit').click()
    await page.locator('#tab-models').click()
    const rect = await page.locator('.modal-footer').boundingBox()
    if (rect.y + rect.height > 720) throw new Error('Footer overflows')
    await page.screenshot({ path: `output/playwright/ui-refresh-${width}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
  }
  await page.setViewportSize({ width: 1360, height: 860 })
  await page.locator('#theme-toggle-btn').click()
  return { tabs: 3, actions: 10, viewports: [1360, 840, 390], modelSearchAndApply: true }
}

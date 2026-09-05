const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn, execFileSync } = require('node:child_process')
const { createInterface } = require('node:readline')
const { CodexAdapter } = require('../src/tool-sync/codex-adapter')

async function main() {
  const captured = []
  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      captured.push({ model: body.model, reasoning: body.reasoning })
      const item = { id: 'msg_test', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'OK', annotations: [] }] }
      const response = { id: 'resp_test', object: 'response', created_at: 1, status: 'completed', model: body.model, output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      for (const event of [
        { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
        { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } },
        { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: 'OK' },
        { type: 'response.output_item.done', output_index: 0, item },
        { type: 'response.completed', response },
      ]) res.write(`data: ${JSON.stringify(event)}\n\n`)
      res.end()
    } catch (error) { res.writeHead(400); res.end(error.message) }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-reasoning-'))
  const adapter = new CodexAdapter({ homeDir: directory })
  const models = ['kimi-k3', 'kimi-k3-256k', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5']
  adapter.apply({ apiKey: 'sk-local-test', apiBaseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: 'kimi-k3-256k', availableModels: models, providerName: 'account-test' })
  const command = process.env.CODEX_BINARY || path.join(os.homedir(), '.npm-global/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe')
  const child = spawn(command, ['app-server', '--stdio'], { cwd: directory, env: { ...process.env, CODEX_HOME: path.dirname(adapter.configPath) }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  child.stderr.resume()
  let id = 0
  const pending = new Map()
  const turns = new Map()
  createInterface({ input: child.stdout }).on('line', (line) => {
    const value = JSON.parse(line)
    if (pending.has(value.id)) { pending.get(value.id)(value); pending.delete(value.id) }
    if (value.method === 'turn/completed') turns.set(value.params.turn.id, value.params.turn)
  })
  const request = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timeout: ${method}`)) }, 20000)
    pending.set(requestId, (value) => { clearTimeout(timeout); value.error ? reject(new Error(JSON.stringify(value.error))) : resolve(value.result) })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n')
  })
  try {
    await request('initialize', { clientInfo: { name: 'reasoning-test', version: '1.0.0' }, capabilities: { experimentalApi: true } })
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
    const result = await request('model/list', { includeHidden: false })
    for (const model of ['kimi-k3', 'kimi-k3-256k']) {
      const entry = result.data.find((m) => m.model === model)
      assert.deepEqual(entry.supportedReasoningEfforts.map((e) => e.reasoningEffort), ['low', 'high', 'max'])
      assert.equal(entry.defaultReasoningEffort, 'max')
    }
    console.log('CATALOG: installed Codex exposes low/high/max for both K3 models')
    for (const model of ['kimi-k3', 'kimi-k3-256k']) {
      for (const effort of ['low', 'high', 'max']) {
        const thread = await request('thread/start', { model, cwd: directory, approvalPolicy: 'never', sandbox: 'read-only' })
        const before = captured.length
        const started = await request('turn/start', { threadId: thread.thread.id, input: [{ type: 'text', text: 'Reply OK.', text_elements: [] }], effort })
        const deadline = Date.now() + 20000
        while (!turns.has(started.turn.id) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100))
        assert.equal(turns.get(started.turn.id)?.status, 'completed')
        assert.equal(captured.length, before + 1)
        assert.deepEqual(captured.at(-1), { model, reasoning: { effort } })
        console.log(`WIRE: ${model} reasoning.effort=${effort}`)
      }
    }
  } finally {
    child.stdin.end()
    const closed = new Promise((resolve) => child.once('close', resolve))
    if (child.exitCode === null) execFileSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    await closed
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
  if (!process.argv.includes('--live')) return
  const apiKey = execFileSync('python', ['-c', "import sqlite3; c=sqlite3.connect('file:D:/codex/new-api-local/data/one-api.db?mode=ro',uri=True); k=c.execute('SELECT key FROM tokens WHERE id=2').fetchone()[0]; print(k if k.startswith('sk-') else 'sk-'+k)"], { encoding: 'utf8', windowsHide: true }).trim()
  for (const model of ['kimi-k3', 'kimi-k3-256k']) {
    for (const effort of ['low', 'high', 'max']) {
      const res = await fetch('http://127.0.0.1:3000/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ model, reasoning: { effort }, input: 'Reply exactly OK.', stream: true, max_output_tokens: 128 }),
      })
      assert.equal(res.status, 200, `${model}/${effort} HTTP ${res.status}`)
      const events = (await res.text()).split(/\r?\n/).filter((line) => line.startsWith('data: {')).map((line) => JSON.parse(line.slice(6)))
      const final = events.find((event) => event.type === 'response.completed')
      assert.ok(final, `${model}/${effort} must complete`)
      console.log(`LIVE: ${model}/${effort} completed; response reasoning=${JSON.stringify(final.response.reasoning ?? null)}`)
    }
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })

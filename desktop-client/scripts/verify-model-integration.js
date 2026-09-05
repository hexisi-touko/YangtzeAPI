const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const { createInterface } = require('node:readline')
const { CodexAdapter } = require('../src/tool-sync/codex-adapter')

// Opt-in local integration check; credentials stay in memory and the isolated home.
async function main() {
  const apiKey = execFileSync('python', ['-c',
    "import sqlite3; c=sqlite3.connect('file:D:/codex/new-api-local/data/one-api.db?mode=ro',uri=True); k=c.execute('SELECT key FROM tokens WHERE id=2').fetchone()[0]; print(k if k.startswith('sk-') else 'sk-'+k)",
  ], { encoding: 'utf8', windowsHide: true }).trim()
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  const models = await fetch('http://127.0.0.1:3000/v1/models', { headers }).then((r) => r.json())
  assert.ok(models.data.some((m) => m.id === 'kimi-k3'))
  const tools = [{ type: 'function', name: 'read_fixture', description: 'Read the test fixture.', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }, strict: true }]
  async function response(input, toolChoice) {
    const result = await fetch('http://127.0.0.1:3000/v1/responses', {
      method: 'POST', headers, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ model: 'kimi-k3', input, tools, tool_choice: toolChoice, stream: true, max_output_tokens: 512 }),
    })
    assert.equal(result.status, 200)
    const events = (await result.text()).split(/\r?\n/).filter((line) => line.startsWith('data: {')).map((line) => JSON.parse(line.slice(6)))
    const final = events.find((event) => event.type === 'response.completed')
    assert.ok(final, 'Responses stream must finish with response.completed')
    return final.response
  }
  const input = [{ role: 'user', content: 'Call read_fixture and then reply with the exact fixture value.' }]
  const first = await response(input, { type: 'function', name: 'read_fixture' })
  const call = first.output.find((item) => item.type === 'function_call')
  assert.equal(call?.name, 'read_fixture')
  assert.deepEqual(JSON.parse(call.arguments), {})
  const second = await response([...input, ...first.output, { type: 'function_call_output', call_id: call.call_id, output: 'fixture-verified-42' }], 'auto')
  assert.ok(second.output.some((item) => item.content?.some((part) => part.text?.includes('fixture-verified-42'))))
  console.log('LIVE_RESPONSES: kimi-k3 streaming tool call and result replay passed')

  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-model-integration-'))
  const adapter = new CodexAdapter({ homeDir })
  adapter.apply({ apiKey, apiBaseUrl: 'http://127.0.0.1:3000/v1', model: 'kimi-k3', availableModels: ['kimi-k3', 'gpt-5.6-terra'] })
  const command = process.env.CODEX_BINARY || path.join(os.homedir(), '.npm-global', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe')
  const child = spawn(command, ['app-server', '--stdio'], {
    cwd: homeDir, env: { ...process.env, CODEX_HOME: path.dirname(adapter.configPath) }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  })
  let diagnostics = ''
  child.stderr.on('data', (chunk) => { diagnostics += chunk.toString().replaceAll(apiKey, '[redacted]') })
  const pending = new Map()
  createInterface({ input: child.stdout }).on('line', (line) => {
    try {
      const value = JSON.parse(line)
      if (value.id !== undefined && pending.has(value.id)) {
        pending.get(value.id)(value)
        pending.delete(value.id)
      }
    } catch { /* Ignore non-JSON diagnostics. */ }
  })
  let id = 0
  const request = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timed out: ${method}; ${diagnostics.slice(-1200)}`)) }, 20000)
    pending.set(requestId, (value) => { clearTimeout(timer); value.error ? reject(new Error(JSON.stringify(value.error))) : resolve(value.result) })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n')
  })
  try {
    await request('initialize', { clientInfo: { name: 'model-integration', version: '1.0.0' }, capabilities: { experimentalApi: true } })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n')
    const result = await request('model/list', { includeHidden: false })
    assert.ok(result.data.some((m) => m.model === 'kimi-k3'), JSON.stringify(result))
    console.log('CODEX_CATALOG: installed Codex app-server lists kimi-k3 and accepts generated configuration')
    if (process.env.CODEX_VERIFY_FILE_WORKFLOW !== '1') return
    const workspace = path.join(homeDir, 'workspace')
    fs.mkdirSync(workspace)
    fs.writeFileSync(path.join(workspace, 'input.txt'), 'fixture-42\n')
    const run = spawn(command, ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', workspace,
      'Read input.txt. Create output.txt containing the input text converted to uppercase. Then use a terminal command to verify the contents. Work only in this workspace.'],
    { cwd: workspace, env: { ...process.env, CODEX_HOME: path.dirname(adapter.configPath) }, windowsHide: true, stdio: 'ignore' })
    const timer = setTimeout(() => run.kill(), 120000)
    const code = await new Promise((resolve) => run.once('exit', resolve))
    clearTimeout(timer)
    assert.equal(code, 0, 'Codex file workflow should exit successfully')
    assert.equal(fs.readFileSync(path.join(workspace, 'output.txt'), 'utf8').trim(), 'FIXTURE-42')
    console.log('CODEX_WORKFLOW: kimi-k3 read, wrote, and verified a file in an isolated workspace')
  } finally {
    child.stdin.end()
    const closed = new Promise((resolve) => child.once('close', resolve))
    if (process.platform === 'win32' && child.exitCode === null) {
      execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else if (child.exitCode === null) child.kill()
    await closed
    await fs.promises.rm(homeDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })

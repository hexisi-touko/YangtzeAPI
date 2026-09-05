const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { buildCatalog } = require('../src/tool-sync/codex-adapter')

async function main() {
  const key = execFileSync('python', ['-c',
    "import sqlite3; c=sqlite3.connect('file:D:/codex/new-api-local/data/one-api.db?mode=ro',uri=True); k=c.execute('SELECT key FROM tokens WHERE id=2').fetchone()[0]; print(k if k.startswith('sk-') else 'sk-'+k)",
  ], { encoding: 'utf8', windowsHide: true }).trim()
  const parameters = {
    type: 'object',
    properties: { prompt: { $ref: '#/$defs/__schema20', description: 'Prompt to process' } },
    required: ['prompt'], additionalProperties: false,
    $defs: { __schema20: { $ref: '#/$defs/text', type: 'string', minLength: 1 }, text: { type: 'string' } },
  }
  const tools = [{ type: 'function', name: 'schema_fixture', description: 'Process the supplied prompt.', parameters }]
  const input = [{ role: 'user', content: 'Call schema_fixture once with prompt set to fixture-42.' }]
  async function request(model, items, choice) {
    const result = await fetch('http://127.0.0.1:3000/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ model, tools, input: items, tool_choice: choice, stream: true, max_output_tokens: 1024 }),
    })
    const text = await result.text()
    if (process.argv.includes('--expect-rejection')) {
      assert.equal(result.status, 400)
      assert.ok(text.includes('when using $ref, type should be defined'))
      console.log('REPRODUCED: HTTP 400 Moonshot $ref sibling rejection at $defs.__schema20')
      return null
    }
    assert.equal(result.status, 200, text.slice(0, 500))
    const events = text.split(/\r?\n/).filter((line) => line.startsWith('data: {')).map((line) => JSON.parse(line.slice(6)))
    const done = events.find((event) => event.type === 'response.completed')
    assert.ok(done, 'Stream must complete')
    return done.response
  }
  let models = ['kimi-k3']
  if (process.argv.includes('--all-models')) {
    const result = await fetch('http://127.0.0.1:3000/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) })
    assert.equal(result.status, 200)
    models = (await result.json()).data.map((m) => m.id).filter((id) => id.startsWith('kimi-'))
    assert.ok(models.length > 0)
  }
  assert.deepEqual(buildCatalog(models).models.map((m) => m.slug), models)
  const failures = []
  for (const model of models) {
    try {
      const first = await request(model, input, { type: 'function', name: 'schema_fixture' })
      if (!first) return
      const call = first.output.find((item) => item.type === 'function_call')
      assert.equal(call?.name, 'schema_fixture')
      assert.equal(JSON.parse(call.arguments).prompt, 'fixture-42')
      const second = await request(model, [...input, ...first.output, { type: 'function_call_output', call_id: call.call_id, output: 'fixture-processed' }], 'none')
      assert.ok(second.output.some((item) => item.type === 'message'))
      console.log(`PASS: ${model} catalog, nested $ref, streaming tool call and result replay`)
    } catch (error) {
      failures.push(model)
      console.error(`FAIL: ${model}: ${error.message.replaceAll(key, '[redacted]').slice(0, 500)}`)
    }
  }
  assert.deepEqual(failures, [], 'All advertised Kimi models must complete the workflow')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })

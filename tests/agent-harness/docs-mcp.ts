/* Docs over MCP (spec M5): a model, given only the MCP instructions and tools, writes each task's doc through the real
   MCP handler (in this process, on the in-memory Db), then the doc is read back and checked. No account or database is
   touched; the model is OpenRouter's (OPENROUTER_API_KEY from .env, OPENROUTER_MODEL or Haiku). Judgment checks answer
   as passes: this run is about the doc tools and the code checks.
   Run from the repo root:  npx vite-node tests/agent-harness/docs-mcp.ts [--only=<id>] [--steps=60]
   Writes tests/agent-harness/results-docs.json. */
import { readFileSync, writeFileSync } from 'node:fs'
import { mcpHandler } from '../../api/_lib/mcp'
import { parseDoc } from '../../src/engine/docs/parse'
import { validateDoc } from '../../src/engine/docs/validate'
import { INSTRUCTIONS } from '../../src/engine/tools/instructions'
import { TOOLS, openAiView } from '../../src/engine/tools'
import { fakeDb } from '../unit/fake-db'
import { fakeJev } from '../unit/fakes'

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').flatMap((l) => { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); return m ? [[m[1], m[2].replace(/^["']|["']$/g, '')]] : [] }))
const KEY = env.OPENROUTER_API_KEY, MODEL = env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5'
if (!KEY) throw new Error('OPENROUTER_API_KEY is not in .env')
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const MAX_STEPS = Number(args.steps || 60)
const { tasks } = JSON.parse(readFileSync('tests/agent-harness/docs.json', 'utf8')) as { tasks: { id: string; prompt: string; must: { figures: Record<string, number>; headings: number } }[] }

interface Msg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]; tool_call_id?: string }

async function chat(messages: Msg[]): Promise<Msg> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS.map(openAiView), tool_choice: 'auto', temperature: 0.3, max_tokens: 6000 }) })
    const j = await r.json() as { choices?: { message: Msg }[]; error?: unknown }
    if (j.choices?.[0]) return j.choices[0].message
    if (attempt >= 2) throw new Error(`model: ${JSON.stringify(j.error ?? j).slice(0, 200)}`)
    await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1)))
  }
}

async function run(task: (typeof tasks)[number]) {
  const db = fakeDb(), handle = mcpHandler({ userFrom: async () => ({ id: 'u1', email: 'harness@example.com', name: 'Harness', via: 'key' }), db: () => db, jev: fakeJev(), allowedOrigins: ['https://harness.test'] })
  let id = 0
  const call = async (name: string, input: unknown) => {
    const res = await handle(new Request('https://harness.test/mcp/v1', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://harness.test', authorization: 'Bearer harness' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: input } }) }))
    const j = await res.json() as { result?: { isError?: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> }; error?: { message: string } }
    return { error: j.result?.isError || !!j.error, text: j.result?.content[0]?.text ?? j.error?.message ?? '', result: j.result?.structuredContent }
  }
  const messages: Msg[] = [{ role: 'system', content: INSTRUCTIONS }, { role: 'user', content: task.prompt }]
  const steps: { tool: string; error: boolean; said?: string }[] = []
  let reply = '', t0 = Date.now()
  for (let step = 0; step < MAX_STEPS; step++) {
    const m = await chat(messages)
    messages.push({ role: 'assistant', content: m.content ?? '', ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) })
    if (!m.tool_calls?.length) { reply = m.content ?? ''; break }
    for (const c of m.tool_calls) {
      let input: unknown = {}
      try { input = JSON.parse(c.function.arguments || '{}') } catch { /* the tool reports bad input */ }
      const out = await call(c.function.name, input)
      steps.push({ tool: c.function.name, error: out.error, ...(out.error ? { said: out.text.slice(0, 300) } : {}) })
      messages.push({ role: 'tool', tool_call_id: c.id, content: out.text.slice(0, 12000) })
    }
  }
  const [row] = await db.listDocs('u1', (await db.listWorkspaces('u1'))[0]?.id ?? '')
  const doc = row && await db.getDoc('u1', row.id)
  // check_doc must report and not change anything.
  let checkDoc: unknown = null, untouched: boolean | null = null
  if (doc) {
    const out = await call('check_doc', { docId: doc.id }), after = await db.getDoc('u1', doc.id)
    checkDoc = out.result; untouched = after?.text === doc.text && after?.rev === doc.rev
  }
  const parsed = doc ? parseDoc(doc.text) : null, errors = parsed ? [...parsed.errors, ...validateDoc(parsed.doc).errors] : ['no doc was made']
  const figures: Record<string, number> = {}
  for (const b of parsed?.doc.blocks ?? []) if (b.type === 'figure') figures[b.kind] = (figures[b.kind] ?? 0) + 1
  const headings = (parsed?.doc.blocks ?? []).filter((b) => b.type === 'heading').length
  const met = Object.entries(task.must.figures).every(([k, n]) => (figures[k] ?? 0) >= n) && headings >= task.must.headings
  return { id: task.id, model: MODEL, ms: Date.now() - t0, steps: steps.length, toolErrors: steps.filter((s) => s.error), calls: steps.map((s) => s.tool), reply, errors, figures, headings, met, checkDoc, checkDocLeftDocUntouched: untouched, markdown: doc?.text ?? null }
}

const out: Record<string, unknown> = {}
for (const t of tasks.filter((x) => !args.only || x.id === args.only)) {
  try { out[t.id] = await run(t) } catch (e) { out[t.id] = { error: String((e as Error).message) } }
  const r = out[t.id] as { met?: boolean; steps?: number; errors?: string[]; toolErrors?: unknown[]; error?: string }
  console.log(`${t.id}: ${r.error ?? `${r.steps} calls, ${r.toolErrors?.length} refused, parse/validate errors ${r.errors?.length}, brief met ${r.met}`}`)
}
writeFileSync('tests/agent-harness/results-docs.json', JSON.stringify(out, null, 1))

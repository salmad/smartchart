import { expect, test, vi } from 'vitest'
import type { ChatMessage } from '../../src/engine/agent/llm'

const steps: ChatMessage[] = [
  { role: 'assistant', content: '', tool_calls: [
    { id: 'a', type: 'function', function: { name: 'get_template', arguments: JSON.stringify({ template: 'table', style: 'doc' }) } },
    { id: 'b', type: 'function', function: { name: 'get_doc', arguments: '{}' } },
  ] },
  { role: 'assistant', content: 'Done.' },
]
vi.mock('../../src/engine/agent/llm', () => ({ agentStep: vi.fn(async () => ({ message: steps.shift(), ms: 1 })) }))

test('the open doc id goes only to tools that take a docId', async () => {
  const { runDocTurn } = await import('../../src/engine/agent/doc-agent')
  const calls: [string, Record<string, unknown>][] = []
  await runDocTurn({ text: 'Add a table', docId: 'doc_1', history: [], runTool: async (name, input) => { calls.push([name, input]); return {} } })
  expect(calls).toEqual([
    ['get_template', { template: 'table', style: 'doc' }],
    ['get_doc', { docId: 'doc_1' }],
  ])
})

test('a propose turn offers only reading tools and propose_block, and refuses a write', async () => {
  const llm = await import('../../src/engine/agent/llm')
  steps.push(
    { role: 'assistant', content: '', tool_calls: [
      { id: 'c', type: 'function', function: { name: 'update_block', arguments: JSON.stringify({ blockId: 'x', patch: [] }) } },
      { id: 'd', type: 'function', function: { name: 'propose_block', arguments: JSON.stringify({ blockIds: ['x'], mode: 'replace', markdown: 'y', label: 'l', why: 'w' }) } },
    ] },
    { role: 'assistant', content: 'Left a suggestion.' },
  )
  const { runDocTurn } = await import('../../src/engine/agent/doc-agent')
  const calls: string[] = []
  const r = await runDocTurn({ text: 'Fix it', docId: 'doc_1', history: [], mode: 'propose', runTool: async (name) => { calls.push(name); return {} } })
  const tools = (vi.mocked(llm.agentStep).mock.calls.at(-1)?.[0].tools ?? []) as { function: { name: string } }[]
  const offered = tools.map((t) => t.function.name)
  expect(offered).toContain('propose_block')
  expect(offered).not.toContain('update_block')
  expect(offered).not.toContain('write_doc_text')
  expect(calls).toEqual(['propose_block'])
  expect(r.reply).toBe('Left a suggestion.')
})

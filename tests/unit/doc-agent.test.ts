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

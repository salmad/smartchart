import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { mcpHandler } from '../../api/_lib/mcp'
import { INSTRUCTIONS } from '../../src/engine/tools/instructions'
import { fakeDb } from './fake-db'
import { fakeJev } from './fakes'

const handle = mcpHandler({ userFrom: async (r) => (r.headers.get('authorization') === 'Bearer sc_good' ? { id: 'u1', email: 'a@b.c', via: 'key' } : null), db: () => fakeDb(), jev: fakeJev() })
const fetcher: typeof fetch = async (input, init) => handle(new Request(input instanceof Request ? input : String(input), init))

async function connect() {
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL('https://app.test/mcp/v1'), { fetch: fetcher, requestInit: { headers: { authorization: 'Bearer sc_good' } } }))
  return client
}

describe('MCP host', () => {
  it('initializes with instructions and the contract version', async () => {
    const c = await connect()
    expect(c.getServerVersion()).toMatchObject({ name: 'smartchart', version: '2026-10-01' })
    expect(c.getInstructions()).toBe(INSTRUCTIONS)
  })
  it('lists tools with annotations', async () => {
    const { tools } = await (await connect()).listTools()
    expect(tools.find((t) => t.name === 'get_deck')?.annotations).toMatchObject({ readOnlyHint: true })
    expect(tools.find((t) => t.name === 'delete_slide')?.annotations).toMatchObject({ destructiveHint: true })
  })
  it('calls a tool: structuredContent plus one text line', async () => {
    const r = await (await connect()).callTool({ name: 'whoami', arguments: {} })
    expect(r.structuredContent).toMatchObject({ email: 'a@b.c' })
    expect(r.content).toEqual([{ type: 'text', text: expect.any(String) }])
  })
  it('tool errors are results the model can read', async () => {
    const r = await (await connect()).callTool({ name: 'get_deck', arguments: { deckId: 'd_none' } })
    expect(r.isError).toBe(true)
    expect(r.structuredContent).toMatchObject({ error: { code: 'not_found' } })
  })
  it('resources: the guide and template cards', async () => {
    const c = await connect()
    const { resources } = await c.listResources()
    expect(resources.map((r) => r.uri)).toContain('smartchart://guide/consulting')
    expect(resources.map((r) => r.uri)).toContain('smartchart://template/pitch/chart')
    const g = await c.readResource({ uri: 'smartchart://guide/pitch' })
    expect(String((g.contents[0] as { text?: string }).text)).toContain('# Hard rules')
  })
  it('401 without a key, 405 on GET, 403 on a foreign Origin', async () => {
    expect((await handle(new Request('https://app.test/mcp/v1', { method: 'POST', body: '{}' }))).status).toBe(401)
    expect((await handle(new Request('https://app.test/mcp/v1'))).status).toBe(405)
    expect((await handle(new Request('https://app.test/mcp/v1', { method: 'POST', headers: { origin: 'https://evil.test', authorization: 'Bearer sc_good' }, body: '{}' }))).status).toBe(403)
  })
})

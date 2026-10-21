/* The P4 done-when, through the MCP transport: an agent creates a doc, nests two under it, moves one out, and list_docs and the
   sidebar's /api/pages list both tell the same story. */
import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { mcpHandler } from '../../api/_lib/mcp'
import { pagesHandler } from '../../api/_lib/pages'
import { fakeDb } from './fake-db'
import { fakeJev } from './fakes'

const user = { id: 'u1', email: 'a@b.c', name: '', via: 'key' as const }

describe('an MCP session builds and tidies a page tree', () => {
  it('creates, nests two, moves one out; list_docs and /api/pages agree', async () => {
    const db = fakeDb()
    const handle = mcpHandler({ userFrom: async () => user, db: () => db, jev: fakeJev() })
    const fetcher: typeof fetch = async (input, init) => handle(new Request(input instanceof Request ? input : String(input), init))
    const c = new Client({ name: 'test', version: '1' })
    await c.connect(new StreamableHTTPClientTransport(new URL('https://app.test/mcp/v1'), { fetch: fetcher }))
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = await c.callTool({ name, arguments: args })
      if (r.isError) throw new Error(`${name}: ${JSON.stringify(r.structuredContent)}`)
      return r.structuredContent as Record<string, unknown>
    }
    const ws = String(((await call('list_workspaces', {})).workspaces as { workspaceId: string }[])[0].workspaceId)
    const research = String((await call('create_doc', { title: 'Research', workspaceId: ws })).docId), under = { kind: 'doc', id: research }
    const a = String((await call('create_doc', { title: 'Interviews', parent: under })).docId)
    const b = String((await call('create_doc', { title: 'Market', parent: under })).docId)
    const parents = async () => Object.fromEntries(((await call('list_docs', { workspaceId: ws })).docs as { docId: string; parent: unknown }[]).map((d) => [d.docId, d.parent]))
    expect(await parents()).toEqual({ [research]: null, [a]: under, [b]: under })

    await call('move_page', { page: { kind: 'doc', id: a }, parent: null })
    expect(await parents()).toEqual({ [research]: null, [a]: null, [b]: under })
    for (const id of [research, a, b]) await call('get_doc', { docId: id })

    const pages = (await (await pagesHandler({ userFrom: async () => user, db: () => db })(new Request(`https://app.test/api/pages?workspace=${ws}`))).json()) as { id: string; parent: unknown }[]
    expect(Object.fromEntries(pages.map((p) => [p.id, p.parent ?? null]))).toEqual(await parents())
  })
})

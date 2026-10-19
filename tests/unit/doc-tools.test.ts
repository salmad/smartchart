import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { mcpHandler } from '../../api/_lib/mcp'
import { runTool, type Caller, type ToolReply } from '../../api/_lib/deck-service'
import { parseDoc } from '../../src/engine/docs/parse'
import { serializeDoc } from '../../src/engine/docs/serialize'
import { validateDoc } from '../../src/engine/docs/validate'
import { BLOCK_STARTERS } from '../../src/engine/starters'
import { fakeDb } from './fake-db'
import { fakeJev } from './fakes'

const caller = (id = 'u1'): Caller => ({ user: { id, email: `${id}@x.y` }, client: 'Claude Code', key: `k_${id}` })
const start = (id: string) => structuredClone(BLOCK_STARTERS.find((s) => s.id === id)?.body)
const world = () => {
  const db = fakeDb(), deps = { db, origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000 }
  const call = (name: string, input: unknown, who = 'u1'): Promise<ToolReply> => runTool(name, input, caller(who), deps)
  const ok = async (name: string, input: unknown) => { const r = await call(name, input); if (!r.ok) throw new Error(`${name}: ${r.error.message}`); return r.result }
  return { db, call, ok }
}
type Blocks = { blockId: string; type: string; kind?: string; preview: string }[]
const roundTrips = (markdown: string) => { const d = parseDoc(markdown).doc; expect(parseDoc(serializeDoc(d)).doc).toEqual(d); expect(validateDoc(d).errors).toEqual([]) }

describe('doc tools', () => {
  it('build a doc block by block: every step reads back as the same doc', async () => {
    const { ok } = world()
    const made = await ok('create_doc', { title: 'Competitor teardown', subtitle: 'Five issuers' })
    const docId = String(made.docId)
    expect(made.links).toEqual({ edit: `https://app.test/doc/${docId}` })
    const head = await ok('create_block', { docId, after: 'end', markdown: '## Where each one wins' }) as { blocks: Blocks; changed: string[] }
    expect(head.changed).toEqual(['where-each-one-wins'])
    await ok('create_block', { docId, after: 'where-each-one-wins', markdown: 'Revolut leads on speed.' })
    const fig = await ok('create_block', { docId, after: 'end', figure: { kind: 'table', body: start('table') } }) as { changed: string[] }
    const upd = await ok('update_block', { docId, blockId: fig.changed[0], set: { 'table.rows[0].cells[1]': '£75k' } }) as { blocks: Blocks }
    let got = await ok('get_doc', { docId })
    expect(String(got.markdown)).toContain('£75k')
    const para = (got.blocks as Blocks).find((b) => b.type === 'paragraph')?.blockId ?? ''
    await ok('write_doc_text', { docId, blockId: para, markdown: 'Revolut leads on speed and price.' })
    await ok('create_block', { docId, after: 'end', figure: { kind: 'callout', body: start('callout') } })
    got = await ok('get_doc', { docId })
    await ok('move_block', { docId, blockId: fig.changed[0], after: 'start' })
    const last = ((await ok('get_doc', { docId })).blocks as Blocks).at(-1)?.blockId ?? ''
    await ok('delete_block', { docId, blockId: last })
    const end = await ok('get_doc', { docId })
    roundTrips(String(end.markdown))
    expect((end.blocks as Blocks)[0].blockId).toBe(fig.changed[0])
    expect(upd.blocks.length).toBe(3)
    expect(end.outline).toEqual([{ blockId: 'where-each-one-wins', level: 2, text: 'Where each one wins' }])
  })

  it('refuse a stale or unknown block, both-or-neither, a broken figure and a red accent, changing nothing', async () => {
    const { ok, call } = world()
    const docId = String((await ok('create_doc', { title: 'D' })).docId)
    await ok('create_block', { docId, after: 'end', markdown: 'Words.' })
    const before = (await ok('get_doc', { docId })).rev
    expect(await call('write_doc_text', { docId, blockId: 't_gone', markdown: 'x' })).toMatchObject({ ok: false, error: { code: 'not_found', fix: expect.stringContaining('get_doc') } })
    expect(await call('create_block', { docId, after: 'end', markdown: 'x', figure: { kind: 'table', body: {} } })).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringContaining('exactly one') } })
    expect(await call('create_block', { docId, after: 'end' })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    expect(await call('create_block', { docId, after: 'end', figure: { kind: 'chart', body: {} } })).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringContaining('.chart') } })
    expect(await call('update_doc', { docId, accent: '#ff0000' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringMatching(/^accent:/) } })
    expect(await call('update_block', { docId, blockId: 'nope', set: { a: 1 } })).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect((await ok('get_doc', { docId })).rev).toBe(before)
  })

  it('update_doc renames the doc, and the name is the title', async () => {
    const { ok, db } = world()
    const docId = String((await ok('create_doc', { title: 'Old' })).docId)
    await ok('update_doc', { docId, title: 'New', subtitle: 'Sub', theme: 'ink' })
    expect((await db.getDoc('u1', docId))?.name).toBe('New')
    expect(await ok('get_doc', { docId })).toMatchObject({ title: 'New', subtitle: 'Sub', theme: 'ink' })
    await ok('update_doc', { docId, subtitle: null })
    expect('subtitle' in await ok('get_doc', { docId })).toBe(false)
  })

  it('list_docs lists the workspace’s docs; another user’s doc is not_found', async () => {
    const { ok, call } = world()
    const docId = String((await ok('create_doc', { title: 'Mine' })).docId)
    expect(await ok('list_docs', {})).toMatchObject({ docs: [{ docId, name: 'Mine' }] })
    expect(await call('get_doc', { docId }, 'u2')).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(await call('create_block', { docId, after: 'end', markdown: 'x' }, 'u2')).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })

  it('the competitor teardown, built through the tools, checks as warnings only and check_doc writes nothing', async () => {
    const { ok, db } = world()
    const docId = String((await ok('create_doc', { title: 'Competitor teardown', theme: 'paper' })).docId)
    await ok('create_block', { docId, after: 'end', markdown: '## Where the money is' })
    await ok('create_block', { docId, after: 'end', markdown: 'Revenue follows the account.' })
    await ok('create_block', { docId, after: 'end', figure: { kind: 'chart', body: start('chart') } })
    await ok('create_block', { docId, after: 'end', markdown: '## Where each one wins' })
    await ok('create_block', { docId, after: 'end', figure: { kind: 'table', body: start('table') } })
    await ok('create_block', { docId, after: 'end', figure: { kind: 'callout', body: start('callout') } })
    // One figure left without a source, so the check has something to say.
    const bare = await ok('create_block', { docId, after: 'end', figure: { kind: 'cards', body: { caption: 'Three issuers', cards: [{ value: '£50k', title: 'A', bullets: ['x'] }, { value: '£10k', title: 'B', bullets: ['y'] }, { value: '£100k', title: 'C', bullets: ['z'] }] } } }) as { changed: string[] }
    const text = (await db.getDoc('u1', docId))?.text, rev = (await db.getDoc('u1', docId))?.rev
    const r = await ok('check_doc', { docId }) as { checks: { blockId: string; id: string; ok: boolean }[] }
    expect(r.checks.some((c) => c.blockId === bare.changed[0] && c.id === 'R8' && !c.ok)).toBe(true)
    expect(r.checks[0].ok).toBe(false)
    expect((await db.getDoc('u1', docId))?.text).toBe(text)
    expect((await db.getDoc('u1', docId))?.rev).toBe(rev)
    expect(validateDoc(parseDoc(text ?? '').doc).errors).toEqual([])
  })
})

describe('guide and templates for docs', () => {
  it('get_guide doc, list_templates doc and get_template doc', async () => {
    const { ok } = world()
    const g = await ok('get_guide', { style: 'doc' }) as { guide: string }
    expect(g.guide).toContain('caption'); expect(g.guide).toContain('20 rows')
    const l = await ok('list_templates', { style: 'doc' }) as { templates: { template: string }[] }
    expect(l.templates.map((t) => t.template)).toEqual(expect.arrayContaining(['chart', 'table', 'callout']))
    const t = await ok('get_template', { template: 'chart', style: 'doc' }) as { card: { fields: Record<string, unknown>; rules: string[] }; example: unknown }
    expect(Object.keys(t.card.fields)).not.toContain('title')
    expect(Object.keys(t.card.fields)).toContain('caption')
    const body = t.example as Record<string, unknown>
    expect(validateDoc({ title: 'x', blocks: [{ type: 'figure', kind: 'chart', id: 'c', body }] }).errors).toEqual([])
    const tab = await ok('get_template', { template: 'table', style: 'doc' }) as { card: { rules: string[] } }
    expect(tab.card.rules.join(' ')).toContain('20 rows')
    expect(await ok('get_template', { template: 'callout', style: 'doc' })).toMatchObject({ card: { fields: { tone: expect.anything() } } })
  })
})

describe('docs over MCP', () => {
  it('lists the doc tools with annotations, and serves the doc guide as a resource', async () => {
    const db = fakeDb(), handle = mcpHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', name: '', via: 'key' }), db: () => db, jev: fakeJev() })
    const fetcher: typeof fetch = async (input, init) => handle(new Request(input instanceof Request ? input : String(input), init))
    const c = new Client({ name: 'test', version: '1' })
    await c.connect(new StreamableHTTPClientTransport(new URL('https://app.test/mcp/v1'), { fetch: fetcher }))
    const { tools } = await c.listTools()
    expect(tools.find((t) => t.name === 'get_doc')?.annotations).toMatchObject({ readOnlyHint: true })
    expect(tools.find((t) => t.name === 'check_doc')?.annotations).toMatchObject({ readOnlyHint: true })
    expect(tools.find((t) => t.name === 'delete_block')?.annotations).toMatchObject({ destructiveHint: true })
    const made = await c.callTool({ name: 'create_doc', arguments: { title: 'Over MCP' } })
    expect(made.structuredContent).toMatchObject({ title: 'Over MCP' })
    const res = await c.readResource({ uri: 'smartchart://guide/doc' })
    expect(String((res.contents[0] as { text: string }).text)).toContain('# What a doc is')
  })
})

/* list_roadmaps, create_roadmap, get_roadmap: create, list under a deck, read issues with checks (no body). */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { mcpHandler } from '../../api/_lib/mcp'
import { restHandler } from '../../api/_lib/rest'
import { runTool } from '../../api/_lib/deck-service'
import { TOOLS } from '../../src/engine/tools'
import { INSTRUCTIONS } from '../../src/engine/tools/instructions'
import { fakeJev, seedUser } from './fakes'
import { fakeDb } from './fake-db'

const ann = { id: 'u_ann', email: 'ann@x.y', name: 'Ann' }, bob = { id: 'u_bob', email: 'bob@x.y', name: 'Bob' }, cy = { id: 'u_cy', email: 'cy@x.y', name: 'Cy' }
const as = (u: typeof ann) => ({ user: u, client: 'Claude Code', key: `k_${u.id}` })

async function world() {
  const db = fakeDb()
  const deps = { db, origin: 'https://app.test', jev: fakeJev(), now: () => Date.parse('2026-01-02T00:30:00.000Z') }
  await seedUser(db, ann)
  const acme = await db.createWorkspace(ann.id, 'Acme')
  await seedUser(db, bob)
  await db.addInvite(ann.id, acme, bob.email, 'viewer', 't_bob', 2e12)
  await db.acceptInvite(bob, 't_bob', 1)
  const call = (name: string, input: unknown, who = ann) => runTool(name, input, as(who), deps)
  const ok = async (name: string, input: unknown, who = ann) => {
    const r = await call(name, input, who)
    if (!r.ok) throw new Error(`${name}: ${r.error.message}`)
    return r.result
  }
  return { db, call, ok, acme }
}

describe('roadmap tools', () => {
  it('creates a roadmap, lists it under a deck, and get omits the body', async () => {
    const { ok, db, acme } = await world()
    const deckId = String((await ok('create_deck', { style: 'consulting', name: 'Pack', workspaceId: acme })).deckId)
    const made = await ok('create_roadmap', { name: 'SME launch', prefix: 'SME', request: 'Start the SME roadmap', workspaceId: acme, parent: { kind: 'deck', id: deckId } })
    const roadmapId = String(made.roadmapId)
    expect(made.links).toEqual({ edit: `https://app.test/r/${roadmapId}` })
    expect(made.parent).toEqual({ kind: 'deck', id: deckId })
    const listed = await ok('list_roadmaps', { workspaceId: acme })
    expect(listed.roadmaps).toEqual([expect.objectContaining({ roadmapId, name: 'SME launch', prefix: 'SME', parent: { kind: 'deck', id: deckId } })])
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i_late', parentId: null, title: 'Late' }] }, 'app')
    await db.writeRoadmap(ann.id, roadmapId, { op: 'set', ids: ['i_late'], props: { start: '2026-01-01', due: '2026-01-01' } }, 'app')
    await db.putIssueBody(ann.id, roadmapId, 'i_late', '# Secret', 0)
    const got = await ok('get_roadmap', { roadmapId })
    expect(got.fields).toEqual([])
    expect(got.links).toEqual({ edit: `https://app.test/r/${roadmapId}` })
    const row = (got.issues as { id: string; key: string; checks: string[] }[])[0]
    expect(row.key).toBe('SME-1')
    expect(row.checks).toContain('overdue')
    expect(row).not.toHaveProperty('body')
    expect(got).not.toHaveProperty('comments')
  })

  it('rejects a bad prefix, a blank request, a viewer create, and a stranger read', async () => {
    const { call, ok, acme, db } = await world()
    expect(await call('create_roadmap', { name: 'X', prefix: 'pln', request: 'add' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'Prefix must be 2–6 uppercase letters or digits, starting with a letter.' } })
    expect(await call('create_roadmap', { name: 'X', prefix: 'PLN', request: '   ' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: "request: the user's own words." } })
    expect(await call('create_roadmap', { name: 'X', prefix: 'XX', request: 'add', workspaceId: acme }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not add to it.' } })
    await db.touchWorkspace(bob.id, acme)
    expect(await call('create_roadmap', { name: 'X', prefix: 'XX', request: 'add' }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not add to it.' } })
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    expect(await call('get_roadmap', { roadmapId }, cy)).toMatchObject({ ok: false, error: { code: 'not_found', message: `No roadmap ${roadmapId}.` } })
    expect(await ok('get_roadmap', { roadmapId }, bob)).toMatchObject({ roadmapId, prefix: 'PLN' })
  })

  it('lists the same matches the table would, and get_issue returns body, comments, and events', async () => {
    const { ok, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [
      { id: 'd', parentId: null, title: 'D' },
      { id: 'p', parentId: null, title: 'P' },
      { id: 'a', parentId: 'p', title: 'A' },
      { id: 'c', parentId: 'a', title: 'C' },
      { id: 'b', parentId: 'p', title: 'B' },
    ] }, 'app')
    await db.writeRoadmap(ann.id, roadmapId, { op: 'set', ids: ['p'], props: { start: '2026-01-01', due: '2026-01-03' } }, 'app')
    await db.writeRoadmap(ann.id, roadmapId, { op: 'set', ids: ['b'], props: { status: 'done' } }, 'app')
    await db.putIssueBody(ann.id, roadmapId, 'c', '# Brief', 0)
    const chips = [{ on: 'status', is: true, values: ['todo'] }, { on: 'check', id: 'no_dates' }]
    const page = await ok('list_issues', { roadmapId, chips, limit: 1 })
    expect((page.issues as { id: string }[]).map((i) => i.id)).toEqual(['d'])
    expect(page.next).toBe(1)
    const rest = await ok('list_issues', { roadmapId, chips, cursor: 1 })
    expect((rest.issues as { id: string }[]).map((i) => i.id)).toEqual(['c'])
    expect(rest.next).toBeUndefined()
    const one = await ok('get_issue', { roadmapId, issueId: 'c' })
    expect(one).toMatchObject({ id: 'c', key: 'PLN-4', body: '# Brief', checks: expect.arrayContaining(['no_dates']) })
    expect(one).not.toHaveProperty('deletedAt')
    const events = one.events as { at: string }[]
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(await ok('list_issues', { roadmapId, chips, limit: 1 }, bob)).toMatchObject({ next: 1 })
    expect(await ok('get_issue', { roadmapId, issueId: 'c' }, bob)).toMatchObject({ id: 'c', body: '# Brief' })
  })

  it('list_changes returns rows since the date and rejects a bad since', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One' }] }, 'app')
    const rows = await ok('list_changes', { roadmapId, since: '2020-01-01' })
    expect(rows.events).toEqual([expect.objectContaining({ what: 'created', byClient: 'app' })])
    expect(await ok('list_changes', { roadmapId, since: '2099-01-01' })).toEqual({ events: [] })
    expect(await call('list_issues', { roadmapId, chips: [{ on: 'nope' }] })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    expect(await call('list_changes', { roadmapId, since: 'tomorrow' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'since: an ISO date (YYYY-MM-DD).' } })
  })

  it('create_issues parents a child listed first and does not copy fields', async () => {
    const { ok, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    const country = { id: 'f1', name: 'Country', type: 'choice' as const, options: [{ id: 'uk', name: 'UK' }] }
    await db.writeRoadmap(ann.id, roadmapId, { op: 'roadmap', fields: [country] }, 'app')
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'p', parentId: null, title: 'Parent', props: { fields: { f1: 'uk' } } }] }, 'app')
    const before = (await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq ?? -1
    const made = await ok('create_issues', {
      roadmapId, request: 'Add the UK task under a new group',
      issues: [
        { ref: 'child', title: 'UK task', parent: 'group' },
        { ref: 'group', title: 'Underwriting', parent: 'p', fields: { f1: 'uk' } },
      ],
    })
    const created = made.created as { ref: string; issueId: string; key: string }[]
    expect(created.map((c) => c.ref)).toEqual(['child', 'group'])
    const fresh = await db.getRoadmap(ann.id, roadmapId)
    expect(fresh?.roadmap.seq).toBe(before + 1)
    const group = fresh?.issues.find((i) => i.id === created[1].issueId)
    const child = fresh?.issues.find((i) => i.id === created[0].issueId)
    if (!group || !child) throw new Error('issues missing')
    expect(group.parentId).toBe('p')
    expect(group.fields).toEqual({ f1: 'uk' })
    expect(child.parentId).toBe(group.id)
    expect(child.fields).toEqual({})
    const detail = await db.getIssueDetail(ann.id, roadmapId, child.id)
    expect(detail?.events.filter((e) => e.what === 'created')).toEqual([expect.objectContaining({ byClient: 'Claude Code' })])
    expect(made.checks).toEqual(expect.arrayContaining([expect.objectContaining({ issueId: child.id, ids: expect.arrayContaining(['no_dates']) })]))
  })

  it('create_issues reports saved keys after a concurrent numbering bump', async () => {
    const { ok, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    const baseWrite = db.writeRoadmap.bind(db)
    db.writeRoadmap = async (u, id, op, byClient) => {
      if (op.op === 'create' && op.issues.length === 1 && op.issues[0].title === 'Agent issue') {
        await baseWrite(u, id, { op: 'create', issues: [{ id: 'race', parentId: null, title: 'Racer' }] }, 'app')
      }
      return baseWrite(u, id, op, byClient)
    }
    const made = await ok('create_issues', { roadmapId, request: 'add one', issues: [{ ref: 'a', title: 'Agent issue' }] })
    const created = made.created as { issueId: string; key: string }[]
    const got = await ok('get_roadmap', { roadmapId })
    const saved = (got.issues as { id: string; key: string }[]).find((i) => i.id === created[0].issueId)
    expect(created[0].key).toBe(saved?.key)
    expect(created[0].key).toBe('PLN-2')
  })

  it('update_issue refuses a parent path and a start after due, and writes nothing', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One' }] }, 'app')
    const seq = (await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq ?? -1
    expect(await call('update_issue', { roadmapId, issueId: 'i1', set: { parentId: null }, request: 'move it' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'set: only title, status, assignee, start, due, sprint, and fields.<fieldId>.' } })
    expect(await call('update_issue', { roadmapId, issueId: 'i1', set: { body: 'x' }, request: 'edit the body' })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    expect(await call('update_issue', { roadmapId, issueId: 'i1', set: { start: '2026-05-02', due: '2026-05-01' }, request: 'fix the dates' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Start must be before due.' } })
    expect((await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq).toBe(seq)
    expect((await db.getRoadmap(ann.id, roadmapId))?.issues.find((i) => i.id === 'i1')?.title).toBe('One')
  })

  it('update_issue sets two paths as one event and refuses an unknown option', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    await db.writeRoadmap(ann.id, roadmapId, { op: 'roadmap', fields: [{ id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'uk', name: 'UK' }] }] }, 'app')
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One' }] }, 'app')
    const upd = await ok('update_issue', { roadmapId, issueId: 'i1', request: 'Call it Send RFP and set the country', set: { title: 'Send RFP', 'fields.f1': 'uk' } })
    expect(upd.issues).toEqual([expect.objectContaining({ id: 'i1', title: 'Send RFP', fields: { f1: 'uk' } })])
    const ev = await db.getIssueDetail(ann.id, roadmapId, 'i1')
    expect(ev?.events.filter((e) => e.what === 'set').at(-1)?.changes.map((c) => c.path).sort()).toEqual(['fields', 'title'])
    expect(await call('update_issue', { roadmapId, issueId: 'i1', request: 'bad country', set: { 'fields.f1': 'zz' } })).toMatchObject({ ok: false, error: { code: 'refused', message: '“Country” has no option “zz”.' } })
  })

  it('create_issues refuses a viewer and writes nothing', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    const seq = (await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq ?? -1
    expect(await call('create_issues', { roadmapId, request: 'add one', issues: [{ ref: 'a', title: 'A' }] }, bob)).toMatchObject({
      ok: false,
      error: { code: 'refused', message: 'You can view this workspace, not change it.' },
    })
    expect((await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq).toBe(seq)
  })

  it('delete_issue removes the subtree, counts it, and tells a viewer no', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [
      { id: 'p', parentId: null, title: 'Parent' },
      { id: 'c', parentId: 'p', title: 'Child' },
    ] }, 'app')
    expect(await call('delete_issue', { roadmapId, issueId: 'p', request: 'Remove this branch' }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not change it.' } })
    expect((await ok('get_roadmap', { roadmapId }, bob)).issues).toHaveLength(2)
    const gone = await ok('delete_issue', { roadmapId, issueId: 'p', request: 'Remove this branch' })
    expect(gone.deleted).toBe(2)
    const left = await db.getRoadmap(ann.id, roadmapId)
    if (!left) throw new Error('roadmap missing')
    const rows = left.issues.filter((i) => i.id === 'p' || i.id === 'c')
    expect(rows.every((i) => i.deletedAt !== null && i.deletedAt === rows[0].deletedAt)).toBe(true)
    expect((await ok('get_roadmap', { roadmapId })).issues).toEqual([])
    expect(await call('delete_issue', { roadmapId, issueId: 'p', request: 'again' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'No such issue.' } })
  })

  it('move_issue refuses a cycle and a slot that is not a sibling', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [
      { id: 'p', parentId: null, title: 'Parent' },
      { id: 'c', parentId: 'p', title: 'Child' },
      { id: 's', parentId: null, title: 'Sib' },
    ] }, 'app')
    expect(await call('move_issue', { roadmapId, issueId: 'p', parentId: 'c', request: 'nest it' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'An issue can’t go inside itself or its sub-issues.' } })
    expect(await call('move_issue', { roadmapId, issueId: 'c', parentId: null, before: 'p', after: 's', request: 'both' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'before and after: give one, not both.' } })
    const moved = await ok('move_issue', { roadmapId, issueId: 'c', parentId: null, before: 's', request: 'put the child just before S' })
    expect((moved.issues as { id: string; parentId: string | null }[])[0]).toMatchObject({ id: 'c', parentId: null })
    const roots = (await ok('get_roadmap', { roadmapId })).issues as { id: string }[]
    expect(roots.map((i) => i.id)).toEqual(['p', 'c', 's'])
    const chain: { id: string; parentId: string | null; title: string }[] = []
    for (let n = 1; n <= 12; n++) {
      chain.push({ id: `i${n}`, parentId: n === 1 ? null : `i${n - 1}`, title: `L${n}` })
    }
    chain.push({ id: 'extra', parentId: null, title: 'Extra' })
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: chain }, 'app')
    expect(await call('move_issue', { roadmapId, issueId: 'extra', parentId: 'i12', request: 'nest it deeper' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Issues nest 12 levels deep at most.' } })
    const extra = (await db.getRoadmap(ann.id, roadmapId))?.issues.find((i) => i.id === 'extra')
    if (!extra) throw new Error('extra missing')
    expect(extra.parentId).toBeNull()
  })

  it('set_fields replaces the list and strips a removed field’s values', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    const country = { id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'uk', name: 'UK' }] }
    await ok('set_fields', { roadmapId, request: 'Add country', fields: [country] })
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One', props: { fields: { f1: 'uk' } } }] }, 'app')
    const cleared = await ok('set_fields', { roadmapId, request: 'Drop country', fields: [] })
    expect(cleared.fields).toEqual([])
    const i1 = (await db.getRoadmap(ann.id, roadmapId))?.issues.find((i) => i.id === 'i1')
    if (!i1) throw new Error('i1 missing')
    expect(i1.fields).toEqual({})
    expect(await call('set_fields', { roadmapId, request: 'empty name', fields: [{ id: 'f2', name: '  ', type: 'text' }] })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Every field needs a name.' } })
    expect((await ok('get_roadmap', { roadmapId })).fields).toEqual([])
  })

  it('set_fields refuses malformed field definitions without writing', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    const country = { id: 'f1', name: 'Country', type: 'choice' as const, options: [{ id: 'uk', name: 'UK' }] }
    await ok('set_fields', { roadmapId, request: 'Add country', fields: [country] })
    const seqBefore = (await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq
    expect(await call('set_fields', { roadmapId, request: 'bad', fields: [{ id: 'f2', type: 'text' }] })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Every field needs a name.' } })
    expect(await call('set_fields', { roadmapId, request: 'bad', fields: [{ name: 'X', type: 'text' }] })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Every field needs an id.' } })
    expect(await call('set_fields', { roadmapId, request: 'bad', fields: [{ id: 'f3', name: 'X', type: 42 }] })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Field “X” has an unknown type.' } })
    expect((await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq).toBe(seqBefore)
    expect((await ok('get_roadmap', { roadmapId })).fields).toEqual([country])
  })

  it('get_guide roadmap names the rules, and list_templates rejects that style', async () => {
    const { ok, call } = await world()
    const g = String((await ok('get_guide', { style: 'roadmap' })).guide)
    expect(g).toContain('Checks warn. They never authorise a silent edit.')
    expect(g).toContain('Pass request: the user\'s own words, on every write.')
    expect(g).toContain('Do not invent Workstream, Country, Function, or Epic.')
    expect(g).toContain('Periods: 3–16')
    expect(g).not.toContain('check_roadmap')
    expect(await call('list_templates', { style: 'roadmap' })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    expect(await call('get_template', { template: 'chart', style: 'roadmap' })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    expect(TOOLS.map((t) => t.name)).not.toContain('check_roadmap')
    expect(TOOLS.map((t) => t.name)).not.toContain('roadmap_timeline')
    expect(INSTRUCTIONS).toContain('"roadmap" for a roadmap')
    expect(INSTRUCTIONS).not.toContain('create_issues')
  })

  it('serves the roadmap guide as an MCP resource and over REST', async () => {
    const db = fakeDb()
    const handle = mcpHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', name: '', via: 'key' }), db: () => db, jev: fakeJev() })
    const fetcher: typeof fetch = async (input, init) => handle(new Request(input instanceof Request ? input : String(input), init))
    const c = new Client({ name: 'test', version: '1' })
    await c.connect(new StreamableHTTPClientTransport(new URL('https://app.test/mcp/v1'), { fetch: fetcher }))
    expect((await c.listResources()).resources.map((r) => r.uri)).toContain('smartchart://guide/roadmap')
    const res = await c.readResource({ uri: 'smartchart://guide/roadmap' })
    expect(String((res.contents[0] as { text: string }).text)).toContain('Checks warn.')
    const rest = restHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', name: '', via: 'key' }), db: () => db, jev: fakeJev() })
    const created = await rest(new Request('https://app.test/api/v1/create_roadmap', { method: 'POST', body: JSON.stringify({ name: 'P', prefix: 'PLN', request: 'add' }) }))
    expect(created.status).toBe(200)
    expect((await created.json()).links.edit).toMatch(/\/r\/rm_/)
    const missing = await rest(new Request('https://app.test/api/v1/check_roadmap', { method: 'POST', body: '{}' }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toMatchObject({ error: { code: 'bad_input', message: 'Unknown tool check_roadmap.' } })
  })

  describe('sprints', () => {
    afterEach(() => { vi.useRealTimers() })

    it('set_sprints sets the rhythm, update_issue and create_issues put work in a sprint, and get_roadmap shows both', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-01-02T00:30:00.000Z'))
      const { ok, call, acme } = await world()
      const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
      expect((await ok('get_roadmap', { roadmapId })).currentSprint).toBeNull()
      expect(await call('update_issue', { roadmapId, issueId: 'x', set: { sprint: '2026-01-02' }, request: 'plan it' })).toMatchObject({ ok: false })
      const made = await ok('create_issues', { roadmapId, request: 'add', issues: [{ ref: 'a', title: 'A' }] })
      const issueId = (made.created as { issueId: string }[])[0].issueId
      expect(await call('update_issue', { roadmapId, issueId, set: { sprint: '2026-01-02' }, request: 'put it in the sprint' })).toMatchObject({ ok: false, error: { message: "Sprints aren't set up for this roadmap." } })
      expect(await ok('set_sprints', { roadmapId, request: 'Two-week sprints from 29 Dec', sprints: { start: '2025-12-29', weeks: 2 } })).toMatchObject({ sprints: { start: '2025-12-29', weeks: 2 } })
      await ok('update_issue', { roadmapId, issueId, set: { sprint: '2026-01-05' }, request: 'put it in the sprint' })
      const made2 = await ok('create_issues', { roadmapId, request: 'add', issues: [{ ref: 'b', title: 'B', sprint: '2026-01-02' }] })
      const got = await ok('get_roadmap', { roadmapId })
      expect(got.sprints).toEqual({ start: '2025-12-29', weeks: 2 })
      expect(got.currentSprint).toEqual({ n: 1, start: '2025-12-29', end: '2026-01-11' })
      expect((got.issues as { id: string; sprint: string; carried: number }[]).map((i) => [i.sprint, i.carried])).toEqual([['2025-12-29', 0], ['2025-12-29', 0]])
      expect((made2.created as unknown[]).length).toBe(1)
      expect(await call('set_sprints', { roadmapId, request: 'too long', sprints: { start: '2025-12-29', weeks: 9 } })).toMatchObject({ ok: false })
    })
  })
})

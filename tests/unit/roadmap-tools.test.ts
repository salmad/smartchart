/* list_roadmaps, create_roadmap, get_roadmap: create, list under a deck, read issues with checks (no body). */
import { describe, expect, it } from 'vitest'
import { runTool } from '../../api/_lib/deck-service'
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

  it('update_issue refuses a parent path and a start after due, and writes nothing', async () => {
    const { ok, call, db, acme } = await world()
    const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
    await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One' }] }, 'app')
    const seq = (await db.getRoadmap(ann.id, roadmapId))?.roadmap.seq ?? -1
    expect(await call('update_issue', { roadmapId, issueId: 'i1', set: { parentId: null }, request: 'move it' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'set: only title, status, assignee, start, due, and fields.<fieldId>.' } })
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
})
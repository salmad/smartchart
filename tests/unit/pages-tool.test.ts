/* move_page: an agent moves a doc or a deck in the workspace tree, and the server's rules answer as tool errors. */
import { describe, expect, it } from 'vitest'
import { runTool } from '../../api/_lib/deck-service'
import { fakeJev, seedUser } from './fakes'
import { fakeDb } from './fake-db'

const ann = { id: 'u_ann', email: 'ann@x.y', name: 'Ann' }, bob = { id: 'u_bob', email: 'bob@x.y', name: 'Bob' }, cy = { id: 'u_cy', email: 'cy@x.y', name: 'Cy' }
const as = (u: typeof ann) => ({ user: u, client: 'Claude Code', key: `k_${u.id}` })
const doc = (id: string) => ({ kind: 'doc', id }), deck = (id: string) => ({ kind: 'deck', id })

async function setup() {
  const db = fakeDb(), deps = { db, origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000 }
  const mine = await seedUser(db, ann), acme = await db.createWorkspace(ann.id, 'Acme')
  await seedUser(db, bob)
  await db.addInvite(ann.id, acme, bob.email, 'viewer', 't_bob', 2e12)
  await db.acceptInvite(bob, 't_bob', 1)
  const call = (name: string, input: unknown, who = ann) => runTool(name, input, as(who), deps)
  const ok = async (name: string, input: unknown, who = ann) => { const r = await call(name, input, who); if (!r.ok) throw new Error(`${name}: ${r.error.message}`); return r.result }
  const doc1 = async (title: string, parent?: object) => String((await ok('create_doc', { title, workspaceId: acme, ...(parent ? { parent } : {}) })).docId)
  /** parent id of every page, by id. */
  const parents = async () => Object.fromEntries((await db.listPages(ann.id, acme)).map((p) => [p.id, p.parent?.id ?? null]))
  const order = async (parent: object | null) => (await db.listPages(ann.id, acme)).filter((p) => (p.parent?.id ?? null) === ((parent as { id: string } | null)?.id ?? null))
    .sort((a, b) => ((a.sortKey ?? '') < (b.sortKey ?? '') ? -1 : 1)).map((p) => p.id)
  return { db, call, ok, doc1, parents, order, mine, acme }
}

describe('move_page', () => {
  it('moves a doc under a deck and back to the top; its subpages go with it', async () => {
    const { ok, doc1, parents } = await setup()
    const a = await doc1('A'), b = await doc1('B', doc(a))
    const d = String((await ok('create_deck', { style: 'pitch', name: 'Pack', workspaceId: (await ok('list_workspaces', {}) as { workspaces: { workspaceId: string; name: string }[] }).workspaces.find((w) => w.name === 'Acme')?.workspaceId })).deckId)
    expect(await ok('move_page', { page: doc(a), parent: deck(d) })).toEqual({ moved: true, page: doc(a), parent: deck(d) })
    expect(await parents()).toMatchObject({ [a]: d, [b]: a })
    await ok('move_page', { page: doc(a), parent: null })
    expect(await parents()).toMatchObject({ [a]: null, [b]: a })
  })

  it('before and after put a page next to a sibling; neither puts it last', async () => {
    const { ok, doc1, order } = await setup()
    const top = await doc1('Top'), x = await doc1('X', doc(top)), y = await doc1('Y', doc(top)), z = await doc1('Z')
    expect(await order(doc(top))).toEqual([x, y])
    await ok('move_page', { page: doc(z), parent: doc(top), before: doc(x) })
    expect(await order(doc(top))).toEqual([z, x, y])
    await ok('move_page', { page: doc(z), parent: doc(top), after: doc(x) })
    expect(await order(doc(top))).toEqual([x, z, y])
    await ok('move_page', { page: doc(x), parent: doc(top) })
    expect(await order(doc(top))).toEqual([z, y, x])
  })

  it('a loop, a seventh level and a missing parent are refused with what to do; a bad shape is bad_input', async () => {
    const { ok, call, doc1 } = await setup()
    const a = await doc1('A'), b = await doc1('B', doc(a))
    expect(await call('move_page', { page: doc(a), parent: doc(b) })).toMatchObject({ ok: false, error: { code: 'refused', fix: 'Pick another parent, or another place among its subpages.' } })
    expect(await call('move_page', { page: doc(a), parent: doc(a) })).toMatchObject({ ok: false, error: { code: 'refused' } })
    expect(await call('move_page', { page: doc(a), parent: doc('nope') })).toMatchObject({ ok: false, error: { code: 'refused' } })
    let at = doc(await doc1('L0'))
    for (let i = 1; i < 6; i++) at = doc(await doc1(`L${i}`, at))
    const lone = await doc1('Lone')
    expect(await call('move_page', { page: doc(lone), parent: at })).toMatchObject({ ok: false, error: { code: 'refused' } })
    expect(await call('move_page', { page: doc(a), parent: doc(b), before: doc(b), after: doc(a) })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    for (const page of [{ kind: 'folder', id: 'x' }, 'doc:x', undefined]) expect(await call('move_page', { page, parent: null })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    expect(await call('move_page', { page: doc(a) })).toMatchObject({ ok: false })
    void ok
  })

  it('a viewer is told so; a stranger’s page is no such page, not a refusal', async () => {
    const { ok, call, doc1 } = await setup()
    const a = await doc1('A'), b = await doc1('B')
    expect(await call('move_page', { page: doc(b), parent: doc(a) }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not change it.' } })
    expect(await call('move_page', { page: doc(b), parent: doc(a) }, cy)).toMatchObject({ ok: false, error: { code: 'not_found', message: 'No such page.' } })
    void ok
  })

  it('the same move twice changes nothing the second time', async () => {
    const { ok, doc1, db, acme } = await setup()
    const a = await doc1('A'), b = await doc1('B')
    await ok('move_page', { page: doc(b), parent: doc(a) })
    const once = JSON.stringify(await db.listPages(ann.id, acme))
    await ok('move_page', { page: doc(b), parent: doc(a) })
    expect(JSON.stringify(await db.listPages(ann.id, acme))).toEqual(once)
  })
})

/* create_doc and create_deck with a parent: the page lands under it, in its workspace, and the server's tree rules answer as tool errors. */
import { describe, expect, it } from 'vitest'
import { runTool } from '../../api/_lib/deck-service'
import { fakeJev, seedUser } from './fakes'
import { fakeDb } from './fake-db'

const ann = { id: 'u_ann', email: 'ann@x.y', name: 'Ann' }, bob = { id: 'u_bob', email: 'bob@x.y', name: 'Bob' }
const as = (u: typeof ann) => ({ user: u, client: 'Claude Code', key: `k_${u.id}` })

async function setup() {
  const db = fakeDb(), deps = { db, origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000 }
  const mine = await seedUser(db, ann), acme = await db.createWorkspace(ann.id, 'Acme')
  await seedUser(db, bob)
  await db.addInvite(ann.id, acme, bob.email, 'viewer', 't_bob', 2e12)
  await db.acceptInvite(bob, 't_bob', 1)
  const call = (name: string, input: unknown, who = ann) => runTool(name, input, as(who), deps)
  const ok = async (name: string, input: unknown, who = ann) => { const r = await call(name, input, who); if (!r.ok) throw new Error(`${name}: ${r.error.message}`); return r.result }
  return { db, call, ok, mine, acme }
}

describe('create_doc and create_deck under a parent', () => {
  it('nest a doc under a doc, a deck under a doc and a doc under a deck; the result says where', async () => {
    const { ok, db, acme } = await setup()
    const top = await ok('create_doc', { title: 'Research', workspaceId: acme })
    expect(top.parent).toBeNull()
    const doc = { kind: 'doc', id: String(top.docId) }
    const deck = await ok('create_deck', { style: 'consulting', name: 'Pack', parent: doc })
    expect(deck.parent).toEqual(doc)
    const sub = await ok('create_doc', { title: 'Notes', parent: { kind: 'deck', id: String(deck.deckId) } })
    expect(sub.parent).toEqual({ kind: 'deck', id: String(deck.deckId) })
    // They are all in the parent's workspace, though Acme was not the most recently opened one.
    const pages = await db.listPages(ann.id, acme)
    expect(pages.map((p) => [p.id === top.docId ? 'research' : p.id === deck.deckId ? 'pack' : 'notes', p.parent?.id ?? null])).toEqual(expect.arrayContaining([
      ['research', null], ['pack', top.docId], ['notes', deck.deckId]]))
  })

  it('a parent in another workspace than the one named, a missing parent and a seventh level are refused with a fix', async () => {
    const { ok, call, mine, acme } = await setup()
    const top = await ok('create_doc', { title: 'Research', workspaceId: acme })
    expect(await call('create_doc', { title: 'X', workspaceId: mine, parent: { kind: 'doc', id: String(top.docId) } })).toMatchObject({ ok: false, error: { code: 'refused', fix: 'Choose another parent.' } })
    expect(await call('create_doc', { title: 'X', parent: { kind: 'doc', id: 'nope' } })).toMatchObject({ ok: false, error: { code: 'refused', message: 'No such page.' } })
    let at = { kind: 'doc', id: String(top.docId) }
    for (let i = 0; i < 5; i++) at = { kind: 'doc', id: String((await ok('create_doc', { title: `L${i}`, parent: at })).docId) }
    expect(await call('create_doc', { title: 'Too deep', parent: at })).toMatchObject({ ok: false, error: { code: 'refused' } })
    expect(await call('create_deck', { style: 'pitch', parent: at })).toMatchObject({ ok: false, error: { code: 'refused' } })
  })

  it('a viewer of the parent’s workspace is told so; a stranger’s page is no such page', async () => {
    const { ok, call, acme } = await setup()
    const top = await ok('create_doc', { title: 'Research', workspaceId: acme })
    const parent = { kind: 'doc', id: String(top.docId) }
    expect(await call('create_doc', { title: 'X', parent }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not change it.' } })
    expect(await call('create_deck', { style: 'pitch', parent }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not change it.' } })
    const cy = { id: 'u_cy', email: 'cy@x.y', name: 'Cy' }
    expect(await call('create_doc', { title: 'X', parent }, cy)).toMatchObject({ ok: false, error: { code: 'refused', message: 'No such page.' } })
  })

  it('a parent that is not a page is bad_input; no parent still makes a top-level page', async () => {
    const { ok, call } = await setup()
    for (const parent of [{ kind: 'folder', id: 'x' }, { kind: 'doc' }, 'doc:x', 7]) {
      expect(await call('create_doc', { title: 'X', parent })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
    }
    expect((await ok('create_deck', { style: 'pitch' })).parent).toBeNull()
  })
})

describe('list_docs and list_decks say where each page sits', () => {
  it('a nested page shows its parent, a top-level one null', async () => {
    const { ok, acme } = await setup()
    const top = await ok('create_doc', { title: 'Research', workspaceId: acme }), parent = { kind: 'doc', id: String(top.docId) }
    const sub = await ok('create_doc', { title: 'Notes', parent }), deck = await ok('create_deck', { style: 'pitch', name: 'Pack', parent })
    await ok('create_block', { docId: String(sub.docId), after: 'end', markdown: '## One' }) // a deck needs a slide to list; docs list as they are
    const docs = (await ok('list_docs', { workspaceId: acme })).docs as { docId: string; parent: unknown }[]
    expect(Object.fromEntries(docs.map((d) => [d.docId, d.parent]))).toEqual({ [String(top.docId)]: null, [String(sub.docId)]: parent })
    const decks = (await ok('list_decks', { workspaceId: acme })).decks as { deckId: string; parent: unknown }[]
    expect(decks.find((d) => d.deckId === deck.deckId)?.parent).toEqual(parent)
  })
})

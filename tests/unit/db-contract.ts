// The Db contract: what every Db (the fake and the SQL one) must do about workspaces, members, invites and docs.
// Each test makes its own users, so the suite runs on a shared database too.
import { describe, expect, it } from 'vitest'
import type { Db } from '../../api/_lib/db'
import type { Role } from '../../api/_lib/access'
import type { Slide } from '../../src/engine/types'
import type { Tree } from '../../src/engine/versions'
import type { DocTree } from '../../src/engine/docs/versions'
import type { Block } from '../../src/engine/docs/types'
import { seedUser, type SeedUser } from './fakes'

const DAY = 86_400_000
let run = 0

/** Fresh users and ids per test: ann, bob and cy, and a deck id maker. */
function people() {
  const k = `${Date.now().toString(36)}${++run}`
  const user = (name: string): SeedUser => ({ id: `u_${name.toLowerCase()}_${k}`, email: `${name.toLowerCase()}.${k}@example.com`, name })
  let n = 0
  return { ann: user('Ann'), bob: user('Bob'), cy: user('Cy'), id: (p = 'd') => `${p}_${k}_${++n}` }
}

/** `who` joins ann's workspace `ws` with `role`, through an invite as the app does it. */
async function join(db: Db, owner: SeedUser, ws: string, who: SeedUser, role: Role) {
  const token = `t_${who.id}_${role}_${ws}`
  expect(await db.addInvite(owner.id, ws, who.email, role, token, Date.now() + DAY)).toBe('ok')
  expect(await db.acceptInvite(who, token, Date.now())).toMatchObject({ workspaceId: ws })
}

const deck = (title: string) => ({ items: [{ id: 's_1', slide: { template: 'cover', title } }] })
const version = (rev: number) => ({
  replace: null, rev, key: `k${rev}`, at: Date.now(),
  meta: { by: 'Occam', turn: null, label: null },
  tree: { style: 'pitch', theme: 'paper', accent: null, slides: [['s_1', 'h1']] } as Tree,
  blobs: new Map<string, Slide>([['h1', { template: 'cover', title: 'Q3' } as unknown as Slide]]),
})

const docVersion = (rev: number) => ({
  replace: null, rev, key: `k${rev}`, at: Date.now(),
  meta: { by: 'Ann', turn: null, label: null },
  tree: { title: 'Memo', blocks: ['h1'] } as DocTree,
  blobs: new Map<string, Block>([['h1', { type: 'paragraph', text: 'Hello' }]]),
})

export function dbContract(name: string, make: () => Promise<Db>) {
  describe(`Db contract (${name})`, () => {
    it('a user’s first workspace is personal and holds their decks', async () => {
      const db = await make(), { ann, id } = people(), d1 = id(), d2 = id()
      await db.putDeck(ann.id, d1, 'One', deck('One'), {}, 0)
      await db.putDeck(ann.id, d2, 'Two', deck('Two'), {}, 0)
      const ws = await db.ensureWorkspace(ann)
      expect(await db.ensureWorkspace(ann)).toBe(ws)
      expect(await db.listWorkspaces(ann.id)).toMatchObject([{ id: ws, personal: true, role: 'owner', name: 'Ann’s workspace', members: 1 }])
      expect((await db.listDecks(ann.id, ws)).map((d) => d.id).sort()).toEqual([d1, d2].sort())
    })

    it('a member sees the workspace’s decks; a non-member sees nothing', async () => {
      const db = await make(), { ann, bob, cy, id } = people(), d = id()
      const ws = await seedUser(db, ann)
      await seedUser(db, cy)
      await db.putDeck(ann.id, d, 'Board', deck('Board'), {}, 0, { workspaceId: ws })
      await join(db, ann, ws, bob, 'editor')
      expect((await db.listDecks(bob.id, ws)).map((x) => x.id)).toEqual([d])
      expect((await db.getDeck(bob.id, d))?.role).toBe('editor')
      expect(await db.putDeck(bob.id, d, 'Board', deck('Bob was here'), {}, 1)).toEqual({ rev: 2 })
      expect(await db.deckRole(bob.id, d)).toBe('editor')

      expect(await db.listDecks(cy.id, ws)).toEqual([])
      expect(await db.getDeck(cy.id, d)).toBeNull()
      expect(await db.getDeckMeta(cy.id, d)).toBeNull()
      expect(await db.deckRole(cy.id, d)).toBeNull()
      expect(await db.listMembers(cy.id, ws)).toBeNull()
      expect(await db.putDeck(cy.id, d, 'Mine now', deck('x'), {}, 2)).toBe('foreign')
      expect(await db.deleteDeck(cy.id, d)).toBe(false)
      expect(await db.shareDeck(cy.id, d, true)).toBeUndefined()
      expect(await db.listVersions(cy.id, d)).toEqual([])
      expect(await db.eventsSince(cy.id, d, 0)).toEqual([])
    })

    it('a viewer reads and cannot write', async () => {
      const db = await make(), { ann, cy, id } = people(), d = id()
      const ws = await seedUser(db, ann)
      await db.putDeck(ann.id, d, 'Board', deck('Board'), {}, 0, { workspaceId: ws })
      await db.writeVersion(ann.id, d, version(1))
      await join(db, ann, ws, cy, 'viewer')

      expect((await db.listDecks(cy.id, ws)).map((x) => x.id)).toEqual([d])
      expect((await db.getDeck(cy.id, d))?.role).toBe('viewer')
      expect((await db.getDeckMeta(cy.id, d))?.role).toBe('viewer')
      expect(await db.putDeck(cy.id, d, 'Board', deck('Cy'), {}, 1)).toBe('foreign')
      expect(await db.deleteDeck(cy.id, d)).toBe(false)
      expect(await db.setPresence(cy.id, d, { editing: { slideId: 's_1', until: 9 } })).toBe(false)
      expect(await db.shareDeck(cy.id, d, true)).toBeUndefined()
      await db.writeVersion(cy.id, d, version(2))
      expect((await db.listVersions(ann.id, d)).map((v) => v.rev)).toEqual([1])
      await db.addEvents(cy.id, d, [{ rev: 2, by: 'Claude Code', slideId: 's_1', what: 'updated', paths: ['title'] }])
      expect(await db.eventsSince(ann.id, d, 0)).toEqual([])
      expect((await db.getDeck(ann.id, d))?.rev).toBe(1)
    })

    it('versions, blobs and events follow the deck, not the writer', async () => {
      const db = await make(), { ann, bob, id } = people(), d = id()
      const ws = await seedUser(db, ann)
      await db.putDeck(ann.id, d, 'Board', deck('Board'), {}, 0, { workspaceId: ws })
      await join(db, ann, ws, bob, 'editor')
      await db.putDeck(bob.id, d, 'Board', deck('Bob'), {}, 1)
      await db.writeVersion(bob.id, d, version(2))
      await db.addEvents(bob.id, d, [{ rev: 2, by: 'Claude Code', slideId: 's_1', what: 'updated', paths: ['title'] }])
      expect((await db.listVersions(ann.id, d)).map((v) => v.rev)).toEqual([2])
      expect((await db.versionHead(ann.id, d))?.n).toBe(1)
      expect((await db.blobs(ann.id, d, ['h1'])).map((b) => b.hash)).toEqual(['h1'])
      expect((await db.eventsSince(ann.id, d, 0)).map((e) => e.rev)).toEqual([2])
    })

    it('a new deck lands only where the writer can edit', async () => {
      const db = await make(), { ann, bob, cy, id } = people()
      const annWs = await seedUser(db, ann), bobWs = await seedUser(db, bob)
      await join(db, ann, annWs, cy, 'viewer')
      expect(await db.putDeck(cy.id, id(), 'Sneaky', deck('x'), {}, 0, { workspaceId: annWs })).toBe('foreign')
      expect(await db.listDecks(ann.id, annWs)).toEqual([])

      const d = id()
      await db.putDeck(ann.id, d, 'Board', deck('Board'), {}, 0, { workspaceId: annWs })
      await join(db, ann, annWs, bob, 'editor')
      expect(await db.putDeck(bob.id, d, 'Board', deck('Moved?'), {}, 1, { workspaceId: bobWs })).toEqual({ rev: 2 })
      expect((await db.listDecks(ann.id, annWs)).map((x) => x.id)).toEqual([d])
      expect(await db.listDecks(bob.id, bobWs)).toEqual([])
    })

    it('invites', async () => {
      const db = await make(), { ann, bob, cy } = people()
      const ws = await seedUser(db, ann), now = Date.now()
      expect(await db.addInvite(ann.id, ws, bob.email, 'editor', `t_bob_${ws}`, now + DAY)).toBe('ok')
      expect(await db.addInvite(ann.id, ws, bob.email.toUpperCase(), 'viewer', `t_bob2_${ws}`, now + DAY)).toBe('ok')
      expect(await db.acceptInvite(cy, `t_bob_${ws}`, now)).toEqual({ wrongEmail: bob.email })
      expect(await db.acceptInvite(bob, `t_bob_${ws}`, now)).toEqual({ workspaceId: ws, role: 'editor' })
      // Accepting uses the invite up, and the other one to that email with it.
      expect(await db.acceptInvite(bob, `t_bob_${ws}`, now)).toBe('gone')
      expect(await db.acceptInvite(bob, `t_bob2_${ws}`, now)).toBe('gone')
      expect((await db.listMembers(ann.id, ws))?.map((m) => [m.userId, m.role, m.personal])).toEqual([[ann.id, 'owner', true], [bob.id, 'editor', false]])
      // A member gets no invite: their role changes in the list.
      expect(await db.addInvite(ann.id, ws, bob.email, 'owner', `t_bob3_${ws}`, now + DAY)).toBe('member')

      expect(await db.addInvite(ann.id, ws, cy.email, 'viewer', `t_old_${ws}`, now - 1)).toBe('ok')
      expect(await db.acceptInvite(cy, `t_old_${ws}`, now)).toBe('gone')
      expect(await db.addInvite(ann.id, ws, cy.email, 'viewer', `t_cy_${ws}`, now + DAY)).toBe('ok')
      // Open invites only: not the expired one.
      expect((await db.listInvites(ann.id, ws))?.map((i) => i.token)).toEqual([`t_cy_${ws}`])
      expect(await db.revokeInvite(ann.id, ws, `t_cy_${ws}`)).toBe(true)
      expect(await db.acceptInvite(cy, `t_cy_${ws}`, now)).toBe('gone')
      expect(await db.acceptInvite(cy, `t_none_${ws}`, now)).toBe('gone')

      // Only an owner manages invites.
      expect(await db.addInvite(bob.id, ws, cy.email, 'owner', `t_bobs_${ws}`, now + DAY)).toBe('denied')
      expect(await db.listInvites(bob.id, ws)).toBeNull()
      expect(await db.revokeInvite(bob.id, ws, `t_old_${ws}`)).toBe(false)
    })

    it('an old invite never hands back a role after a demotion or a removal', async () => {
      const db = await make(), { ann, bob } = people()
      const ws = await seedUser(db, ann), now = Date.now()
      await db.addInvite(ann.id, ws, bob.email, 'editor', `t_back_${ws}`, now + DAY)
      await db.acceptInvite(bob, `t_back_${ws}`, now)
      expect(await db.setRole(ann.id, ws, bob.id, 'viewer')).toBe('ok')
      expect(await db.acceptInvite(bob, `t_back_${ws}`, now)).toBe('gone')
      expect((await db.listMembers(ann.id, ws))?.find((m) => m.userId === bob.id)?.role).toBe('viewer')
      expect(await db.setRole(ann.id, ws, bob.id, null)).toBe('ok')
      expect(await db.acceptInvite(bob, `t_back_${ws}`, now)).toBe('gone')
      expect(await db.listMembers(bob.id, ws)).toBeNull()
    })

    it('no one changes the owner of a personal workspace', async () => {
      const db = await make(), { ann, cy } = people()
      const ws = await seedUser(db, ann)
      await join(db, ann, ws, cy, 'owner')
      expect(await db.setRole(cy.id, ws, ann.id, 'viewer')).toBe('denied')
      expect(await db.setRole(cy.id, ws, ann.id, null)).toBe('denied')
      expect(await db.setRole(ann.id, ws, ann.id, 'editor')).toBe('denied')
      expect(await db.setRole(ann.id, ws, ann.id, 'owner')).toBe('ok')
      expect((await db.listMembers(ann.id, ws))?.find((m) => m.userId === ann.id)?.role).toBe('owner')
      expect(await db.setRole(ann.id, ws, cy.id, 'editor')).toBe('ok')
    })

    it('two owners stepping down at once leave one owner', async () => {
      const db = await make(), { ann, bob } = people()
      const ws = await db.createWorkspace(ann.id, 'Acme')
      await join(db, ann, ws, bob, 'owner')
      const both = await Promise.all([db.setRole(ann.id, ws, ann.id, 'editor'), db.setRole(bob.id, ws, bob.id, 'editor')])
      expect(both.sort()).toEqual(['last_owner', 'ok'])
      expect((await db.listMembers(ann.id, ws))?.filter((m) => m.role === 'owner')).toHaveLength(1)
    })

    it('the last owner stays', async () => {
      const db = await make(), { ann, bob } = people()
      const ws = await db.createWorkspace(ann.id, 'Acme')
      await join(db, ann, ws, bob, 'editor')
      expect(await db.setRole(ann.id, ws, ann.id, 'editor')).toBe('last_owner')
      expect(await db.setRole(ann.id, ws, ann.id, null)).toBe('last_owner')
      expect(await db.setRole(bob.id, ws, bob.id, 'owner')).toBe('denied')
      expect(await db.setRole(ann.id, ws, bob.id, 'owner')).toBe('ok')
      expect(await db.setRole(ann.id, ws, ann.id, 'editor')).toBe('ok')
      expect(await db.setRole(ann.id, ws, ann.id, null)).toBe('ok')
      expect((await db.listMembers(bob.id, ws))?.map((m) => [m.userId, m.role])).toEqual([[bob.id, 'owner']])
    })

    it('workspaces: create, rename, most recently used first', async () => {
      const db = await make(), { ann, bob } = people()
      const mine = await seedUser(db, ann), acme = await db.createWorkspace(ann.id, 'Acme')
      await db.touchWorkspace(ann.id, mine)
      await db.touchWorkspace(ann.id, acme)
      expect((await db.listWorkspaces(ann.id)).map((w) => [w.name, w.role, w.personal])).toEqual([['Acme', 'owner', false], ['Ann’s workspace', 'owner', true]])
      expect(await db.renameWorkspace(ann.id, acme, 'Acme Corp')).toBe(true)
      await join(db, ann, acme, bob, 'editor')
      expect(await db.renameWorkspace(bob.id, acme, 'Bob Corp')).toBe(false)
      expect((await db.listWorkspaces(bob.id)).map((w) => [w.name, w.role, w.members])).toEqual([['Acme Corp', 'editor', 2]])
    })

    it('docs follow the same rules', async () => {
      const db = await make(), { ann, bob, cy, id } = people(), doc = id('doc')
      const ws = await seedUser(db, ann)
      expect(await db.putDoc(ann.id, doc, 'Memo', '# Memo', 0, ws)).toEqual({ rev: 1 })
      await join(db, ann, ws, bob, 'viewer')
      await seedUser(db, cy)
      expect(await db.listDocs(bob.id, ws)).toMatchObject([{ id: doc, name: 'Memo', workspaceId: ws }])
      expect((await db.getDoc(bob.id, doc))?.text).toBe('# Memo')
      expect(await db.putDoc(bob.id, doc, 'Memo', '# Bob', 1)).toBe('foreign')
      expect(await db.deleteDoc(bob.id, doc)).toBe(false)
      expect(await db.listDocs(cy.id, ws)).toEqual([])
      expect(await db.getDoc(cy.id, doc)).toBeNull()
      expect(await db.putDoc(cy.id, doc, 'Memo', '# Cy', 1)).toBe('foreign')
      expect(await db.putDoc(ann.id, doc, 'Memo', '# Memo 2', 0)).toBe('conflict')
      expect(await db.putDoc(ann.id, doc, 'Memo', '# Memo 2', 1)).toEqual({ rev: 2 })
      expect(await db.deleteDoc(ann.id, doc)).toBe(true)
      expect(await db.getDoc(ann.id, doc)).toBeNull()
    })

    it('doc versions follow the doc: members read them, editors write them, deleting the doc clears them', async () => {
      const db = await make(), { ann, bob, cy, id } = people(), doc = id('doc')
      const ws = await seedUser(db, ann)
      await db.putDoc(ann.id, doc, 'Memo', '# Memo', 0, ws)
      await join(db, ann, ws, bob, 'viewer')
      await seedUser(db, cy)
      await db.writeDocVersion(ann.id, doc, docVersion(1))
      await db.writeDocVersion(bob.id, doc, docVersion(2)) // a viewer writes nothing
      await db.writeDocVersion(cy.id, doc, docVersion(3))
      expect(await db.listDocVersions(ann.id, doc)).toMatchObject([{ n: 1, rev: 1, by: 'Ann', tree: { title: 'Memo', blocks: ['h1'] } }])
      expect(await db.listDocVersions(bob.id, doc)).toHaveLength(1)
      expect(await db.listDocVersions(cy.id, doc)).toEqual([])
      expect(await db.docVersionHead(bob.id, doc)).toMatchObject({ n: 1, key: 'k1', hashes: ['h1'] })
      expect(await db.docBlobs(bob.id, doc, ['h1', 'nope'])).toEqual([{ hash: 'h1', block: { type: 'paragraph', text: 'Hello' } }])
      expect(await db.docBlobs(cy.id, doc, ['h1'])).toEqual([])
      await db.writeDocVersion(ann.id, doc, { ...docVersion(2), replace: 1 })
      expect(await db.listDocVersions(ann.id, doc)).toMatchObject([{ n: 1, rev: 2 }])
      expect(await db.deleteDoc(ann.id, doc)).toBe(true)
      expect(await db.listDocVersions(ann.id, doc)).toEqual([])
      expect(await db.docBlobs(ann.id, doc, ['h1'])).toEqual([])
    })

    it('doc presence and revision: editors set it, members read it', async () => {
      const db = await make(), { ann, bob, cy, id } = people(), doc = id('doc')
      const ws = await seedUser(db, ann)
      await db.putDoc(ann.id, doc, 'Memo', '# Memo', 0, ws)
      await join(db, ann, ws, bob, 'viewer')
      await seedUser(db, cy)
      expect(await db.setDocPresence(ann.id, doc, { editing: { by: 'Ann', until: 99 } })).toBe(true)
      expect(await db.setDocPresence(bob.id, doc, { editing: { by: 'Bob', until: 99 } })).toBe(false)
      expect(await db.setDocPresence(cy.id, doc, {})).toBe(false)
      expect(await db.getDocMeta(bob.id, doc)).toEqual({ rev: 1, presence: { editing: { by: 'Ann', until: 99 } }, role: 'viewer' })
      expect(await db.getDocMeta(cy.id, doc)).toBeNull()
    })

    it('doc comments: viewers add, editors and authors resolve, authors remove, strangers get foreign', async () => {
      const db = await make(), { ann, bob, cy, id } = people(), doc = id('doc')
      const ws = await seedUser(db, ann)
      await db.putDoc(ann.id, doc, 'Memo', '# Memo', 0, ws)
      await join(db, ann, ws, bob, 'viewer')
      await seedUser(db, cy)
      const ctx = (n: number, by: string) => ({ id: `c_${n}`, by, now: 1000 + n })
      const made = await db.docComment(bob.id, doc, { add: { text: 'Check this', anchor: 'intro', quote: 'the words' } }, ctx(1, 'Bob'))
      expect(made).toMatchObject([{ id: 'c_1', anchor: 'intro', text: 'Check this', by: 'Bob', at: 1001, quote: 'the words', userId: bob.id }])
      expect(await db.docComment(cy.id, doc, { add: { text: 'Hi', anchor: 'intro' } }, ctx(2, 'Cy'))).toBe('foreign')
      expect(await db.docComments(cy.id, doc)).toBeNull()
      await db.docComment(ann.id, doc, { add: { text: 'Mine', anchor: 'intro' } }, ctx(3, 'Ann'))
      // Bob (a viewer) may not resolve Ann's, nor remove Bob's by anyone else; Ann (editor) resolves Bob's.
      expect(typeof await db.docComment(bob.id, doc, { resolve: { id: 'c_3' } }, ctx(4, 'Bob'))).toBe('string')
      expect(typeof await db.docComment(ann.id, doc, { remove: { id: 'c_1' } }, ctx(4, 'Ann'))).toBe('string')
      const done = await db.docComment(ann.id, doc, { resolve: { id: 'c_1', reply: 'Fixed' } }, ctx(5, 'Ann'))
      expect(done).toMatchObject([{ id: 'c_1', done: { by: 'Ann', at: 1005, reply: 'Fixed' } }, { id: 'c_3' }])
      // An author resolves their own, even a viewer.
      await db.docComment(bob.id, doc, { add: { text: 'Again', anchor: 'intro' } }, ctx(6, 'Bob'))
      expect(await db.docComment(bob.id, doc, { resolve: { id: 'c_6' } }, ctx(7, 'Bob'))).toMatchObject([{ id: 'c_1' }, { id: 'c_3' }, { id: 'c_6', done: { by: 'Bob' } }])
      expect(await db.docComment(bob.id, doc, { remove: { id: 'c_1' } }, ctx(8, 'Bob'))).toMatchObject([{ id: 'c_3' }, { id: 'c_6' }])
      expect(typeof await db.docComment(bob.id, doc, { remove: { id: 'c_nope' } }, ctx(9, 'Bob'))).toBe('string')
      expect((await db.docComments(bob.id, doc))?.map((c) => c.id)).toEqual(['c_3', 'c_6'])
    })
  })
}

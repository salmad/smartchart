import { describe, expect, it } from 'vitest'
import type { User } from '../../api/_lib/auth'
import { decksHandler } from '../../api/_lib/decks'
import { docsHandler } from '../../api/_lib/docs'
import { shareHandler } from '../../api/_lib/share'
import { workspacesHandler } from '../../api/_lib/workspaces'
import { fakeDb, type FakeDb } from './fake-db'

const user = (name: string, via: User['via'] = 'session'): User => ({ id: `u_${name.toLowerCase()}`, email: `${name.toLowerCase()}@example.com`, name, via })
const ann = user('Ann'), bob = user('Bob'), cy = user('Cy'), dee = user('Dee')
const call = (path: string, method: string, query = '', body?: unknown) =>
  new Request(`http://occam.test/api/${path}${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })

/** One fake database, and each API as each person. */
function world(db: FakeDb = fakeDb()) {
  const as = (who: User) => ({
    ws: (method: string, query = '', body?: unknown) => workspacesHandler({ userFrom: async () => who, db: () => db })(call('workspaces', method, query, body)),
    decks: (method: string, query = '', body?: unknown) => decksHandler({ userFrom: async () => who, db: () => db })(call('decks', method, query, body)),
    docs: (method: string, query = '', body?: unknown) => docsHandler({ userFrom: async () => who, db: () => db })(call('docs', method, query, body)),
    share: (method: string, query = '') => shareHandler({ userFrom: async () => who, db: () => db })(call('share', method, query)),
  })
  return { db, as }
}
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T
const personal = async (w: ReturnType<ReturnType<typeof world>['as']>) => (await json<{ id: string; personal: boolean }[]>(w.ws('GET'))).find((x) => x.personal)?.id as string
/** The owner invites `email` as `role`; returns the token from the link. */
const invite = async (owner: ReturnType<ReturnType<typeof world>['as']>, ws: string, email: string, role: string) => {
  const r = await owner.ws('POST', `?id=${ws}&invite`, { email, role })
  expect(r.status).toBe(200)
  const { link } = await json<{ link: string }>(r)
  expect(link).toMatch(/^http:\/\/occam\.test\/i\/[\w-]{16,}$/)
  return link.split('/i/')[1]
}
const deck = (id: string, baseRev = 0, extra: object = {}) => ({ id, name: 'Board', data: { items: [] }, chat: {}, baseRev, ...extra })

describe('workspaces API', () => {
  it('two people share a workspace; the viewer can’t edit', async () => {
    const { as } = world(), A = as(ann), B = as(bob), C = as(cy), D = as(dee)
    expect((await A.decks('PUT', '', deck('d_1'))).status).toBe(200)
    const ws = await personal(A)
    expect((await json<{ id: string }[]>(A.decks('GET', `?workspace=${ws}`))).map((d) => d.id)).toEqual(['d_1'])

    const tb = await invite(A, ws, bob.email, 'editor'), tc = await invite(A, ws, cy.email, 'viewer')
    expect(await json(B.ws('POST', `?accept=${tb}`))).toEqual({ workspaceId: ws, role: 'editor' })
    expect(await json(C.ws('POST', `?accept=${tc}`))).toEqual({ workspaceId: ws, role: 'viewer' })

    expect((await json<{ id: string }[]>(B.decks('GET', `?workspace=${ws}`))).map((d) => d.id)).toEqual(['d_1'])
    expect(await json(B.decks('GET', '?id=d_1'))).toMatchObject({ id: 'd_1', role: 'editor' })
    expect((await B.decks('PUT', '', deck('d_1', 1))).status).toBe(200)

    expect(await json(C.decks('GET', '?id=d_1'))).toMatchObject({ id: 'd_1', role: 'viewer' })
    const put = await C.decks('PUT', '', deck('d_1', 2))
    expect(put.status).toBe(403)
    expect(await json(put)).toEqual({ error: 'You can view this deck, not edit it.' })
    expect((await C.decks('DELETE', '?id=d_1')).status).toBe(403)
    expect((await C.share('POST', '?id=d_1')).status).toBe(403)
    expect((await C.decks('PUT', '?id=d_1&presence=1', { editing: 's_1' })).status).toBe(403)

    expect(await json(D.decks('GET', `?workspace=${ws}`))).toEqual([])
    expect((await D.decks('GET', '?id=d_1')).status).toBe(404)
    expect((await D.decks('PUT', '', deck('d_1', 2))).status).toBe(404)
    expect((await D.decks('DELETE', '?id=d_1')).status).toBe(404)
    expect((await D.share('POST', '?id=d_1')).status).toBe(404)
    expect((await D.ws('GET', `?id=${ws}&members`)).status).toBe(404)
  })

  it('a new deck goes into the workspace asked for, only where the writer may edit', async () => {
    const { as, db } = world(), A = as(ann), C = as(cy)
    const ws = await personal(A), acme = (await json<{ id: string }>(A.ws('POST', '', { name: 'Acme' }))).id
    expect((await A.decks('PUT', '', deck('d_2', 0, { workspaceId: acme }))).status).toBe(200)
    expect(db.rows.get('d_2')?.ws).toBe(acme)
    await C.ws('POST', `?accept=${await invite(A, ws, cy.email, 'viewer')}`)
    const r = await C.decks('PUT', '', deck('d_3', 0, { workspaceId: ws }))
    expect(r.status).toBe(403)
    expect(await json(r)).toEqual({ error: 'You can view this workspace, not add to it.' })
    expect((await C.decks('PUT', '', deck('d_4', 0, { workspaceId: acme }))).status).toBe(404)
    expect(db.rows.has('d_3') || db.rows.has('d_4')).toBe(false)
  })

  it('lists, creates, renames and touches workspaces', async () => {
    const { as } = world(), A = as(ann), B = as(bob)
    expect(await json(A.ws('GET'))).toMatchObject([{ name: 'Ann’s workspace', role: 'owner', personal: true }])
    const { id } = await json<{ id: string }>(A.ws('POST', '', { name: '  Acme  ' }))
    expect((await A.ws('PUT', `?id=${id}`, { used: true })).status).toBe(200)
    expect((await json<{ name: string }[]>(A.ws('GET')))[0].name).toBe('Acme')
    expect((await A.ws('PUT', `?id=${id}`, { name: 'Acme Corp' })).status).toBe(200)
    expect((await A.ws('POST', '', { name: ' ' })).status).toBe(400)
    expect((await B.ws('PUT', `?id=${id}`, { name: 'Mine' })).status).toBe(404)
    await B.ws('POST', `?accept=${await invite(A, id, bob.email, 'editor')}`)
    expect((await B.ws('PUT', `?id=${id}`, { name: 'Mine' })).status).toBe(403)
    expect((await B.ws('PUT', `?id=${id}`, { used: true })).status).toBe(200)
    expect((await json<{ name: string }[]>(B.ws('GET')))[0].name).toBe('Acme Corp')
  })

  it('members and open invites; only an owner sees the invites', async () => {
    const { as } = world(), A = as(ann), B = as(bob)
    const ws = await personal(A)
    await B.ws('POST', `?accept=${await invite(A, ws, bob.email, 'viewer')}`)
    await invite(A, ws, cy.email, 'editor')
    const mine = await json<{ members: { userId: string; role: string }[]; invites: { email: string }[] }>(A.ws('GET', `?id=${ws}&members`))
    expect(mine.members.map((m) => [m.userId, m.role])).toEqual([[ann.id, 'owner'], [bob.id, 'viewer']])
    expect(mine.invites.map((i) => i.email)).toEqual([cy.email])
    expect(await json(B.ws('GET', `?id=${ws}&members`))).toMatchObject({ invites: [] })
  })

  it('roles: an owner changes them, anyone may leave, the last owner stays', async () => {
    const { as } = world(), A = as(ann), B = as(bob)
    const { id } = await json<{ id: string }>(A.ws('POST', '', { name: 'Acme' }))
    await B.ws('POST', `?accept=${await invite(A, id, bob.email, 'editor')}`)
    expect((await B.ws('PUT', `?id=${id}&member=${ann.id}`, { role: 'viewer' })).status).toBe(403)
    const last = await A.ws('PUT', `?id=${id}&member=${ann.id}`, { role: 'editor' })
    expect(last.status).toBe(409)
    expect(await json(last)).toEqual({ error: 'A workspace needs an owner. Make someone else owner first.' })
    expect((await A.ws('PUT', `?id=${id}&member=${bob.id}`, { role: 'boss' })).status).toBe(400)
    expect((await A.ws('PUT', `?id=${id}&member=${bob.id}`, { role: 'viewer' })).status).toBe(200)
    expect((await B.ws('PUT', `?id=${id}&member=${bob.id}`, { role: null })).status).toBe(200)
    expect((await B.ws('GET', `?id=${id}&members`)).status).toBe(404)
    expect((await A.ws('PUT', `?id=${await personal(A)}&member=${ann.id}`, { role: null })).status).toBe(403)
  })

  it('invites: another email, expired, revoked, twice, and never a lower role', async () => {
    const { as, db } = world(), A = as(ann), B = as(bob), C = as(cy)
    const ws = await personal(A), t = await invite(A, ws, bob.email, 'editor')
    const wrong = await C.ws('POST', `?accept=${t}`)
    expect(wrong.status).toBe(403)
    expect(await json(wrong)).toEqual({ error: `This invite is for another email. Sign in as ${bob.email} to accept it.` })
    expect((await B.ws('POST', `?accept=${t}`)).status).toBe(200)
    expect((await B.ws('POST', `?accept=${t}`)).status).toBe(410)
    const again = await A.ws('POST', `?id=${ws}&invite`, { email: bob.email, role: 'owner' })
    expect(again.status).toBe(409)
    expect(await json(again)).toEqual({ error: `${bob.email} is in this workspace already. Change their role in the list.` })

    const old = await invite(A, ws, cy.email, 'viewer')
    const i = db.invites.get(old)
    if (i) i.expires = Date.now() - 1
    const gone = await C.ws('POST', `?accept=${old}`)
    expect(gone.status).toBe(410)
    expect(await json(gone)).toEqual({ error: 'This invite expired or was taken back.' })
    const back = await invite(A, ws, cy.email, 'viewer')
    expect((await B.ws('DELETE', `?id=${ws}&invite=${back}`)).status).toBe(403)
    expect((await A.ws('DELETE', `?id=${ws}&invite=${back}`)).status).toBe(204)
    expect((await C.ws('POST', `?accept=${back}`)).status).toBe(410)
    expect((await A.ws('POST', `?id=${ws}&invite`, { email: 'not an email', role: 'viewer' })).status).toBe(400)
    expect((await B.ws('POST', `?id=${ws}&invite`, { email: cy.email, role: 'viewer' })).status).toBe(403)
  })

  it('agent keys act on decks, not on who is in a workspace', async () => {
    const { as } = world(), A = as(ann), K = as({ ...ann, via: 'key' })
    const ws = await personal(A), t = await invite(A, ws, bob.email, 'viewer')
    expect((await K.ws('GET')).status).toBe(200)
    expect((await K.ws('POST', '', { name: 'Acme' })).status).toBe(403)
    expect((await K.ws('GET', `?id=${ws}&members`)).status).toBe(403)
    expect((await K.ws('PUT', `?id=${ws}&member=${ann.id}`, { role: 'editor' })).status).toBe(403)
    expect((await K.ws('POST', `?id=${ws}&invite`, { email: cy.email, role: 'viewer' })).status).toBe(403)
    expect((await K.ws('DELETE', `?id=${ws}&invite=${t}`)).status).toBe(403)
    expect((await as({ ...bob, via: 'key' }).ws('POST', `?accept=${t}`)).status).toBe(403)
    expect((await K.ws('PUT', `?id=${ws}`, { name: 'Renamed' })).status).toBe(403)
  })

  it('signed out: 401; no database: 503', async () => {
    expect((await workspacesHandler({ userFrom: async () => null, db: () => fakeDb() })(call('workspaces', 'GET'))).status).toBe(401)
    expect((await workspacesHandler({ userFrom: async () => ann, db: () => null })(call('workspaces', 'GET'))).status).toBe(503)
  })
})

describe('docs API', () => {
  it('lists, opens, saves and deletes docs by workspace, with the same roles', async () => {
    const { as } = world(), A = as(ann), C = as(cy), D = as(dee)
    const ws = await personal(A)
    const doc = { id: 'doc_1', name: 'Memo', text: '# Memo', baseRev: 0, workspaceId: ws }
    expect(await json(A.docs('PUT', '', doc))).toEqual({ ok: true, rev: 1 })
    expect((await A.docs('PUT', '', { ...doc, text: '# Stale' })).status).toBe(409)
    expect(await json(A.docs('GET', `?workspace=${ws}`))).toMatchObject([{ id: 'doc_1', name: 'Memo' }])
    expect(await json(A.docs('GET', '?id=doc_1'))).toMatchObject({ text: '# Memo', rev: 1 })
    expect((await A.docs('GET')).status).toBe(400)

    await C.ws('POST', `?accept=${await invite(A, ws, cy.email, 'viewer')}`)
    expect((await C.docs('GET', '?id=doc_1')).status).toBe(200)
    const r = await C.docs('PUT', '', { ...doc, baseRev: 1 })
    expect(r.status).toBe(403)
    expect(await json(r)).toEqual({ error: 'You can view this doc, not edit it.' })
    expect((await C.docs('DELETE', '?id=doc_1')).status).toBe(403)
    expect((await D.docs('GET', '?id=doc_1')).status).toBe(404)
    expect((await D.docs('PUT', '', { ...doc, baseRev: 1 })).status).toBe(404)
    expect((await A.docs('PUT', '', { ...doc, text: 5 })).status).toBe(400)
    expect((await A.docs('DELETE', '?id=doc_1')).status).toBe(204)
    expect((await A.docs('GET', '?id=doc_1')).status).toBe(404)
  })

  it('revision, presence, versions and comments: viewers comment and read, never write', async () => {
    const { as } = world(), A = as(ann), C = as(cy), D = as(dee)
    const ws = await personal(A)
    const doc = { id: 'doc_2', name: 'Memo', text: '---\ntitle: Memo\n---\n\nHello.\n', baseRev: 0, workspaceId: ws }
    expect((await A.docs('PUT', '', doc)).status).toBe(200)
    await C.ws('POST', `?accept=${await invite(A, ws, cy.email, 'viewer')}`)

    // An editor's save records a version; the viewer reads the list and the blobs.
    const [v] = await json<{ n: number; tree: { title: string; blocks: string[] } }[]>(C.docs('GET', '?id=doc_2&versions'))
    expect(v).toMatchObject({ n: 1, tree: { title: 'Memo' } })
    const blobs = await json<{ hash: string; block: unknown }[]>(C.docs('GET', `?id=doc_2&blobs=${v.tree.blocks.join(',')}`))
    expect(blobs.map((b) => b.block)).toEqual([{ type: 'paragraph', text: 'Hello.' }])
    expect((await D.docs('GET', '?id=doc_2&versions')).status).toBe(404)

    // The revision carries the role.
    expect(await json(C.docs('GET', '?id=doc_2&rev=1'))).toEqual({ rev: 1, presence: {}, role: 'viewer' })
    expect((await D.docs('GET', '?id=doc_2&rev=1')).status).toBe(404)

    // Presence: editors only; the server stamps the name.
    expect((await A.docs('PUT', '?id=doc_2&presence=1', { editing: true })).status).toBe(200)
    expect(await json<{ presence: { editing: { by: string; until: number } } }>(C.docs('GET', '?id=doc_2&rev=1'))).toMatchObject({ presence: { editing: { by: 'Ann' } } })
    expect((await C.docs('PUT', '?id=doc_2&presence=1', { editing: true })).status).toBe(403)
    expect((await A.docs('PUT', '?id=doc_2&presence=1', { editing: false })).status).toBe(200)
    expect((await json<{ presence: object }>(A.docs('GET', '?id=doc_2&rev=1'))).presence).toEqual({})

    // A viewer's comment lands; the viewer's save is still refused.
    const c = await C.docs('PUT', '?id=doc_2&comment=1', { add: { text: 'Check this', anchor: 'intro', quote: 'Hello' } })
    expect(c.status).toBe(200)
    expect(await json(c)).toMatchObject([{ anchor: 'intro', text: 'Check this', by: 'Cy' }])
    const r = await C.docs('PUT', '', { ...doc, baseRev: 1 })
    expect(r.status).toBe(403)
    expect(await json(r)).toEqual({ error: 'You can view this doc, not edit it.' })
    const [one] = await json<{ id: string }[]>(A.docs('GET', '?id=doc_2&comments'))
    expect(await json(A.docs('PUT', '?id=doc_2&comment=1', { resolve: { id: one.id, reply: 'Done' } }))).toMatchObject([{ id: one.id, done: { by: 'Ann', reply: 'Done' } }])
    expect((await A.docs('PUT', '?id=doc_2&comment=1', { add: { text: 'x'.repeat(1001), anchor: 'intro' } })).status).toBe(400)
    expect((await A.docs('PUT', '?id=doc_2&comment=1', { add: { text: 'Hi', anchor: 'not an id!' } })).status).toBe(400)
    expect((await D.docs('PUT', '?id=doc_2&comment=1', { add: { text: 'Hi', anchor: 'intro' } })).status).toBe(404)
    expect((await C.docs('PUT', '?id=doc_2&comment=1', { resolve: { id: 'c_nope' } })).status).toBe(404)

    // Another editor save is a new version (a pause past GROUP_MS is not needed: a changed doc by a new key is added or folded).
    expect((await A.docs('PUT', '', { ...doc, text: doc.text + '\nMore.\n', baseRev: 1 })).status).toBe(200)
    expect((await json<unknown[]>(A.docs('GET', '?id=doc_2&versions'))).length).toBeGreaterThanOrEqual(1)
  })
})

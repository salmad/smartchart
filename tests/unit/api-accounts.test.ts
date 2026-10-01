import { describe, expect, it } from 'vitest'
import { sessionUser, type User } from '../../api/_lib/auth'
import { fakeDb } from './fake-db'
import { decksHandler } from '../../api/_lib/decks'
import { shareHandler } from '../../api/_lib/share'
import { modelGate } from '../../api/_lib/quota'
import { routeFor } from '../../vite/api-dev'

const as = (who: User | null) => async () => who
const ann: User = { id: 'u_ann', email: 'ann@example.com', via: 'session' }, bob: User = { id: 'u_bob', email: 'bob@example.com', via: 'session' }
const req = (method: string, query = '', body?: unknown) =>
  new Request(`http://x/api/decks${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
/** A deck save as the app sends it: `baseRev` is the revision it read (0 for a new deck). */
const put = (id: string, name: string, data: unknown, baseRev = 0) => req('PUT', '', { id, name, data, chat: {}, baseRev })

describe('decks API', () => {
  it('asks a signed-out visitor to sign in', async () => {
    const r = await decksHandler({ userFrom: as(null), db: () => fakeDb() })(req('GET'))
    expect(r.status).toBe(401)
  })
  it('saves, lists, opens and deletes a deck for its owner', async () => {
    const db = fakeDb(), h = decksHandler({ userFrom: as(ann), db: () => db })
    expect((await h(put('d_1', 'Board update', { items: [] }))).status).toBe(200)
    const listed = await (await h(req('GET'))).json()
    expect(listed).toMatchObject([{ id: 'd_1', name: 'Board update', slides: 0 }])
    expect(listed[0]).not.toHaveProperty('data') // the list never carries a whole deck
    expect(await (await h(req('GET', '?id=d_1'))).json()).toMatchObject({ id: 'd_1', data: { items: [] } })
    expect((await h(req('DELETE', '?id=d_1'))).status).toBe(204)
    expect(await (await h(req('GET'))).json()).toEqual([])
  })
  it('never shows, overwrites or deletes another user’s deck', async () => {
    const db = fakeDb()
    await decksHandler({ userFrom: as(ann), db: () => db })(put('d_1', 'Ann’s', {}))
    const h = decksHandler({ userFrom: as(bob), db: () => db })
    expect(await (await h(req('GET'))).json()).toEqual([])
    expect((await h(req('GET', '?id=d_1'))).status).toBe(404)
    expect((await h(put('d_1', 'Bob’s', {}))).status).toBe(404)
    expect((await h(req('DELETE', '?id=d_1'))).status).toBe(404)
    expect(db.rows.get('d_1')?.name).toBe('Ann’s')
  })
  it('refuses a save made from a stale revision and keeps the newer deck', async () => {
    const db = fakeDb(), h = decksHandler({ userFrom: as(ann), db: () => db })
    expect(await (await h(put('d_1', 'One', { items: [] }))).json()).toEqual({ ok: true, rev: 1 })
    expect(await (await h(put('d_1', 'Two', { items: [] }, 1))).json()).toEqual({ ok: true, rev: 2 })
    expect((await h(put('d_1', 'Stale tab', { items: [] }, 1))).status).toBe(409)
    expect(db.rows.get('d_1')?.name).toBe('Two')
  })
  it('opens a deck with its chat and revision', async () => {
    const db = fakeDb(), h = decksHandler({ userFrom: as(ann), db: () => db })
    await h(req('PUT', '', { id: 'd_1', name: 'n', data: { items: [] }, chat: { history: [1] }, baseRev: 0 }))
    expect(await (await h(req('GET', '?id=d_1'))).json()).toMatchObject({ rev: 1, chat: { history: [1] } })
  })
  it('answers 404, never 409, to a save on another user’s deck', async () => {
    const db = fakeDb()
    await decksHandler({ userFrom: as(ann), db: () => db })(put('d_1', 'Ann’s', {}))
    expect((await decksHandler({ userFrom: as(bob), db: () => db })(put('d_1', 'Bob’s', {}, 5))).status).toBe(404)
  })
  it('re-creates a deck deleted elsewhere instead of calling it a conflict', async () => {
    const h = decksHandler({ userFrom: as(ann), db: () => fakeDb() })
    expect(await (await h(put('d_gone', 'Gone', {}, 4))).json()).toEqual({ ok: true, rev: 1 })
  })
  it('rejects a save with no chat or revision', async () => {
    const h = decksHandler({ userFrom: as(ann), db: () => fakeDb() })
    expect((await h(req('PUT', '', { id: 'd_1', name: 'n', data: {} }))).status).toBe(400)
    expect((await h(req('PUT', '', { id: 'd_1', name: 'n', data: {}, chat: {}, baseRev: -1 }))).status).toBe(400)
    expect((await h(req('PUT', '', { id: 'd_1', name: 'n', data: {}, chat: {}, baseRev: 1.5 }))).status).toBe(400)
  })
  it('rejects a malformed deck', async () => {
    const h = decksHandler({ userFrom: as(ann), db: () => fakeDb() })
    expect((await h(put('../x', 'n', {}))).status).toBe(400)
    expect((await h(new Request('http://x/api/decks', { method: 'PUT', body: '{not json' }))).status).toBe(400)
  })
  it('says so when saving is not set up', async () => {
    expect((await decksHandler({ userFrom: as(ann), db: () => null })(req('GET'))).status).toBe(503)
  })
})

describe('share API', () => {
  const sreq = (method: string, query: string) => new Request(`http://x/api/share${query}`, { method })
  const deck = { style: 'pitch', theme: 'ink', accent: null, items: [{ id: 's1', slide: { template: 'cover', title: 'Q3' }, checks: ['x'] }], history: [{ role: 'user', content: 'secret' }], messages: [{ kind: 'user', text: 'secret' }] }
  it('lets the owner turn a link on and off, and anyone read it while on', async () => {
    const db = fakeDb()
    await decksHandler({ userFrom: as(ann), db: () => db })(put('d_1', 'Board update', deck))
    const h = shareHandler({ userFrom: as(ann), db: () => db }), anyone = shareHandler({ userFrom: as(null), db: () => db })
    expect(await (await h(sreq('GET', '?id=d_1'))).json()).toEqual({ share: null })
    const { share } = await (await h(sreq('POST', '?id=d_1'))).json() as { share: string }
    expect(share).toBeTruthy()
    expect(await (await h(sreq('POST', '?id=d_1'))).json()).toEqual({ share }) // the same link, not a new one
    const seen = await anyone(sreq('GET', `?s=${share}`))
    expect(seen.headers.get('cache-control')).toBe('no-store')
    const body = await seen.json()
    expect(body).toEqual({ name: 'Board update', style: 'pitch', theme: 'ink', accent: null, slides: [{ template: 'cover', title: 'Q3' }] })
    expect(JSON.stringify(body)).not.toContain('secret') // never the chat or the agent's history
    expect(await (await h(sreq('DELETE', '?id=d_1'))).json()).toEqual({ share: null })
    expect((await anyone(sreq('GET', `?s=${share}`))).status).toBe(404)
  })
  it('never shares another user’s deck, and asks a signed-out visitor to sign in to share', async () => {
    const db = fakeDb()
    await decksHandler({ userFrom: as(ann), db: () => db })(put('d_1', 'Ann’s', deck))
    const bobs = shareHandler({ userFrom: as(bob), db: () => db })
    expect((await bobs(sreq('POST', '?id=d_1'))).status).toBe(404)
    expect(db.rows.get('d_1')?.share).toBeFalsy()
    expect((await shareHandler({ userFrom: as(null), db: () => db })(sreq('POST', '?id=d_1'))).status).toBe(401)
    expect((await bobs(sreq('GET', '?s=../x'))).status).toBe(404)
  })
})

describe('model gate', () => {
  const call = () => new Request('http://x/api/glm', { method: 'POST' })
  it('answers 401 to a signed-out caller, lets a signed-in user through, and gates nothing without a database', async () => {
    const r = await modelGate(call(), { userFrom: as(null), db: fakeDb() })
    expect(r?.status).toBe(401)
    expect(await r?.json()).toMatchObject({ code: 'signin' })
    expect(await modelGate(call(), { userFrom: as(ann), db: fakeDb() })).toBeNull()
    expect(await modelGate(call(), { userFrom: as(null), db: null })).toBeNull()
  })
})

describe('session and routes', () => {
  it('reads the user from Better Auth’s get-session body', () => {
    expect(sessionUser({ user: { id: 'u1', email: 'a@b.c' }, session: {} })).toEqual({ id: 'u1', email: 'a@b.c', via: 'session' })
    expect(sessionUser(null)).toBeNull()
    expect(sessionUser({ user: null })).toBeNull()
    expect(sessionUser({ user: { email: 'x' } })).toBeNull()
  })
  it('dev routes match /api/auth/* like a catch-all file', () => {
    expect(routeFor('/api/auth/get-session')).toBeDefined()
    expect(routeFor('/api/auth/sign-in/social')).toBeDefined()
    expect(routeFor('/api/decks')).toBeDefined()
    expect(routeFor('/api/share')).toBeDefined()
    expect(routeFor('/api/nope')).toBeUndefined()
  })
})

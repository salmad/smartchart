import { describe, expect, it } from 'vitest'
import { sessionUser, type User } from '../../api/_lib/auth'
import type { Db, DeckRow } from '../../api/_lib/db'
import { decksHandler } from '../../api/_lib/decks'
import { shareHandler } from '../../api/_lib/share'
import { modelGate } from '../../api/_lib/quota'
import { routeFor } from '../../vite/api-dev'

/** An in-memory Db with the same ownership rules as the SQL one. */
function fakeDb(): Db & { rows: Map<string, DeckRow & { user: string; share?: string | null }> } {
  const rows = new Map<string, DeckRow & { user: string; share?: string | null }>()
  let n = 0
  return {
    rows,
    listDecks: async (u) => [...rows.values()].filter((r) => r.user === u).sort((a, b) => b.updated - a.updated).map(({ id, name, updated, data }) => {
      const d = data as { items?: { slide: unknown }[]; style?: unknown; theme?: unknown; accent?: unknown }
      return { id, name, updated, slides: d.items?.length ?? 0, style: d.style, theme: d.theme, accent: d.accent, first: d.items?.[0]?.slide ?? null }
    }),
    getDeck: async (u, id) => { const r = rows.get(id); return r && r.user === u ? r : null },
    putDeck: async (u, id, name, data) => {
      const r = rows.get(id)
      if (r && r.user !== u) return false
      rows.set(id, { id, name, data, updated: Date.now() + rows.size, user: u, share: r?.share })
      return true
    },
    deleteDeck: async (u, id) => { const r = rows.get(id); return !!r && r.user === u && rows.delete(id) },
    shareDeck: async (u, id, on) => {
      const r = rows.get(id)
      if (!r || r.user !== u) return undefined
      if (on !== undefined) r.share = on ? r.share ?? `tok_${++n}` : null
      return r.share ?? null
    },
    sharedDeck: async (t) => { const r = [...rows.values()].find((x) => x.share === t); return r ? { name: r.name, data: r.data } : null },
  }
}

const as = (who: User | null) => async () => who
const ann: User = { id: 'u_ann', email: 'ann@example.com' }, bob: User = { id: 'u_bob', email: 'bob@example.com' }
const req = (method: string, query = '', body?: unknown) =>
  new Request(`http://x/api/decks${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })

describe('decks API', () => {
  it('asks a signed-out visitor to sign in', async () => {
    const r = await decksHandler({ userFrom: as(null), db: () => fakeDb() })(req('GET'))
    expect(r.status).toBe(401)
  })
  it('saves, lists, opens and deletes a deck for its owner', async () => {
    const db = fakeDb(), h = decksHandler({ userFrom: as(ann), db: () => db })
    expect((await h(req('PUT', '', { id: 'd_1', name: 'Board update', data: { items: [] } }))).status).toBe(200)
    const listed = await (await h(req('GET'))).json()
    expect(listed).toMatchObject([{ id: 'd_1', name: 'Board update', slides: 0 }])
    expect(listed[0]).not.toHaveProperty('data') // the list never carries a whole deck
    expect(await (await h(req('GET', '?id=d_1'))).json()).toMatchObject({ id: 'd_1', data: { items: [] } })
    expect((await h(req('DELETE', '?id=d_1'))).status).toBe(204)
    expect(await (await h(req('GET'))).json()).toEqual([])
  })
  it('never shows, overwrites or deletes another user’s deck', async () => {
    const db = fakeDb()
    await decksHandler({ userFrom: as(ann), db: () => db })(req('PUT', '', { id: 'd_1', name: 'Ann’s', data: {} }))
    const h = decksHandler({ userFrom: as(bob), db: () => db })
    expect(await (await h(req('GET'))).json()).toEqual([])
    expect((await h(req('GET', '?id=d_1'))).status).toBe(404)
    expect((await h(req('PUT', '', { id: 'd_1', name: 'Bob’s', data: {} }))).status).toBe(404)
    expect((await h(req('DELETE', '?id=d_1'))).status).toBe(404)
    expect(db.rows.get('d_1')?.name).toBe('Ann’s')
  })
  it('rejects a malformed deck', async () => {
    const h = decksHandler({ userFrom: as(ann), db: () => fakeDb() })
    expect((await h(req('PUT', '', { id: '../x', name: 'n', data: {} }))).status).toBe(400)
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
    await decksHandler({ userFrom: as(ann), db: () => db })(req('PUT', '', { id: 'd_1', name: 'Board update', data: deck }))
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
    await decksHandler({ userFrom: as(ann), db: () => db })(req('PUT', '', { id: 'd_1', name: 'Ann’s', data: deck }))
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
    expect(sessionUser({ user: { id: 'u1', email: 'a@b.c' }, session: {} })).toEqual({ id: 'u1', email: 'a@b.c' })
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

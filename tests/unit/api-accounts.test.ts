import { describe, expect, it } from 'vitest'
import { sessionUser, type User } from '../../api/_lib/auth'
import type { Db, DeckRow } from '../../api/_lib/db'
import { decksHandler } from '../../api/_lib/decks'
import { ANON_CALLS_PER_DAY, clientKey, modelGate } from '../../api/_lib/quota'
import { routeFor } from '../../vite/api-dev'

/** An in-memory Db with the same ownership rules as the SQL one. */
function fakeDb(): Db & { rows: Map<string, DeckRow & { user: string }>; usage: Map<string, number> } {
  const rows = new Map<string, DeckRow & { user: string }>(), usage = new Map<string, number>()
  return {
    rows, usage,
    listDecks: async (u) => [...rows.values()].filter((r) => r.user === u).sort((a, b) => b.updated - a.updated),
    getDeck: async (u, id) => { const r = rows.get(id); return r && r.user === u ? r : null },
    putDeck: async (u, id, name, data) => {
      const r = rows.get(id)
      if (r && r.user !== u) return false
      rows.set(id, { id, name, data, updated: Date.now() + rows.size, user: u })
      return true
    },
    deleteDeck: async (u, id) => { const r = rows.get(id); return !!r && r.user === u && rows.delete(id) },
    bumpUsage: async (k) => { const n = (usage.get(k) ?? 0) + 1; usage.set(k, n); return n },
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
    expect(await (await h(req('GET'))).json()).toMatchObject([{ id: 'd_1', name: 'Board update' }])
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

describe('model quota', () => {
  const call = () => new Request('http://x/api/glm', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } })
  it('lets a visitor make the day’s allowance of calls, then answers 429', async () => {
    const db = fakeDb(), deps = { userFrom: as(null), db, salt: 's' }
    for (let i = 0; i < ANON_CALLS_PER_DAY; i++) expect(await modelGate(call(), deps)).toBeNull()
    const r = await modelGate(call(), deps)
    expect(r?.status).toBe(429)
    expect(await r?.json()).toMatchObject({ code: 'quota' })
  })
  it('never limits a signed-in user, and without a database nothing is limited', async () => {
    const db = fakeDb()
    for (let i = 0; i < ANON_CALLS_PER_DAY + 5; i++) expect(await modelGate(call(), { userFrom: as(ann), db, salt: 's' })).toBeNull()
    expect(db.usage.size).toBe(0)
    expect(await modelGate(call(), { userFrom: as(null), db: null, salt: 's' })).toBeNull()
  })
  it('keys by the first forwarded IP, hashed with a salt', () => {
    const k = clientKey(call(), 's')
    expect(k).toMatch(/^[0-9a-f]{32}$/)
    expect(k).not.toContain('203')
    expect(clientKey(call(), 't')).not.toBe(k)
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
    expect(routeFor('/api/nope')).toBeUndefined()
  })
})

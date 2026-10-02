import { describe, expect, it } from 'vitest'
import { bearerUser, hashKey, keysHandler, mintKey } from '../../api/_lib/keys'
import { fakeDb } from './fake-db'

describe('agent keys', () => {
  it('mints sc_ keys and stores only the hash', () => {
    const k = mintKey()
    expect(k.key).toMatch(/^sc_[A-Za-z0-9_-]{32,}$/)
    expect(k.hash).toBe(hashKey(k.key))
    expect(k.prefix).toBe(k.key.slice(0, 7))
  })
  it('a Bearer key resolves to its user only', async () => {
    const db = fakeDb(), k = mintKey()
    await db.addKey('u1', 'a@b.c', k.hash, k.prefix)
    const req = (h: string) => new Request('http://x/api/v1/whoami', { headers: { authorization: h } })
    expect(await bearerUser(req(`Bearer ${k.key}`), db)).toEqual({ id: 'u1', email: 'a@b.c', via: 'key' })
    expect(await bearerUser(req('Bearer sc_wrong'), db)).toBeNull()
    expect(await bearerUser(req('Basic abc'), db)).toBeNull()
  })
  it('the endpoint makes up to five keys (each shown once), lists them, and deletes one', async () => {
    const db = fakeDb(), handle = keysHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', via: 'session' }), db: () => db })
    const post = () => handle(new Request('http://x/api/keys', { method: 'POST' }))
    const made = (await (await post()).json()) as { key: string; id: string; prefix: string }
    expect(made.key).toMatch(/^sc_/)
    for (let i = 0; i < 4; i++) expect((await post()).status).toBe(200)
    expect((await post()).status).toBe(409)
    const list = (await (await handle(new Request('http://x/api/keys'))).json()) as { keys: { id: string; prefix: string }[]; max: number }
    expect(list.keys).toHaveLength(5)
    expect(list.max).toBe(5)
    expect(JSON.stringify(list)).not.toContain(made.key)
    expect((await handle(new Request(`http://x/api/keys?id=${made.id}`, { method: 'DELETE' }))).status).toBe(204)
    expect((await handle(new Request(`http://x/api/keys?id=${made.id}`, { method: 'DELETE' }))).status).toBe(404)
    expect((await post()).status).toBe(200)
  })
  it('keys belong to their user: another user cannot delete them', async () => {
    const db = fakeDb(), k = mintKey()
    await db.addKey('u1', 'a@b.c', k.hash, k.prefix)
    const other = keysHandler({ userFrom: async () => ({ id: 'u2', email: 'x@y.z', via: 'session' }), db: () => db })
    expect((await other(new Request(`http://x/api/keys?id=${k.hash.slice(0, 12)}`, { method: 'DELETE' }))).status).toBe(404)
  })
  it('a key cannot mint keys', async () => {
    const db = fakeDb(), handle = keysHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', via: 'key' }), db: () => db })
    expect((await handle(new Request('http://x/api/keys', { method: 'POST' }))).status).toBe(403)
  })
})

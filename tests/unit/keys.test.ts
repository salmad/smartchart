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
    await db.putKey('u1', 'a@b.c', k.hash, k.prefix)
    const req = (h: string) => new Request('http://x/api/v1/whoami', { headers: { authorization: h } })
    expect(await bearerUser(req(`Bearer ${k.key}`), db)).toEqual({ id: 'u1', email: 'a@b.c', via: 'key' })
    expect(await bearerUser(req('Bearer sc_wrong'), db)).toBeNull()
    expect(await bearerUser(req('Basic abc'), db)).toBeNull()
  })
  it('the endpoint creates (shown once), reads the prefix, and deletes', async () => {
    const db = fakeDb(), handle = keysHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', via: 'session' }), db: () => db })
    const made = (await (await handle(new Request('http://x/api/keys', { method: 'POST' }))).json()) as { key: string; prefix: string }
    expect(made.key).toMatch(/^sc_/)
    expect(await (await handle(new Request('http://x/api/keys'))).json()).toEqual({ prefix: made.prefix })
    expect((await handle(new Request('http://x/api/keys', { method: 'DELETE' }))).status).toBe(204)
  })
  it('a key cannot mint keys', async () => {
    const db = fakeDb(), handle = keysHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', via: 'key' }), db: () => db })
    expect((await handle(new Request('http://x/api/keys', { method: 'POST' }))).status).toBe(403)
  })
})

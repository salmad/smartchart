import { describe, expect, it } from 'vitest'
import { restHandler } from '../../api/_lib/rest'
import { fakeDb } from './fake-db'
import { fakeJev } from './fakes'

const db = fakeDb()
const handle = restHandler({ userFrom: async (r) => (r.headers.get('authorization') === 'Bearer sc_good' ? { id: 'u1', email: 'a@b.c', via: 'key' } : null), db: () => db, jev: fakeJev() })
const post = (path: string, body: unknown, auth = 'Bearer sc_good') => handle(new Request(`https://app.test${path}`, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) }))

describe('REST host', () => {
  it('runs a tool by path', async () => {
    const r = await post('/api/v1/whoami', {})
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ email: 'a@b.c', contract: '2026-10-01' })
  })
  it('takes ?tool= from the rewrite', async () => expect((await post('/api/v1?tool=whoami', {})).status).toBe(200))
  it('401 without a key, 400 on bad input, 404 on a missing deck', async () => {
    expect((await post('/api/v1/whoami', {}, '')).status).toBe(401)
    expect((await post('/api/v1/get_deck', {})).status).toBe(400)
    expect((await post('/api/v1/get_deck', { deckId: 'd_none' })).status).toBe(404)
  })
  it('GET is 405', async () => expect((await handle(new Request('https://app.test/api/v1/whoami'))).status).toBe(405))
})

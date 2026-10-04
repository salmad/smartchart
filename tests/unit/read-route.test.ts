import { describe, expect, it } from 'vitest'
import { readHandler, DAILY_READS } from '../../api/_lib/read-route'
import { fakeDb } from './fake-db'

const me = async () => ({ id: 'u1', email: 'u1@x.y', via: 'session' as const })
const lookup = async () => [{ address: '93.184.216.34' }]
const post = (url: unknown) => new Request('https://app.test/api/read', { method: 'POST', body: JSON.stringify({ url }) })

describe('links in the chat', () => {
  it('fetches a public page and hands back its bytes, type and final address', async () => {
    const get = (async () => new Response('<html>Report</html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })) as unknown as typeof fetch
    const r = await readHandler({ userFrom: me, db: fakeDb, fetch: get, lookup })(post('https://reports.example/sme'))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/text\/html/)
    expect(r.headers.get('x-final-url')).toBe('https://reports.example/sme')
    expect(await r.text()).toBe('<html>Report</html>')
  })
  it('refuses the signed out, private addresses and a missing url, and caps a day', async () => {
    expect((await readHandler({ userFrom: async () => null, db: fakeDb })(post('https://x.example'))).status).toBe(401)
    const r = await readHandler({ userFrom: me, db: fakeDb })(post('https://127.0.0.1/admin'))
    expect(r.status).toBe(422)
    expect(((await r.json()) as { error: string }).error).toMatch(/not public/)
    expect((await readHandler({ userFrom: me, db: fakeDb })(post(''))).status).toBe(400)
    const db = fakeDb()
    for (let i = 0; i < DAILY_READS; i++) await db.bumpRate('read:u1', 0)
    expect((await readHandler({ userFrom: me, db: () => db, now: () => 1000 })(post('https://x.example'))).status).toBe(429)
  })
})

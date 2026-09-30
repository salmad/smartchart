import { expect, it } from 'vitest'
import type { Db } from '../../api/_lib/db'
import { modelGate } from '../../api/_lib/quota'

const ann = { id: 'u_ann', email: 'a@x.co' }, bob = { id: 'u_bob', email: 'b@x.co' }
const counting = () => {
  const n = new Map<string, number>()
  return { countCall: async (id: string) => { n.set(id, (n.get(id) ?? 0) + 1); return n.get(id) ?? 0 }, n } as unknown as Db & { n: Map<string, number> }
}
const call = () => new Request('http://x/api/glm', { method: 'POST' })

it('lets a signed-in user through up to the limit, then answers 429', async () => {
  const deps = { userFrom: async () => ann, db: counting() }
  expect(await modelGate(call(), deps, 2)).toBeNull()
  expect(await modelGate(call(), deps, 2)).toBeNull()
  const r = await modelGate(call(), deps, 2)
  expect(r?.status).toBe(429)
  expect(await r?.json()).toMatchObject({ code: 'limit' })
})
it('counts each user on their own', async () => {
  const db = counting()
  await modelGate(call(), { userFrom: async () => ann, db }, 1)
  expect(await modelGate(call(), { userFrom: async () => bob, db }, 1)).toBeNull()
})
it('lets the call through when the counter fails', async () => {
  const db = { countCall: async () => { throw new Error('neon down') } } as unknown as Db
  expect(await modelGate(call(), { userFrom: async () => ann, db }, 1)).toBeNull()
})
it('does not count a signed-out call, and limits nothing without a database', async () => {
  const db = counting()
  expect((await modelGate(call(), { userFrom: async () => null, db }, 1))?.status).toBe(401)
  expect(db.n.size).toBe(0)
  expect(await modelGate(call(), { userFrom: async () => ann, db: null }, 1)).toBeNull()
})

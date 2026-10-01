import { describe, expect, it } from 'vitest'
import { serverJev } from '../../api/_lib/models'
import { fakeDb } from './fake-db'

describe('serverJev', () => {
  it('posts to OpenRouter with the Jev model, maps keys back, and counts the call', async () => {
    const db = fakeDb(), sent: unknown[] = []
    const fetcher: typeof fetch = async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)))
      return Response.json({ answers: { template: { choice: 'chart', probabilities: { chart: 0.8, table: 0.2 } } }, usage: { cost: 0.001 } })
    }
    const jev = serverJev({ userId: 'u', db, fetcher })
    const r = await jev('state', { template: { instructions: 'Which?', options: { chart: 'A chart', table: 'A table' } } })
    expect(r.template).toEqual({ choice: 'chart', p: 0.8, probabilities: { chart: 0.8, table: 0.2 } })
    expect(sent[0]).toMatchObject({ model: '~typesafe/jev-latest', state: 'state' })
    expect(await db.callsToday('u')).toBe(1)
  })
  it('refuses over the daily limit', async () => {
    const db = fakeDb(), jev = serverJev({ userId: 'u', db, limit: 0, fetcher: async () => Response.json({ answers: {} }) })
    await expect(jev('s', {})).rejects.toMatchObject({ code: 'quota' })
  })
})

import { afterEach, beforeEach, test, expect, vi } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import type { DeckRepo, SavedDeck } from '@/app/store'

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

const deck = (id: string, title = 'Acme'): SavedDeck => ({
  id, style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1,
  items: [{ id: 's', slide: { template: 'cover', title, subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }],
})
/** A repo that answers from memory, with the revision and role it would report. */
function inner(decks: Record<string, SavedDeck>, rev = 3): DeckRepo & { seeded: unknown[] } {
  const seeded: unknown[] = []
  return {
    seeded, list: async () => [], get: async (id) => decks[id] ?? null, save: async (d) => { decks[d.id] = d; rev += 1; return null },
    remove: async (id) => delete decks[id], known: () => rev, role: () => 'editor', base: () => null,
    seed: (d, r, role) => { seeded.push([d.id, r, role]) },
  }
}
const load = () => Promise.all([import('@/app/cached-decks'), import('@/app/cache')])

test('a deck read is stored with its revision and role, and read back', async () => {
  const [{ cachedDeckRepo, readCachedDeck }] = await load()
  const repo = cachedDeckRepo(inner({ d1: deck('d1') }), 'u1')
  await repo.get('d1')
  await vi.waitFor(async () => expect((await readCachedDeck('u1', 'd1'))?.deck.id).toBe('d1'))
  expect(await readCachedDeck('u1', 'd1')).toMatchObject({ rev: 3, role: 'editor' })
  expect(await readCachedDeck('u2', 'd1')).toBeNull()
})

test('a read of a missing deck stores nothing', async () => {
  const [{ cachedDeckRepo, readCachedDeck }] = await load()
  await cachedDeckRepo(inner({}), 'u1').get('nope')
  expect(await readCachedDeck('u1', 'nope')).toBeNull()
})

test('a saved deck is stored, and becomes the one reopened at /', async () => {
  const [{ cachedDeckRepo, readCachedDeck }] = await load()
  const repo = cachedDeckRepo(inner({}), 'u1')
  expect(await readCachedDeck('u1', undefined)).toBeNull()
  expect(await repo.save(deck('d2', 'Saved'))).toBeNull()
  await vi.waitFor(async () => expect((await readCachedDeck('u1', undefined))?.deck.items[0].slide).toMatchObject({ title: 'Saved' }))
  expect((await readCachedDeck('u1', undefined))?.rev).toBe(4)
})

test('a failed save stores nothing', async () => {
  const [{ cachedDeckRepo, readCachedDeck }] = await load()
  const base = inner({}), repo = cachedDeckRepo({ ...base, save: async () => 'offline' }, 'u1')
  expect(await repo.save(deck('d3'))).toBe('offline')
  expect(await readCachedDeck('u1', 'd3')).toBeNull()
})

test('a removed deck leaves the cache, and no longer opens at /', async () => {
  const [{ cachedDeckRepo, readCachedDeck }] = await load()
  const repo = cachedDeckRepo(inner({}), 'u1')
  await repo.save(deck('d4'))
  await vi.waitFor(async () => expect(await readCachedDeck('u1', undefined)).not.toBeNull())
  expect(await repo.remove('d4')).toBe(true)
  await vi.waitFor(async () => expect(await readCachedDeck('u1', undefined)).toBeNull())
  expect(await readCachedDeck('u1', 'd4')).toBeNull()
})

test('a stored entry of the wrong shape reads as no cache', async () => {
  const [{ readCachedDeck }, { cacheSet }] = await load()
  await cacheSet('u1', 'deck:d5', { deck: { id: 'd5' }, rev: 'x' })
  await cacheSet('u1', 'deck:d6', 'junk')
  expect(await readCachedDeck('u1', 'd5')).toBeNull()
  expect(await readCachedDeck('u1', 'd6')).toBeNull()
})

test('a read already on its way is shared, not asked again', async () => {
  const [{ cachedDeckRepo }] = await load()
  const base = inner({ d1: deck('d1') }), get = vi.fn(base.get)
  const repo = cachedDeckRepo({ ...base, get }, 'u1')
  const [x, y] = await Promise.all([repo.get('d1'), repo.get('d1')])
  expect(x).toBe(y)
  expect(get).toHaveBeenCalledTimes(1)
  await repo.get('d1')
  expect(get).toHaveBeenCalledTimes(2)
})

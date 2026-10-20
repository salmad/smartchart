import { afterEach, beforeEach, test, expect, vi } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'

// A fresh database and a fresh module (its connection and fallback map) per test.
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
const load = () => import('@/app/cache')

test('a stored value comes back', async () => {
  const { cacheGet, cacheSet } = await load()
  await cacheSet('u1', 'decks:w1', [{ id: 'a', name: 'Alpha' }])
  expect(await cacheGet('u1', 'decks:w1')).toEqual([{ id: 'a', name: 'Alpha' }])
  expect(await cacheGet('u1', 'decks:w2')).toBeUndefined()
})

test('an account never reads another account’s entries', async () => {
  const { cacheGet, cacheSet } = await load()
  await cacheSet('u1', 'workspaces', ['mine'])
  expect(await cacheGet('u2', 'workspaces')).toBeUndefined()
  expect(await cacheGet('u1x', 'workspaces')).toBeUndefined()
})

test('clearing removes that account’s entries and no one else’s', async () => {
  const { cacheGet, cacheSet, cacheClear } = await load()
  await cacheSet('u1', 'a', 1); await cacheSet('u1', 'b', 2); await cacheSet('u2', 'a', 3)
  await cacheClear('u1')
  expect(await cacheGet('u1', 'a')).toBeUndefined()
  expect(await cacheGet('u1', 'b')).toBeUndefined()
  expect(await cacheGet('u2', 'a')).toBe(3)
})

test('without IndexedDB it still works for the session and never throws', async () => {
  vi.stubGlobal('indexedDB', undefined)
  const { cacheGet, cacheSet, cacheClear } = await load()
  await expect(cacheSet('u1', 'a', 1)).resolves.toBeUndefined()
  expect(await cacheGet('u1', 'a')).toBe(1)
  await cacheClear('u1')
  expect(await cacheGet('u1', 'a')).toBeUndefined()
})

test('a database from another version is discarded', async () => {
  const factory = new IDBFactory()
  vi.stubGlobal('indexedDB', factory)
  await new Promise<void>((done) => {
    const open = factory.open('occam-cache', 99)
    open.onupgradeneeded = () => { open.result.createObjectStore('entries'); open.transaction?.objectStore('entries').put('stale', 'u1:a') }
    open.onsuccess = () => { open.result.close(); done() }
  })
  const { cacheGet, cacheSet } = await load()
  expect(await cacheGet('u1', 'a')).toBeUndefined()
  await cacheSet('u1', 'a', 'fresh')
  expect(await cacheGet('u1', 'a')).toBe('fresh')
})

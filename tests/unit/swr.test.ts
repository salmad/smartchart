import { afterEach, beforeEach, test, expect, vi } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

const rows = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.every((r) => !!r && typeof (r as { id?: unknown }).id === 'string')
const tick = () => new Promise((r) => setTimeout(r, 10))

test('the stored rows come first, then the fresh ones replace them and are stored', async () => {
  const { cacheGet, cacheSet } = await import('@/app/cache')
  const { showThenFetch } = await import('@/app/swr')
  await cacheSet('u1', 'decks:w1', [{ id: 'old' }])
  const seen: string[] = []
  let answer: (v: { id: string }[]) => void = () => {}
  const fetching = new Promise<{ id: string }[]>((r) => { answer = r })
  const done = showThenFetch('u1', 'decks:w1', () => fetching, rows, (v, cached) => seen.push(`${cached ? 'cache' : 'fresh'}:${v.map((r) => r.id)}`))
  await tick()
  expect(seen).toEqual(['cache:old'])
  answer([{ id: 'new' }])
  expect(await done).toBe(true)
  expect(seen).toEqual(['cache:old', 'fresh:new'])
  expect(await cacheGet('u1', 'decks:w1')).toEqual([{ id: 'new' }])
})

test('a failed fetch keeps what was shown and says it failed', async () => {
  const { cacheSet } = await import('@/app/cache')
  const { showThenFetch } = await import('@/app/swr')
  await cacheSet('u1', 'docs:w1', [{ id: 'a' }])
  const seen: string[] = []
  const ok = await showThenFetch('u1', 'docs:w1', () => Promise.reject(new Error('offline')), rows, (v) => seen.push(v.map((r) => r.id).join()))
  expect(ok).toBe(false)
  expect(seen).toEqual(['a'])
})

test('a stored value of the wrong shape is ignored', async () => {
  const { cacheSet } = await import('@/app/cache')
  const { showThenFetch } = await import('@/app/swr')
  await cacheSet('u1', 'workspaces', { not: 'a list' })
  const seen: string[] = []
  await showThenFetch('u1', 'workspaces', async () => [{ id: 'w' }], rows, (v, cached) => seen.push(`${cached}:${v.length}`))
  expect(seen).toEqual(['false:1'])
})

test('the fresh answer is never overwritten by a slow cache read', async () => {
  const cache = await import('@/app/cache')
  vi.spyOn(cache, 'cacheGet').mockImplementation(async () => { await tick(); return [{ id: 'stale' }] })
  const { showThenFetch } = await import('@/app/swr')
  const seen: string[] = []
  await showThenFetch('u1', 'x', async () => [{ id: 'fresh' }], rows, (v, cached) => seen.push(`${cached ? 'cache' : 'fresh'}:${v[0].id}`))
  await tick(); await tick()
  expect(seen).toEqual(['fresh:fresh'])
})

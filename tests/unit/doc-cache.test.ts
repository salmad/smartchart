import { afterEach, beforeEach, test, expect, vi } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import type { Doc, DocComment, DocRepo } from '@/app/docs'

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

const doc = (id: string, text = '# Plan'): Doc => ({ id, name: 'Plan', text, updated: 1, workspaceId: 'w1' })
const note: DocComment = { id: 'c1', anchor: 'doc', text: 'Tighten this', by: 'Ann', at: 1, userId: 'u2' }
/** A repo that answers from memory. */
function inner(docs: Record<string, Doc>, comments: DocComment[] = []): DocRepo {
  return {
    list: async () => [], get: async (id) => docs[id] ?? null, save: async (d) => { docs[d.id] = { ...d, updated: 2 }; return null },
    remove: async (id) => delete docs[id], meta: async () => null, known: () => 1, presence: async () => undefined,
    versions: async () => [], blobs: async () => ({}), comments: async () => comments, comment: async () => comments,
  }
}
const load = async () => (await import('@/app/doc-cache')).cachedDocRepo

test('a doc read is kept in memory and, signed in, in this browser for the next visit', async () => {
  const cachedDocRepo = await load()
  const repo = cachedDocRepo(inner({ a: doc('a') }, [note]), 'u1')
  expect(repo.peek?.('a')).toBeNull()
  await repo.get('a'); await repo.comments('a')
  expect(repo.peek?.('a')).toEqual({ doc: doc('a'), comments: [note] })
  // The next visit: a new repo over the same browser.
  const next = cachedDocRepo(inner({}), 'u1')
  expect(next.peek?.('a')).toBeNull()
  await vi.waitFor(async () => expect((await next.kept?.('a'))?.doc?.text).toBe('# Plan'))
  expect((await next.kept?.('a'))?.comments).toEqual([note])
  expect(next.peek?.('a')?.doc?.id).toBe('a')
  // Another account sees none of it.
  expect(await cachedDocRepo(inner({}), 'u2').kept?.('a')).toBeNull()
})

test('comments read before the doc never replace the stored doc', async () => {
  const cachedDocRepo = await load()
  await cachedDocRepo(inner({ a: doc('a') }), 'u1').get('a')
  const next = cachedDocRepo(inner({ a: doc('a') }, [note]), 'u1')
  await next.comments('a')
  await vi.waitFor(async () => expect((await next.kept?.('a'))?.doc?.id).toBe('a'))
  expect(next.peek?.('a')?.comments).toEqual([note])
})

test('a save is kept; a doc deleted, or gone on the server, is forgotten', async () => {
  const cachedDocRepo = await load()
  const docs = { a: doc('a'), b: doc('b') }, repo = cachedDocRepo(inner(docs), 'u1')
  await repo.save({ ...doc('a', '# Plan v2'), parent: null })
  expect(repo.peek?.('a')?.doc?.text).toBe('# Plan v2')
  await repo.get('b'); await repo.remove('b')
  expect(repo.peek?.('b')).toBeNull()
  delete (docs as Partial<typeof docs>).a
  await repo.get('a')
  expect(repo.peek?.('a')).toBeNull()
  await vi.waitFor(async () => expect(await cachedDocRepo(inner({}), 'u1').kept?.('a')).toBeNull())
})

test('without an account nothing reaches this browser', async () => {
  const cachedDocRepo = await load()
  await cachedDocRepo(inner({ a: doc('a') })).get('a')
  expect(await cachedDocRepo(inner({}), 'u1').kept?.('a')).toBeNull()
})

test('a read already on its way is shared, not asked again', async () => {
  const cachedDocRepo = await load()
  const base = inner({ a: doc('a') }), get = vi.fn(base.get)
  const repo = cachedDocRepo({ ...base, get }, 'u1')
  const [x, y] = await Promise.all([repo.get('a'), repo.get('a')])
  expect(x).toBe(y)
  expect(get).toHaveBeenCalledTimes(1)
  await repo.get('a')
  expect(get).toHaveBeenCalledTimes(2) // once answered, the next read asks again
})

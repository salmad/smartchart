import { test, expect, vi } from 'vitest'
import { findDeck, remoteDeckRepo } from '@/app/remote'
import { localDeckRepo, type SavedDeck } from '@/app/store'

const deck = (id: string, updated: number, title = 'Acme'): SavedDeck => ({
  id, style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated,
  items: [{ id: 's', slide: { template: 'cover', title, subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }],
})

/** /api/decks in memory, as the server answers it; `signedIn` false answers 401 like an ended session. */
function fakeServer() {
  const rows = new Map<string, { id: string; name: string; updated: number; data: SavedDeck }>()
  const state = { signedIn: true, down: false }
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (state.down) throw new TypeError('network')
    if (!state.signedIn) return Response.json({ error: 'Sign in to see your decks.' }, { status: 401 })
    const id = new URL(String(input), 'http://x').searchParams.get('id'), method = init?.method ?? 'GET'
    if (method === 'PUT') {
      const b = JSON.parse(String(init?.body)) as { id: string; name: string; data: SavedDeck }
      rows.set(b.id, { id: b.id, name: b.name, updated: 42, data: b.data })
      return Response.json({ ok: true })
    }
    if (method === 'DELETE') return new Response(null, { status: rows.delete(id ?? '') ? 204 : 404 })
    if (id) { const r = rows.get(id); return r ? Response.json(r) : Response.json({}, { status: 404 }) }
    // The list carries summaries only, as the server's does.
    return Response.json([...rows.values()].map(({ id, name, updated, data }) => ({ id, name, updated, slides: data.items.length, style: data.style, theme: data.theme, accent: data.accent, first: data.items[0]?.slide ?? null })))
  }) as typeof fetch
  return { rows, state, fetcher }
}

const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v } } }

test('the server repo saves, lists, gets and removes a deck, named after its cover', async () => {
  const { rows, fetcher } = fakeServer(), repo = remoteDeckRepo({ fetcher })
  expect(await repo.save(deck('d_1', 5))).toBeNull()
  expect(rows.get('d_1')?.name).toBe('Acme')
  expect(await repo.list()).toEqual([{ id: 'd_1', name: 'Acme', updated: 42, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: { template: 'cover', title: 'Acme', subtitle: 'x' } }])
  expect((await repo.get('d_1'))?.items[0].slide.title).toBe('Acme')
  expect(await repo.get('nope')).toBeNull()
  expect(await repo.remove('d_1')).toBe(true)
  expect(await repo.list()).toEqual([])
})

test('offline, saving and removing resolve false instead of throwing', async () => {
  const { state, fetcher } = fakeServer(), repo = remoteDeckRepo({ fetcher })
  state.down = true
  expect(await repo.save(deck('d_1', 1))).toMatch(/offline/)
  expect(await repo.remove('d_1')).toBe(false)
})

test('a 401 tells the app the session ended', async () => {
  const { state, fetcher } = fakeServer(), onSignedOut = vi.fn(), repo = remoteDeckRepo({ fetcher, onSignedOut })
  state.signedIn = false
  expect(await repo.save(deck('d_1', 1))).toBe('Your session ended.')
  await expect(repo.list()).rejects.toThrow()
  expect(onSignedOut).toHaveBeenCalledTimes(2)
})

test('opening a deck signed in: a browser copy moves to the account unless the account has a newer one', async () => {
  const { rows, fetcher } = fakeServer(), repo = remoteDeckRepo({ fetcher })

  // Only in this browser (a copy kept while saves failed): uploaded, then removed locally.
  const local = localDeckRepo(mem())
  await local.save(deck('d_a', 10))
  expect((await findDeck('d_a', repo, local))?.id).toBe('d_a')
  expect(rows.has('d_a')).toBe(true)
  expect(await local.get('d_a')).toBeNull()

  // A copy kept while saves failed, newer than the account's: it wins and is uploaded.
  await repo.save(deck('d_b', 10, 'Old'))
  await local.save(deck('d_b', 20, 'New'))
  expect((await findDeck('d_b', repo, local))?.items[0].slide.title).toBe('New')
  expect(rows.get('d_b')?.data.items[0].slide.title).toBe('New')
  expect(await local.get('d_b')).toBeNull()

  // An older browser copy: the account's deck opens and the stale copy goes.
  await repo.save(deck('d_c', 30, 'Server'))
  await local.save(deck('d_c', 20, 'Stale'))
  expect((await findDeck('d_c', repo, local))?.items[0].slide.title).toBe('Server')
  expect(await local.get('d_c')).toBeNull()
})

test('the dev account: decks already in this browser open as they are, with no backup to merge', async () => {
  const local = localDeckRepo(mem())
  await local.save(deck('d_v', 1))
  expect((await findDeck('d_v', local, null))?.id).toBe('d_v')
  expect(await local.get('d_v')).not.toBeNull()
})

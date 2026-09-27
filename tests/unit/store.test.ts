import { test, expect } from 'vitest'
import { loadStore, saveStore, deckName, localDeckRepo, KEY, type SavedDeck } from '@/app/store'

const mem = (init: Record<string, string> = {}) => { const m = { ...init }; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v }, m } }

test('reads a deck saved by the prototype (thread as HTML, working as array)', () => {
  const proto = { active: 'd_1', decks: { d_1: { id: 'd_1', style: 'pitch', theme: 'paper', accent: '#2447D1', current: 0, items: [{ id: 's1', slide: { template: 'cover', title: 'Acme', subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: ['s1'], thread: '<div class="msg user"><p>hi</p></div>', updated: 1 } } }
  const s = loadStore(mem({ [KEY]: JSON.stringify(proto) }))
  expect(s.active).toBe('d_1')
  expect(s.decks.d_1.thread).toContain('msg user')
  expect(deckName(s.decks.d_1)).toBe('Acme')
})
test('missing, blocked or corrupt storage gives an empty store', () => {
  expect(loadStore(mem({ [KEY]: '{bad' }))).toEqual({ active: null, decks: {} })
  expect(loadStore({ getItem: () => { throw new Error('blocked') } })).toEqual({ active: null, decks: {} })
})
test('a refused write returns false instead of throwing', () => {
  expect(saveStore({ active: null, decks: {} }, { setItem: () => { throw new Error('quota') } })).toBe(false)
})
test('the local repo saves, lists, gets and removes one deck at a time, and resolves false when the write is refused', async () => {
  const storage = mem(), repo = localDeckRepo(storage)
  const deck: SavedDeck = { id: 'd_1', style: 'consulting', theme: 'ink', accent: null, current: 0, items: [], history: [{ role: 'user', content: 'hi' }], working: [], messages: [], updated: 1 }
  expect(await repo.save(deck)).toBe(true)
  expect(await repo.get('d_1')).toEqual(deck)
  expect(await repo.list()).toEqual([deck])
  expect(loadStore(storage).active).toBe('d_1')
  expect(await repo.remove('d_1')).toBe(true)
  expect(await repo.get('d_1')).toBeNull()
  const full = localDeckRepo({ getItem: () => null, setItem: () => { throw new Error('quota') } })
  expect(await full.save(deck)).toBe(false)
})

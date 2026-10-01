import { test, expect } from 'vitest'
import { editKey, initialState, reducer, toSaved } from '@/app/state'
import { loadStore, saveStore, deckName, localDeckRepo, summaryOf, KEY, type SavedDeck } from '@/app/store'

const mem = (init: Record<string, string> = {}) => { const m = { ...init }; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v }, m } }

test('a deck saved by the prototype still opens, and its old chat is dropped on the next save', () => {
  const proto = { active: 'd_1', decks: { d_1: { id: 'd_1', style: 'pitch', theme: 'paper', accent: '#2447D1', current: 0, items: [{ id: 's1', slide: { template: 'cover', title: 'Acme', subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: ['s1'], thread: '<div class="msg user"><p>hi</p></div>', updated: 1 } } }
  const s = loadStore(mem({ [KEY]: JSON.stringify(proto) }))
  expect(s.active).toBe('d_1')
  expect(deckName(s.decks.d_1)).toBe('Acme')
  expect(toSaved(reducer(initialState(), { type: 'open', deck: s.decks.d_1 }))).not.toHaveProperty('thread')
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
  expect(await repo.save(deck)).toBeNull()
  expect(await repo.get('d_1')).toEqual(deck)
  expect(await repo.list()).toEqual([summaryOf(deck)])
  expect(loadStore(storage).active).toBe('d_1')
  expect(await repo.remove('d_1')).toBe(true)
  expect(await repo.get('d_1')).toBeNull()
  const full = localDeckRepo({ getItem: () => null, setItem: () => { throw new Error('quota') } })
  expect(await full.save(deck)).toMatch(/storage is full/)
})
test('a name the maker gave wins over the cover title; a blank one does not', () => {
  const items: SavedDeck['items'] = [{ id: 's', slide: { template: 'cover', title: 'Acme', subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }]
  expect(deckName({ name: 'Board pack', items })).toBe('Board pack')
  expect(deckName({ name: '  ', items })).toBe('Acme')
  expect(deckName({ name: null, items })).toBe('Acme')
})
test('renaming is an edit: it saves and survives open', () => {
  const opened = reducer(initialState(), { type: 'open', deck: { id: 'd_1', style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], updated: 1, name: 'Board pack',
    items: [{ id: 's', slide: { template: 'cover', title: 'Acme', subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }] } })
  expect(opened.name).toBe('Board pack')
  const before = toSaved(opened), after = toSaved(reducer(opened, { type: 'set', patch: { name: 'Q3 plan' } }))
  expect(after?.name).toBe('Q3 plan')
  expect(before && after && editKey(before) !== editKey(after)).toBe(true)
  expect(reducer(opened, { type: 'new' }).name).toBeNull()
})
test('the deck name reads as the title does on the slide, even with a sign inside a highlight', () => {
  const named = (title: string) => deckName({ items: [{ id: 's', slide: { template: 'chart', title } as SavedDeck['items'][number]['slide'], status: 'ok', errors: [], warnings: [], checks: [] }] })
  expect(named('ARR grew [[+£7.7m+]] to £17.5m')).toBe('ARR grew +£7.7m+ to £17.5m')
  expect(named('Churn cost [-£1.4m-] while [+pricing+] added [[£0.8m]]')).toBe('Churn cost £1.4m while pricing added £0.8m')
  expect(named('[[ ]]')).toBe('Untitled deck')
})

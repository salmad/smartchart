import { test, expect } from 'vitest'
import { reducer, initialState, toSaved, editKey, type AppState } from '@/app/state'
import type { SavedDeck } from '@/app/store'
import type { Slide } from '@/engine/types'

const cover: Slide = { template: 'cover', title: 'Acme', subtitle: 'A test.' }
test('opening a deck with no slides shows the landing', () => {
  const s = reducer(initialState(), { type: 'open', deck: { id: 'd', style: 'consulting', theme: 'ink', accent: null, current: 0, items: [], history: [], working: [], updated: 1 } })
  expect(s.view).toBe('landing') // no slides: the landing shows
})
test('pickStarter creates one deck with one slide, once', () => {
  let s = reducer(initialState(), { type: 'pickStarter', slide: cover, id: 's_a' })
  s = reducer(s, { type: 'pickStarter', slide: cover, id: 's_b' })
  expect(s.items).toHaveLength(1)
  expect(s.view).toBe('editor')
})
test('insertStarter goes after the current slide', () => {
  let s = reducer(initialState(), { type: 'pickStarter', slide: cover, id: 's1' })
  s = reducer(s, { type: 'insertStarter', slide: { ...cover, title: 'B' }, id: 's2' })
  s = reducer(s, { type: 'select', index: 0 })
  s = reducer(s, { type: 'insertStarter', slide: { ...cover, title: 'C' }, id: 's3' })
  expect(s.items.map((i) => i.slide.title)).toEqual(['Acme', 'C', 'B'])
  expect(s.current).toBe(1)
})
test('busy blocks picking and inserting', () => {
  const s = reducer({ ...initialState(), busy: true }, { type: 'pickStarter', slide: cover, id: 's1' })
  expect(s.items).toHaveLength(0)
})
test('an empty deck is not saved', () => { expect(toSaved(initialState())).toBeNull() })

test('a prototype deck opens, and its old thread is not written back', () => {
  const proto = { id: 'd', style: 'consulting' as const, theme: 'ink' as const, accent: null, current: 0, items: [{ id: 's1', slide: cover, status: 'ok' as const, errors: [], warnings: [], checks: [] }], history: [], working: [], thread: '<p>x</p>', updated: 1 } as SavedDeck
  const first = reducer(initialState(), { type: 'open', deck: proto })
  const saved = toSaved(first)
  if (!saved) throw new Error('not saved')
  const again = reducer(initialState(), { type: 'open', deck: saved })
  expect(again.items).toHaveLength(1)
  expect(toSaved(again)).not.toHaveProperty('thread')
})
test('a pick keeps the open deck id (a deck with chat but no slides is not forked)', () => {
  const s = reducer({ ...initialState(), deckId: 'd_keep' }, { type: 'pickStarter', slide: cover, id: 's_a' })
  expect(s.deckId).toBe('d_keep')
})

const deckOf3 = () => {
  let s = reducer(initialState(), { type: 'pickStarter', slide: cover, id: 'a' })
  s = reducer(s, { type: 'insertStarter', slide: { ...cover, title: 'B' }, id: 'b' })
  return reducer(s, { type: 'insertStarter', slide: { ...cover, title: 'C' }, id: 'c' })
}
test('deleting a slide selects its neighbour, and Undo puts it back where it was', () => {
  let s = reducer(deckOf3(), { type: 'select', index: 1 })
  s = reducer(s, { type: 'removeSlide', id: 'b' })
  expect(s.items.map((i) => i.id)).toEqual(['a', 'c'])
  expect(s.items[s.current].id).toBe('c')
  s = reducer(s, { type: 'restoreSlide' })
  expect(s.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  expect(s.current).toBe(1)
  expect(s.removed).toBeNull()
})
test('deleting the last slide while it is selected selects the one before', () => {
  let s = reducer(deckOf3(), { type: 'removeSlide', id: 'c' })
  expect(s.items[s.current].id).toBe('b')
  s = reducer(reducer(deckOf3(), { type: 'select', index: 0 }), { type: 'removeSlide', id: 'c' })
  expect(s.items[s.current].id).toBe('a')
})
test('moving a slide keeps the same slide selected', () => {
  let s = reducer(deckOf3(), { type: 'select', index: 0 })
  s = reducer(s, { type: 'moveSlide', id: 'a', to: 2 })
  expect(s.items.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  expect(s.items[s.current].id).toBe('a')
})
test('a running turn blocks deleting and moving', () => {
  const s = { ...deckOf3(), busy: true }
  expect(reducer(s, { type: 'removeSlide', id: 'a' })).toBe(s)
  expect(reducer(s, { type: 'moveSlide', id: 'a', to: 2 })).toBe(s)
})

test('an edit is a change to the slides, the look or the chat; selecting a slide or re-run checks is not', () => {
  const s = deckOf3(), saved = toSaved(s)
  if (!saved) throw new Error('not saved')
  const key = editKey(saved)
  const same = (patch: Partial<AppState>) => editKey(toSaved({ ...s, ...patch }) as SavedDeck) === key
  expect(same({ current: 2 })).toBe(true)
  expect(same({ items: s.items.map((it) => ({ ...it, checks: [], warnings: ['re-run'] })) })).toBe(true)
  expect(same({ theme: 'paper' })).toBe(false)
  expect(same({ items: s.items.map((it, i) => (i ? it : { ...it, slide: { ...it.slide, title: 'New' } })) })).toBe(false)
  expect(same({ items: s.items.slice().reverse() })).toBe(false)
  expect(same({ messages: [{ kind: 'user', text: 'hi' }] })).toBe(false)
})

import { test, expect } from 'vitest'
import { reducer, initialState, toSaved } from '@/app/state'
import type { Slide } from '@/engine/types'

const cover: Slide = { template: 'cover', title: 'Acme', subtitle: 'A test.' }
test('opening a prototype deck keeps its legacy thread', () => {
  const s = reducer(initialState(), { type: 'open', deck: { id: 'd', style: 'consulting', theme: 'ink', accent: null, current: 0, items: [], history: [], working: [], thread: '<p>x</p>', updated: 1 } })
  expect(s.legacyThread).toBe('<p>x</p>')
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

test('a prototype chat survives a v1 save and a reopen (Review Focus 1)', () => {
  const proto = { id: 'd', style: 'consulting' as const, theme: 'ink' as const, accent: null, current: 0, items: [{ id: 's1', slide: cover, status: 'ok' as const, errors: [], warnings: [], checks: [] }], history: [], working: [], thread: '<p>x</p>', updated: 1 }
  const first = reducer(initialState(), { type: 'open', deck: proto })
  const saved = toSaved(first)
  if (!saved) throw new Error('not saved')
  const again = reducer(initialState(), { type: 'open', deck: saved })
  expect(again.legacyThread).toBe('<p>x</p>')
  expect(toSaved(again)?.thread).toBe('<p>x</p>')
})
test('a pick keeps the open deck id (a deck with chat but no slides is not forked)', () => {
  const s = reducer({ ...initialState(), deckId: 'd_keep' }, { type: 'pickStarter', slide: cover, id: 's_a' })
  expect(s.deckId).toBe('d_keep')
})

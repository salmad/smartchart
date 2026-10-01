import { test, expect } from 'vitest'
import { saveEdit } from '@/app/edit/save'
import { initialState, reducer, type Action, type AppState } from '@/app/state'
import type { Measurer } from '@/app/measure'
import type { Slide } from '@/engine/types'

function harness(measure: Measurer['measure'] = () => []) {
  const item = (id: string, title: string) => ({ id, slide: { template: 'section' as const, title }, status: 'ok' as const, errors: [], warnings: [], checks: [] })
  let state: AppState = { ...initialState(), deckId: 'd', view: 'editor', items: [item('a', 'Before'), item('b', 'Other')], editing: 'a' }
  const measurer: Measurer = { measure, lines: 1, warnings: [], located: [] }
  const deps = { measurer, getState: () => state, dispatch: (a: Action) => { state = reducer(state, a) }, judge: async () => ({ checks: [], ms: 0 }) }
  return { deps, get: () => state }
}

test('saving writes the draft word for word, leaves edit mode and tells the next turn', async () => {
  const h = harness(), long = 'A section title that is far longer than any section title should ever be'
  expect(await saveEdit('a', { template: 'section', title: long }, h.deps)).toBeNull()
  expect(h.get().items[0].slide.title).toBe(long)
  expect(h.get().items[0].status).toBe('draft')
  expect(h.get().editing).toBeNull()
  expect(h.get().edited).toEqual(['a'])
})

test('a draft that cannot render is not saved and edit mode stays', async () => {
  const h = harness(() => { throw new Error('no chart') })
  const reason = await saveEdit('a', { template: 'section', title: 'X' } as Slide, h.deps)
  expect(reason).toMatch(/could not be rendered/)
  expect(h.get().items[0].slide.title).toBe('Before')
  expect(h.get().editing).toBe('a')
})

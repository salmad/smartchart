import { test, expect, vi } from 'vitest'
import { syncLiveDeck } from '@/app/live'
import type { DeckRepo, SavedDeck } from '@/app/store'
import { initialState, reducer } from '@/app/state'

const saved = (id: string): SavedDeck => ({
  id, style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1,
  items: [{ id: 's', slide: { template: 'cover', title: 'T', subtitle: '' }, status: 'ok', errors: [], warnings: [], checks: [] }],
})

test('forced sync skips the full deck when the server revision is unchanged', async () => {
  const get = vi.fn(async () => saved('d1'))
  const rev = vi.fn(async () => ({ rev: 2, presence: {} }))
  const repo: DeckRepo = { list: async () => [], get, save: async () => null, remove: async () => true, rev, known: () => 2, base: () => saved('d1') }
  let state = reducer(initialState(), { type: 'open', deck: saved('d1') })
  const app = { getState: () => state, dispatch: (a: Parameters<typeof reducer>[1]) => { state = reducer(state, a) } }
  const merged = vi.fn()
  await syncLiveDeck(app, repo, merged, true)
  expect(rev).toHaveBeenCalledTimes(1)
  expect(get).not.toHaveBeenCalled()
  expect(merged).not.toHaveBeenCalled()
})

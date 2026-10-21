import { test, expect } from 'vitest'
import { recheckRules } from '@/app/turn'
import { recheckInIdle } from '@/app/recheck'
import { initialState, reducer as reduce, type Action, type AppState } from '@/app/state'
import type { Item } from '@/app/store'

const item = (id: string, title: string, checks: Item['checks'] = []): Item => ({ id, slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks })
// A measurer that notes which slides it measured; every slide has the same single line.
const measurer = () => { const seen: number[] = []; return { seen, measure: (_s: unknown, _d: unknown, i: number) => { seen.push(i); return [] }, lines: 1, warnings: [] as string[], located: [] } }
const store = (items: Item[], current = 0, patch: Partial<AppState> = {}) => {
  let state: AppState = { ...initialState(), deckId: 'd1', items, current, ...patch }
  return { getState: () => state, dispatch: (a: Action) => { state = reduce(state, a) } }
}
/** Idle callbacks run by hand, one at a time. */
const idler = () => { const queue: (() => void)[] = []; return { queue, idle: (fn: () => void) => { queue.push(fn) }, run: () => queue.shift()?.() } }

test('opening measures only the slide asked for; the others keep what was stored', () => {
  const m = measurer(), stored = [{ id: 'S1', ok: false, msg: 'stored' }]
  const s = { ...initialState(), items: [item('a', 'A', stored), item('b', 'B', stored), item('c', 'C', stored)] }
  const out = recheckRules(s, m as never, new Set([1]))
  expect(m.seen).toEqual([1])
  expect(out[0].checks).toEqual(stored)
  expect(out[2]).toBe(s.items[2])
})

test('the rest are rechecked later, a few per idle turn, and the open slide is not measured again', () => {
  const app = store([item('a', 'A'), item('b', 'B'), item('c', 'C'), item('d', 'D'), item('e', 'E')], 1)
  const m = measurer(), q = idler()
  recheckInIdle({ app, measurer: () => m as never, deckId: 'd1', skip: 'b', idle: q.idle, batch: 2 })
  expect(m.seen).toEqual([])
  q.run(); expect(m.seen).toEqual([0, 2])
  q.run(); expect(m.seen).toEqual([0, 2, 3, 4])
  expect(q.queue).toHaveLength(0)
})

test('opening another deck stops the old deck’s recheck', () => {
  const app = store([item('a', 'A'), item('b', 'B'), item('c', 'C')], 0)
  const m = measurer(), q = idler()
  recheckInIdle({ app, measurer: () => m as never, deckId: 'd1', skip: 'a', idle: q.idle, batch: 1 })
  q.run(); expect(m.seen).toHaveLength(1)
  app.dispatch({ type: 'set', patch: { deckId: 'd2' } })
  q.run(); expect(m.seen).toHaveLength(1)
  expect(q.queue).toHaveLength(0)
})

test('a slide edited or removed meanwhile is not overwritten, and a busy deck waits for its own recheck', () => {
  const app = store([item('a', 'A'), item('b', 'B'), item('c', 'C')], 0)
  const m = measurer(), q = idler()
  recheckInIdle({ app, measurer: () => m as never, deckId: 'd1', skip: 'a', idle: q.idle, batch: 5 })
  // b is deleted and c's title is edited before the idle turn comes.
  app.dispatch({ type: 'items', items: [item('a', 'A'), { ...item('c', 'C edited') }] })
  q.run()
  const now = app.getState().items
  expect(now.map((i) => i.id)).toEqual(['a', 'c'])
  expect((now[1].slide as { title: string }).title).toBe('C edited')
  expect(m.seen).toEqual([1])
  // A turn running: nothing is measured, nothing is rescheduled.
  const busy = store([item('a', 'A'), item('b', 'B')], 0, { busy: true }), mb = measurer(), qb = idler()
  recheckInIdle({ app: busy, measurer: () => mb as never, deckId: 'd1', skip: 'a', idle: qb.idle, batch: 5 })
  qb.run()
  expect(mb.seen).toEqual([])
  expect(qb.queue).toHaveLength(0)
})

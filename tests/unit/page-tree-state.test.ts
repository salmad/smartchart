import { describe, expect, it } from 'vitest'
import { CYCLE, type PageSummary } from '@/engine/pages/tree'
import type { PageRepo } from '@/app/pages'
import { createPageTree } from '@/app/components/sidebar/pageTree'

const page = (id: string, over: Partial<PageSummary> = {}): PageSummary =>
  ({ kind: 'doc', id, name: id, updated: 1, slides: null, parent: null, sortKey: null, ...over })
const start = () => [page('a', { sortKey: 'a' }), page('b', { sortKey: 'b' }), page('c', { sortKey: 'c', parent: { kind: 'doc', id: 'a' } })]
const doc = (id: string) => ({ kind: 'doc' as const, id })

/** A repo that answers when told to, so a test can read the list in the middle of a move. */
function stub(pages: PageSummary[]) {
  const gates: { resolve: (why: string | null) => void }[] = []
  const lists: (() => void)[] = []
  const calls = { list: 0, move: 0 }
  let held = false
  const repo: PageRepo = {
    list: () => { calls.list++; const snap = structuredClone(pages); return held ? new Promise((r) => lists.push(() => r(snap))) : Promise.resolve(snap) },
    move: () => { calls.move++; return new Promise((resolve) => gates.push({ resolve })) },
    subpages: async () => 0,
  }
  return { repo, calls, gates, lists, hold: () => { held = true }, set: (p: PageSummary[]) => { pages = p } }
}
const place = (t: ReturnType<typeof createPageTree>, id: string) => {
  const p = t.getState().pages?.find((x) => x.id === id)
  return { parent: p?.parent?.id ?? null, sortKey: p?.sortKey }
}

describe('page tree state', () => {
  it('loads the list and says when it fails', async () => {
    const s = stub(start()), t = createPageTree(s.repo, 'w')
    expect(t.getState().pages).toBeNull()
    await t.load()
    expect(t.getState().pages).toHaveLength(3)
    const bad = createPageTree({ ...s.repo, list: () => Promise.reject(new Error('down')) }, 'w')
    await bad.load()
    expect(bad.getState()).toMatchObject({ pages: null, failed: true })
  })

  it('moves the page in the list before the repo answers', async () => {
    const s = stub(start()), t = createPageTree(s.repo, 'w')
    await t.load()
    const done = t.move(doc('b'), { parent: doc('a') })
    expect(place(t, 'b').parent).toBe('a')
    expect(s.calls.move).toBe(1)
    s.gates[0].resolve(null)
    expect(await done).toBeNull()
    expect(t.getState().notice).toBeNull()
  })

  it('puts the page back and keeps the sentence when the repo refuses', async () => {
    const s = stub(start()), t = createPageTree(s.repo, 'w')
    await t.load()
    const before = place(t, 'b')
    const done = t.move(doc('b'), { parent: doc('a') })
    s.gates[0].resolve('You can view this workspace, not change it.')
    expect(await done).toBe('You can view this workspace, not change it.')
    expect(place(t, 'b')).toEqual(before)
    expect(t.getState().notice).toBe('You can view this workspace, not change it.')
    t.dismiss()
    expect(t.getState().notice).toBeNull()
  })

  it('refuses a cycle without asking the repo or changing the list', async () => {
    const s = stub(start()), t = createPageTree(s.repo, 'w')
    await t.load()
    expect(await t.move(doc('a'), { parent: doc('c') })).toBe(CYCLE)
    expect(s.calls.move).toBe(0)
    expect(place(t, 'a').parent).toBeNull()
    expect(t.getState().notice).toBe(CYCLE)
  })

  it('refuses before the first load', async () => {
    const t = createPageTree(stub([]).repo, 'w')
    expect(await t.move(doc('a'), { parent: null })).toBe('No such page.')
  })

  it('ignores a list that was read before a move, and reads again when the move ends', async () => {
    const s = stub(start()), t = createPageTree(s.repo, 'w')
    await t.load()
    s.hold()
    const slow = t.load() // reads the old order
    const done = t.move(doc('b'), { parent: doc('a') })
    s.lists[0]() // the old list arrives in the middle of the move
    await slow
    expect(place(t, 'b').parent).toBe('a')
    s.set(start().map((p) => (p.id === 'b' ? { ...p, parent: doc('a'), sortKey: 'x' } : p)))
    s.gates[0].resolve(null)
    await done
    s.lists[1]() // the read after the move
    await Promise.resolve(); await Promise.resolve()
    expect(place(t, 'b')).toEqual({ parent: 'a', sortKey: 'x' })
  })

  it('tells listeners about each change, and stops after unsubscribe', async () => {
    const s = stub(start()), t = createPageTree(s.repo, 'w')
    let n = 0
    const off = t.subscribe(() => { n++ })
    await t.load()
    expect(n).toBe(1)
    off()
    t.dismiss()
    await t.load()
    expect(n).toBe(1)
  })
})

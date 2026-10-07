import { describe, expect, it } from 'vitest'
import { decksHandler } from '../../api/_lib/decks'
import { remoteDeckRepo } from '@/app/remote'
import { localDeckRepo, LOCAL_KEEP, type SavedDeck } from '@/app/store'
import { itemsOf, undoTarget } from '@/app/versions'
import type { Version } from '@/engine/versions'
import { fakeDb } from './fake-db'

const deck = (titles: string[], updated = 1): SavedDeck => ({
  id: 'd_1', style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated,
  items: titles.map((title, i) => ({ id: `s${i}`, slide: { template: 'cover', title, subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] })),
})
const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v } } }

describe('the server repo and versions', () => {
  // The real decks API over a fake database, as the app's fetch.
  const repoOn = () => {
    const db = fakeDb(), h = decksHandler({ userFrom: async () => ({ id: 'u', email: 'u@x', via: 'session' }), db: () => db })
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => h(new Request(new URL(String(input), 'http://x'), init))) as typeof fetch
    return remoteDeckRepo({ fetcher })
  }
  it('a save says who wrote it; versions and their slides come back', async () => {
    const repo = repoOn()
    await repo.save(deck(['Before']))
    await repo.save(deck(['After', 'New']), { by: 'agent', turn: 't1', label: 'Rewrite it' })
    const list = await repo.versions?.('d_1') ?? []
    expect(list.map((v) => [v.by, v.label])).toEqual([['Occam', 'Rewrite it'], ['You', null]])
    const items = await itemsOf(repo, 'd_1', list[1].tree)
    expect(items?.map((it) => it.slide.title)).toEqual(['Before'])
  })
})

describe('the dev account keeps versions in this browser', () => {
  it('by the server’s rule: hand edits group, a turn stands alone, unchanged saves are skipped', async () => {
    const repo = localDeckRepo(mem(), { versions: true })
    await repo.save(deck(['A']))
    await repo.save(deck(['AB']))
    await repo.save(deck(['AB'], 5))
    await repo.save(deck(['ABC']), { by: 'agent', turn: 't1', label: 'Add C' })
    const list = await repo.versions?.('d_1') ?? []
    expect(list.map((v) => [v.n, v.by, v.label])).toEqual([[2, 'Occam', 'Add C'], [1, 'You', null]])
    expect((await itemsOf(repo, 'd_1', list[1].tree))?.[0].slide.title).toBe('AB')
  })
  it('keeps LOCAL_KEEP versions and drops their unused slides; removing the deck drops them all', async () => {
    const storage = mem(), repo = localDeckRepo(storage, { versions: true })
    for (let i = 0; i < LOCAL_KEEP + 3; i++) await repo.save(deck([`T${i}`]), { by: 'agent', turn: `t${i}` })
    const list = await repo.versions?.('d_1') ?? []
    expect(list).toHaveLength(LOCAL_KEEP)
    expect(await repo.blobs?.('d_1', ['nope'])).toEqual([])
    await repo.remove('d_1')
    expect(await repo.versions?.('d_1')).toEqual([])
  })
  it('a backup copy (no versions option) keeps none', () => expect(localDeckRepo(mem()).versions).toBeUndefined())
})

describe('Undo on an agent turn', () => {
  const v = (n: number, turn: string | null, slides: number): Version =>
    ({ n, rev: n, by: turn ? 'Occam' : 'You', turn, label: turn && `ask ${turn}`, at: n, tree: { style: 'consulting', theme: 'ink', accent: null, slides: Array.from({ length: slides }, (_, i): [string, string] => [`s${i}`, `h${n}${i}`]) } })
  const list = [v(4, null, 3), v(3, 't2', 3), v(2, 't1', 2), v(1, null, 1)]
  it('goes back to the version before the turn, and counts what came after', () => {
    expect(undoTarget(list, 't2')).toMatchObject({ before: list[2].tree, later: 1, label: 'ask t2' })
    expect(undoTarget(list, 't1')).toMatchObject({ before: list[3].tree, later: 2 })
  })
  it('a turn that made the deck goes back to no slides; an unknown turn gives null', () => {
    expect(undoTarget([v(1, 't0', 2)], 't0')).toMatchObject({ before: null, later: 0 })
    expect(undoTarget(list, 'nope')).toBeNull()
  })
})

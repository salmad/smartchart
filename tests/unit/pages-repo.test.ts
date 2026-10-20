import { describe, expect, it } from 'vitest'
import { localPageRepo, remotePageRepo } from '@/app/pages'
import { localDeckRepo, type SavedDeck } from '@/app/store'
import { localDocRepo, remoteDocRepo } from '@/app/docs'
import { remoteDeckRepo } from '@/app/remote'
import type { PageRef } from '@/engine/pages/tree'

const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v }, m } }
const deck = (id: string, parent?: PageRef): SavedDeck => ({ id, style: 'consulting', theme: 'ink', accent: null, current: 0, items: [], history: [], working: [], messages: [], updated: 1, ...(parent ? { parent } : {}) })
const doc = (id: string, ws: string, parent?: PageRef) => ({ id, name: id, text: `# ${id}`, workspaceId: ws, ...(parent ? { parent } : {}) })
const D = (id: string): PageRef => ({ kind: 'deck', id }), P = (id: string): PageRef => ({ kind: 'doc', id })

describe('the local page tree (dev account)', () => {
  it('nests decks and docs, lists them with parents and keys, and a later save never moves a page', async () => {
    const storage = mem(), decks = localDeckRepo(storage), docs = localDocRepo(storage), pages = localPageRepo(storage)
    expect(await docs.save(doc('memo', 'w1'))).toBeNull()
    expect(await decks.save(deck('board', P('memo')))).toBeNull()
    expect(await docs.save(doc('appendix', 'w1', D('board')))).toBeNull()
    expect(await docs.save(doc('other', 'w1'))).toBeNull()
    const list = await pages.list('w1')
    const at = (id: string) => list.find((p) => p.id === id)
    expect(at('board')).toMatchObject({ kind: 'deck', parent: P('memo'), slides: 0 })
    expect(at('appendix')).toMatchObject({ kind: 'doc', parent: D('board') })
    expect((at('memo')?.sortKey ?? '') < (at('other')?.sortKey ?? '')).toBe(true) // added last
    expect(await docs.save({ ...doc('appendix', 'w1', P('memo')), text: '# changed' })).toBeNull()
    expect((await pages.list('w1')).find((p) => p.id === 'appendix')?.parent).toEqual(D('board'))
    expect((await decks.list())[0]).toMatchObject({ id: 'board', parent: P('memo') })
    expect((await docs.list('w1')).find((d) => d.id === 'appendix')).toMatchObject({ parent: D('board') })
  })

  it('refuses a new page under a missing parent or past six levels, with the shared sentences', async () => {
    const storage = mem(), docs = localDocRepo(storage)
    expect(await docs.save(doc('x', 'w1', P('nope')))).toBe('No such page.')
    let parent: PageRef | undefined
    for (let i = 1; i <= 6; i++) { expect(await docs.save(doc(`l${i}`, 'w1', parent))).toBeNull(); parent = P(`l${i}`) }
    expect(await docs.save(doc('l7', 'w1', parent))).toBe('Pages nest 6 levels deep at most.')
  })

  it('moves, counts, refuses a cycle, and deleting a page deletes its branch with its versions', async () => {
    const storage = mem(), decks = localDeckRepo(storage, { versions: true }), docs = localDocRepo(storage), pages = localPageRepo(storage)
    await docs.save(doc('a', 'w1')); await docs.save(doc('b', 'w1')); await decks.save(deck('d', P('a'))); await docs.save(doc('c', 'w1', D('d')))
    expect(await pages.subpages(P('a'))).toBe(2)
    expect(await pages.move(P('a'), { parent: P('c') })).toBe('A page can’t go inside itself or its subpages.')
    expect(await pages.move(D('d'), { parent: P('b') })).toBeNull()
    expect(await pages.subpages(P('a'))).toBe(0)
    expect(await pages.subpages(P('b'))).toBe(2)
    expect(await pages.move(P('c'), { parent: P('b'), before: D('d') })).toBeNull()
    const kids = (await pages.list('w1')).filter((p) => p.parent?.id === 'b').sort((x, y) => ((x.sortKey ?? '') < (y.sortKey ?? '') ? -1 : 1)).map((p) => p.id)
    expect(kids).toEqual(['c', 'd'])
    expect(await pages.move(P('c'), { parent: P('b'), after: P('a') })).toBe('No such page.') // a neighbour that isn't a child of b
    expect(await docs.remove('b')).toBe(true)
    expect((await pages.list('w1')).map((p) => p.id)).toEqual(['a'])
    expect(await decks.get('d')).toBeNull()
    expect(await docs.remove('b')).toBe(false)
  })
})

/** A stub of the page routes: records each call and answers from a table. */
function stub(answers: Record<string, { status?: number; body?: unknown }>) {
  const calls: { url: string; method: string; body: unknown }[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), key = Object.keys(answers).find((k) => url.includes(k))
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const a = key ? answers[key] : { status: 404 }
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status ?? 200 })
  }) as typeof fetch
  return { fetcher, calls }
}

describe('the remote page repo', () => {
  it('lists the workspace’s pages, dropping what it can’t read and naming what has no name', async () => {
    const { fetcher, calls } = stub({ '/api/pages': { body: [
      { kind: 'doc', id: 'a', name: 'Memo', updated: 5, slides: null, parent: null, sortKey: '001V' },
      { kind: 'deck', id: 'b', name: '', updated: 6, slides: 3, parent: { kind: 'doc', id: 'a' }, sortKey: null },
      { kind: 'sheet', id: 'c' }, { id: 'd' },
    ] } })
    expect(await remotePageRepo({ fetcher }).list('w 1')).toEqual([
      { kind: 'doc', id: 'a', name: 'Memo', updated: 5, slides: null, parent: null, sortKey: '001V' },
      { kind: 'deck', id: 'b', name: 'Untitled deck', updated: 6, slides: 3, parent: { kind: 'doc', id: 'a' }, sortKey: null },
    ])
    expect(calls[0].url).toBe('/api/pages?workspace=w%201')
  })

  it('throws when the list fails, and tells the session ending', async () => {
    let ended = 0
    const { fetcher } = stub({ '/api/pages': { status: 401 } })
    await expect(remotePageRepo({ fetcher, onSignedOut: () => { ended++ } }).list('w')).rejects.toThrow('pages: 401')
    expect(ended).toBe(1)
  })

  it('moves by PUT to the page’s own route and answers null, the server’s sentence, or a sentence for the status', async () => {
    const { fetcher, calls } = stub({
      'api/docs?id=ok': {}, 'api/decks?id=cycle': { status: 409, body: { error: 'A page can’t go inside itself or its subpages.' } },
      'api/docs?id=viewer': { status: 403, body: { error: 'You can view this workspace, not change it.' } }, 'api/docs?id=gone': { status: 404, body: { error: 'No such doc.' } },
    })
    const repo = remotePageRepo({ fetcher })
    expect(await repo.move(P('ok'), { parent: D('x'), after: D('y') })).toBeNull()
    expect(calls[0]).toEqual({ url: '/api/docs?id=ok&move', method: 'PUT', body: { parent: D('x'), after: D('y') } })
    expect(await repo.move(D('cycle'), { parent: null })).toBe('A page can’t go inside itself or its subpages.')
    expect(calls[1].url).toBe('/api/decks?id=cycle&move')
    expect(await repo.move(P('viewer'), { parent: null })).toBe('You can view this workspace, not change it.')
    expect(await repo.move(P('gone'), { parent: null })).toBe('That page is gone.')
    expect(await remotePageRepo({ fetcher: (async () => { throw new TypeError('offline') }) as typeof fetch }).move(P('x'), { parent: null })).toMatch(/offline|reached/i)
  })

  it('counts subpages from the right route and throws when it can’t know', async () => {
    const { fetcher, calls } = stub({ 'api/decks?id=d1': { body: { count: 4 } }, 'api/docs?id=d2': { status: 404 } })
    const repo = remotePageRepo({ fetcher })
    expect(await repo.subpages(D('d1'))).toBe(4)
    expect(calls[0].url).toBe('/api/decks?id=d1&subpages')
    await expect(repo.subpages(P('d2'))).rejects.toThrow('subpages: 404')
  })
})

describe('first saves carry the parent to the server, and only then', () => {
  it('a deck and a doc send `parent` in the save body; a deck keeps it out of its stored data', async () => {
    const bodies: { url: string; body: Record<string, unknown> }[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') bodies.push({ url: String(input), body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify({ ok: true, rev: 1 }), { status: 200 })
    }) as typeof fetch
    expect(await remoteDeckRepo({ fetcher, workspace: () => 'w1' }).save({ ...deck('d1', P('memo')), sortKey: '001V' })).toBeNull()
    expect(await remoteDocRepo({ fetcher }).save(doc('doc1', 'w1', D('d1')))).toBeNull()
    expect(await remoteDocRepo({ fetcher }).save(doc('doc2', 'w1'))).toBeNull()
    expect(bodies[0].body.parent).toEqual(P('memo'))
    expect(JSON.stringify(bodies[0].body.data)).not.toMatch(/parent|sortKey/)
    expect(bodies[1].body.parent).toEqual(D('d1'))
    expect(bodies[2].body).not.toHaveProperty('parent')
  })
})


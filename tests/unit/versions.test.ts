import { describe, expect, it } from 'vitest'
import type { User } from '../../api/_lib/auth'
import { decksHandler } from '../../api/_lib/decks'
import { runTool } from '../../api/_lib/deck-service'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { describeDiff, diffTrees, GROUP_MS, KEEP, nextStep, slidesOf, treeOf, type Version } from '../../src/engine/versions'
import type { Slide } from '../../src/engine/types'
import { fakeDb } from './fake-db'
import { fakeJev } from './fakes'

const card = starterSlide(STARTERS.find((s) => s.consulting.template === 'cards') ?? STARTERS[0], 'consulting')
const titled = (title: string): Slide => ({ ...card, title } as Slide)
const deck = (...slides: [string, Slide][]) => ({ style: 'consulting', theme: 'ink', accent: null, items: slides.map(([id, slide]) => ({ id, slide, checks: [] })) })

describe('trees and blobs', () => {
  it('an unchanged slide keeps its hash; the key changes only with what a version shows', () => {
    const a = treeOf(deck(['s1', card], ['s2', titled('Two')]))
    const b = treeOf({ ...deck(['s1', card], ['s2', titled('Two!')]), current: 3, updated: 99 })
    expect(a.tree.slides[0]).toEqual(b.tree.slides[0])
    expect(a.tree.slides[1][1]).not.toBe(b.tree.slides[1][1])
    expect(treeOf({ ...deck(['s1', card]), updated: 1 }).key).toBe(treeOf({ ...deck(['s1', card]), updated: 2, current: 0 }).key)
  })
  it('a tree and its blobs give the slides back in order', () => {
    const { tree, blobs } = treeOf(deck(['s1', card], ['s2', titled('Two')]))
    expect(slidesOf(tree, blobs)?.map((s) => [s.id, s.slide.title])).toEqual([['s1', card.title], ['s2', 'Two']])
    expect(slidesOf(tree, new Map())).toBeNull()
  })
  it('diffs by id and hash, in words', () => {
    const a = treeOf(deck(['s1', card], ['s2', titled('Two')], ['s3', titled('Three')])).tree
    const b = treeOf(deck(['s1', titled('One')], ['s3', titled('Three')], ['s4', titled('Four')])).tree
    expect(diffTrees(a, b)).toEqual({ added: ['s4'], removed: ['s2'], changed: ['s1'], moved: false, look: false })
    expect(describeDiff(diffTrees(a, b))).toBe('Added 1 slide, changed 1, removed 1')
    const swapped = treeOf(deck(['s2', titled('Two')], ['s1', card], ['s3', titled('Three')])).tree
    expect(describeDiff(diffTrees(a, swapped))).toBe('Reordered slides')
    expect(describeDiff(diffTrees(null, a))).toBe('Added 3 slides')
  })
})

describe('when a save becomes a version', () => {
  const head = { n: 4, by: 'You', turn: null, at: 1000, key: 'k1' }
  it('nothing shown changed: skip', () => expect(nextStep(head, { by: 'You', turn: null, label: null }, 'k1', 2000)).toBe('skip'))
  it('same writer, same turn, soon after: fold in', () => expect(nextStep(head, { by: 'You', turn: null, label: null }, 'k2', 2000)).toBe('replace'))
  it('another writer, another turn, or later: a new version', () => {
    expect(nextStep(head, { by: 'SmartChart', turn: 't1', label: 'x' }, 'k2', 2000)).toBe('add')
    expect(nextStep(head, { by: 'You', turn: 'restore:1', label: null }, 'k2', 2000)).toBe('add')
    expect(nextStep(head, { by: 'You', turn: null, label: null }, 'k2', 1000 + GROUP_MS)).toBe('add')
    expect(nextStep(null, { by: 'You', turn: null, label: null }, 'k2', 0)).toBe('add')
  })
})

const ann: User = { id: 'u_ann', email: 'ann@example.com', via: 'session' }, bob: User = { id: 'u_bob', email: 'bob@example.com', via: 'session' }
const call = (h: ReturnType<typeof decksHandler>, method: string, query = '', body?: unknown) =>
  h(new Request(`http://x/api/decks${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }))

describe('versions through the decks API', () => {
  it('each turn and each run of hand edits is a version; slides are stored once', async () => {
    const db = fakeDb(), h = decksHandler({ userFrom: async () => ann, db: () => db })
    let rev = 0
    const save = async (data: unknown, version?: unknown) => {
      const r = await call(h, 'PUT', '', { id: 'd_1', name: 'D', data, chat: {}, baseRev: rev, version })
      rev = ((await r.json()) as { rev: number }).rev
    }
    await save(deck(['s1', card]), { by: 'agent', turn: 't1', label: 'Make a slide on churn' })
    await save(deck(['s1', titled('Churn halves')]))
    await save(deck(['s1', titled('Churn halves by Q3')]))
    await save({ ...deck(['s1', titled('Churn halves by Q3')]), current: 0 })
    const list = (await (await call(h, 'GET', '?id=d_1&versions')).json()) as Version[]
    expect(list.map((v) => [v.n, v.by, v.label])).toEqual([[2, 'You', null], [1, 'SmartChart', 'Make a slide on churn']])
    expect(db.blobStore.size).toBe(3)
    const hash = list[1].tree.slides[0][1]
    const blobs = (await (await call(h, 'GET', `?id=d_1&blobs=${hash}`)).json()) as { slide: Slide }[]
    expect(blobs[0].slide.title).toBe(card.title)
    // Another account sees neither the list nor the slides.
    const hb = decksHandler({ userFrom: async () => bob, db: () => db })
    expect(await (await call(hb, 'GET', '?id=d_1&versions')).json()).toEqual([])
    expect(await (await call(hb, 'GET', `?id=d_1&blobs=${hash}`)).json()).toEqual([])
  })
  it('keeps the newest KEEP versions', async () => {
    const db = fakeDb(), h = decksHandler({ userFrom: async () => ann, db: () => db })
    for (let i = 0; i < KEEP + 5; i++)
      await call(h, 'PUT', '', { id: 'd_1', name: 'D', data: deck(['s1', titled(`T${i}`)]), chat: {}, baseRev: i, version: { by: 'agent', turn: `t${i}` } })
    const list = (await (await call(h, 'GET', '?id=d_1&versions')).json()) as Version[]
    expect(list).toHaveLength(KEEP)
    expect(list[0].n).toBe(KEEP + 5)
  })
})

describe('versions from MCP writes', () => {
  it('an agent’s writes for one request group into one version, labelled with the request', async () => {
    const db = fakeDb(), d = { db, origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000 }
    const caller = { user: { id: 'u1', email: 'u1@x.y' }, client: 'Claude Code', key: 'k' }
    const made = await runTool('create_deck', { style: 'consulting' }, caller, d)
    const deckId = made.ok ? String(made.result.deckId) : ''
    await runTool('create_slide', { deckId, slide: card, request: 'Two slides on churn' }, caller, d)
    await runTool('create_slide', { deckId, slide: titled('Second'), request: 'Two slides on churn' }, caller, d)
    await runTool('create_slide', { deckId, slide: titled('Third'), request: 'One more' }, caller, d)
    const list = await db.listVersions('u1', deckId)
    expect(list.map((v) => [v.by, v.label, v.tree.slides.length])).toEqual([['Claude Code', 'One more', 3], ['Claude Code', 'Two slides on churn', 2], ['Claude Code', null, 0]])
  })
})

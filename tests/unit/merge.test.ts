import { describe, expect, it } from 'vitest'
import { mergeDecks, type SavedDeck } from '../../src/app/store'

const item = (id: string, title: string) => ({ id, slide: { template: 'section' as const, title }, status: 'ok' as const, errors: [], warnings: [], checks: [] })
const deck = (items: ReturnType<typeof item>[], history: { role: 'user'; content: string }[] = []): SavedDeck =>
  ({ id: 'd', style: 'consulting', theme: 'ink', accent: null, current: 0, items, history, working: [], messages: [], updated: 1 })

describe('mergeDecks', () => {
  const base = deck([item('a', 'A'), item('b', 'B')])
  it('takes server changes, keeps local changes and the local chat', () => {
    const local = deck([item('a', 'A mine'), item('b', 'B')], [{ role: 'user', content: 'hi' }])
    const server = deck([item('a', 'A'), item('b', 'B by Claude'), item('c', 'C new')])
    const m = mergeDecks(local, server, base)
    expect(m.deck.items.map((i) => [i.id, i.slide.title])).toEqual([['a', 'A mine'], ['b', 'B by Claude'], ['c', 'C new']])
    expect(m.deck.history).toEqual([{ role: 'user', content: 'hi' }])
    expect(m.changed).toEqual(['b', 'c'])
  })
  it('a slide deleted on the server goes unless it was edited here', () => {
    expect(mergeDecks(deck([item('a', 'A'), item('b', 'B')]), deck([item('a', 'A')]), base).deck.items.map((i) => i.id)).toEqual(['a'])
    expect(mergeDecks(deck([item('a', 'A'), item('b', 'B mine')]), deck([item('a', 'A')]), base).deck.items.map((i) => i.id)).toEqual(['a', 'b'])
  })
  it('a slide added here stays after its neighbour', () => {
    const local = deck([item('a', 'A'), item('x', 'X'), item('b', 'B')])
    expect(mergeDecks(local, deck([item('b', 'B'), item('a', 'A')]), base).deck.items.map((i) => i.id)).toEqual(['b', 'a', 'x'])
  })
  it('the look changed here is kept, an untouched one follows the server', () => {
    const m = mergeDecks({ ...base, theme: 'paper' }, { ...base, theme: 'ink', accent: '#3366ff' }, base)
    expect(m.deck).toMatchObject({ theme: 'paper', accent: '#3366ff' })
  })
})

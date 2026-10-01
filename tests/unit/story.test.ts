import { describe, expect, it } from 'vitest'
import { storyChecks, storyKey, storyline } from '@/engine/agent/story'
import type { Slide } from '@/engine/types'
import { fakeJev } from './fakes'

const s = (id: string, template: string, title: string, subtitle?: string) => ({ id, slide: { template, title, ...(subtitle ? { subtitle } : {}) } as Slide })
const deck = [s('c', 'cover', 'Northwind'), s('a', 'cards', 'Rotterdam costs us the top customers'), s('b', 'table', 'Only option C keeps them'), s('d', 'cards', 'Approve option C now')]

describe('storyline', () => {
  it('is the titles in order, the cover and sections as headings; pitch adds the claim', () => {
    expect(storyline(deck, 'consulting').map((l) => [l.page, l.kind, l.title])).toEqual([[1, 'cover', 'Northwind'], [2, 'content', 'Rotterdam costs us the top customers'], [3, 'content', 'Only option C keeps them'], [4, 'content', 'Approve option C now']])
    expect(storyline([s('x', 'cards', 'Traction', '[[3.3×]] the customers')], 'pitch')[0].claim).toBe('3.3× the customers')
  })
  it('changes key only when a title, template or order changes', () => {
    expect(storyKey(deck, 'consulting')).toBe(storyKey(structuredClone(deck), 'consulting'))
    expect(storyKey([deck[0], deck[2], deck[1], deck[3]], 'consulting')).not.toBe(storyKey(deck, 'consulting'))
  })
})

describe('deck checks', () => {
  it('asks nothing of a deck with fewer than two content slides', async () => {
    const jev = fakeJev()
    expect(await storyChecks(deck.slice(0, 2), 'consulting', jev)).toEqual({ checks: [], ms: 0 })
    expect(jev.calls).toHaveLength(0)
  })
  it('passes a deck that answers first, argues, repeats nothing and ends on what to do', async () => {
    const jev = fakeJev({ D1: ['a', 0.9], D2: ['argument', 0.9], D3: ['none', 0.95], D4: ['none', 0.95], D5: ['ends', 0.9] })
    const { checks } = await storyChecks(deck, 'consulting', jev)
    expect(checks.map((c) => [c.id, c.ok])).toEqual([['D1', true], ['D2', true], ['D3', true], ['D4', true], ['D5', true]])
    expect(jev.calls[0].state).toContain('2. a [cards] Rotterdam costs us the top customers')
  })
  it('moves the answer first when a later slide states it, after the cover', async () => {
    const { checks } = await storyChecks(deck, 'consulting', fakeJev({ D1: ['d', 0.85] }))
    expect(checks[0]).toMatchObject({ id: 'D1', ok: false, slideId: 'd', msg: 'The answer is on slide 4, not first', fix: { kind: 'move', id: 'd', to: 1, label: 'Move slide 4 first' } })
  })
  it('names the repeating slide and asks the agent, never deletes', async () => {
    const { checks } = await storyChecks(deck, 'consulting', fakeJev({ D3: ['b', 0.8] }))
    const d3 = checks.find((c) => c.id === 'D3')
    expect(d3).toMatchObject({ ok: false, slideId: 'b', msg: 'Slide 3 repeats an earlier point', fix: { kind: 'ask' } })
    expect(d3?.fix?.kind === 'ask' && d3.fix.prompt).toContain('tell me which one to drop')
  })
  it('does not fail on a doubt below 0.7', async () => {
    const { checks } = await storyChecks(deck, 'consulting', fakeJev({ D2: ['jumps', 0.6] }))
    expect(checks.find((c) => c.id === 'D2')?.ok).toBe(true)
  })
  it('in pitch: no answer-first check, the claims are read, and the deck must end on the ask', async () => {
    const pitch = [s('a', 'cards', 'Traction', '3.3× the customers'), s('b', 'chart', 'The raise', '£8m to £10m ARR')]
    const jev = fakeJev({ D5: ['open', 0.9] })
    const { checks } = await storyChecks(pitch, 'pitch', jev)
    expect(checks.map((c) => c.id)).toEqual(['D2', 'D3', 'D4', 'D5'])
    expect(checks.at(-1)).toMatchObject({ ok: false, msg: 'The deck ends without the ask' })
    expect(jev.calls[0].state).toContain('Traction — 3.3× the customers')
    expect((await storyChecks(pitch, 'pitch', fakeJev())).checks.at(-1)?.msg).toBe('The deck ends on the ask')
  })
})

it('a slide without a title takes its line in the storyline from its number caption or its quote', () => {
  const lines = storyline([
    { id: 'n', slide: { template: 'number', number: { value: '£1.4bn', caption: 'of SME spend goes on [[personal cards]].' } } as Slide },
    { id: 'q', slide: { template: 'quote', quote: 'No bank would give us a **real** limit.', who: 'Founder' } as Slide },
  ], 'consulting')
  expect(lines.map((l) => l.title)).toEqual(['of SME spend goes on personal cards.', 'No bank would give us a real limit.'])
})

import { describe, expect, it } from 'vitest'
import { runTool } from '../../api/_lib/deck-service'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { fakeDb } from './fake-db'
import { fakeJev } from './fakes'

const caller = { user: { id: 'u1', email: 'u1@x.y' }, client: 'Claude Code', key: 'k' }
const deps = () => ({ db: fakeDb(), origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000 })
const content = STARTERS.filter((s) => !['cover', 'section'].includes(s.consulting.template))
const bars = STARTERS.find((s) => s.consulting.template === 'chart' && (s.consulting as { chart?: { series?: unknown[] } }).chart?.series?.length === 2)

async function deck(d: ReturnType<typeof deps>) {
  const made = await runTool('create_deck', { style: 'consulting' }, caller, d)
  return made.ok ? String(made.result.deckId) : ''
}

describe('checks reach the agent unasked', () => {
  it('every write says what to do next; the second content slide points at check_storyline', async () => {
    const d = deps(), deckId = await deck(d)
    const one = await runTool('create_slide', { deckId, slide: starterSlide(content[0], 'consulting') }, caller, d)
    expect(one.ok && String(one.result.next)).toMatch(/check_slide judges it/)
    expect(one.ok && String(one.result.next)).not.toMatch(/check_storyline/)
    const two = await runTool('create_slide', { deckId, slide: starterSlide(content[1], 'consulting') }, caller, d)
    expect(two.ok && String(two.result.next)).toMatch(/2 content slides: check_storyline/)
  })
  it('a chart choice code takes back is said, not done silently', async () => {
    if (!bars) throw new Error('no two-series chart starter')
    const d = deps(), deckId = await deck(d), slide = starterSlide(bars, 'consulting') as { chart: { stacking?: string } }
    slide.chart.stacking = 'stacked'
    const r = await runTool('create_slide', { deckId, slide, request: 'Revenue and costs by year' }, caller, d)
    expect(r.ok && (r.result.warnings as string[]).some((w) => /chart\.stacking: you wrote "stacked"/.test(w))).toBe(true)
    // Asked for by the user: kept, nothing to say.
    const kept = await runTool('create_slide', { deckId, slide, request: 'Stacked bars of revenue and costs' }, caller, d)
    expect(kept.ok && ((kept.result.warnings as string[] | undefined) ?? []).some((w) => /chart\.stacking: you wrote/.test(w))).toBe(false)
  })
})

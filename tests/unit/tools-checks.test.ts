import { describe, expect, it } from 'vitest'
import { checkTools } from '../../src/engine/tools/checks'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { fakeJev } from './fakes'
import { ctxFor, emptyDeck } from './tool-ctx'
import { must } from './must'

const t = (n: string) => must(checkTools.find((x) => x.name === n), n)
const slides = STARTERS.filter((s) => !['cover', 'section'].includes(s.consulting.template)).slice(0, 3).map((s, i) => ({ id: `s_${i}`, slide: starterSlide(s, 'consulting'), issues: [], warnings: [], checks: [] }))

describe('check tools', () => {
  it('check_slide returns rule and judgment checks', async () => {
    const r = (await t('check_slide').run(ctxFor({ deck: emptyDeck({ slides }), jev: fakeJev() }), { deckId: 'd_1', slideId: 's_1' })).result as { checks: { id: string }[] }
    expect(r.checks.some((c) => c.id.startsWith('R'))).toBe(true)
    expect(r.checks.some((c) => c.id.startsWith('J'))).toBe(true)
  })
  it('check_storyline returns D checks only', async () => {
    const r = (await t('check_storyline').run(ctxFor({ deck: emptyDeck({ slides }), jev: fakeJev() }), { deckId: 'd_1' })).result as { checks: { id: string }[] }
    expect(r.checks.every((c) => /^D\d$/.test(c.id))).toBe(true)
    expect(r).not.toHaveProperty('storyline')
  })
})

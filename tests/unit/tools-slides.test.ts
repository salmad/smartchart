import { describe, expect, it } from 'vitest'
import { slideTools } from '../../src/engine/tools/slides'
import { choiceTools } from '../../src/engine/tools/choice'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { fakeJev } from './fakes'
import { ctxFor, emptyDeck } from './tool-ctx'
import { must } from './must'
import type { DeckDoc } from '../../src/engine/tools/types'

const t = (name: string) => must([...slideTools, ...choiceTools].find((x) => x.name === name), name)
const chart = STARTERS.find((s) => s.consulting.template === 'chart')
const cards = STARTERS.find((s) => s.consulting.template === 'cards')
const chartSlide = starterSlide(must(chart, "chart starter"), 'consulting'), cardSlide = starterSlide(must(cards, "cards starter"), 'consulting')
const withSlides = (): DeckDoc => emptyDeck({ slides: [{ id: 's_a', slide: chartSlide, issues: [], warnings: [], checks: [] }, { id: 's_b', slide: cardSlide, issues: [], warnings: [], checks: [] }] })

describe('slide tools', () => {
  it('create_slide inserts after a slide and returns the write result with its position', async () => {
    const out = await t('create_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slide: cardSlide, after: 's_a', request: 'three pillars' })
    expect(out.result).toMatchObject({ applied: true, n: 2, fit: 'estimated' })
    expect(out.deck?.slides.map((s) => s.id)[0]).toBe('s_a')
    expect(out.events?.[0]).toMatchObject({ what: 'created' })
  })
  it('create_slide accepts slide sent as a JSON string', async () => {
    const out = await t('create_slide').run(ctxFor({ deck: emptyDeck() }), { deckId: 'd_1', slide: JSON.stringify(cardSlide) })
    expect(out.result).toMatchObject({ applied: true, n: 1 })
  })
  it('create_slide accepts a cover without the request asking for one', async () => {
    const cover = { template: 'cover', title: 'Acme', subtitle: 'A revolving credit card for UK small businesses.' }
    const out = await t('create_slide').run(ctxFor({ deck: emptyDeck() }), { deckId: 'd_1', slide: cover, request: 'revenue by year' })
    expect(out.result).toMatchObject({ applied: true, n: 1 })
  })
  it('create_slide restores a deleted slide under its own id, refuses a taken one', async () => {
    const out = await t('create_slide').run(ctxFor({ deck: emptyDeck() }), { deckId: 'd_1', slide: cardSlide, slideId: 's_old' })
    expect(out.result).toMatchObject({ slideId: 's_old' })
    await expect(t('create_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slide: cardSlide, slideId: 's_a' })).rejects.toMatchObject({ code: 'bad_input' })
  })
  it('update_slide patches one path and reports changed', async () => {
    const out = await t('update_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slideId: 's_b', set: { 'cards[0].title': 'Faster onboarding' } })
    expect(out.result).toMatchObject({ applied: true, changed: ['cards[0].title'] })
  })
  it('update_slide with a bad path writes nothing and names the problem', async () => {
    await expect(t('update_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slideId: 's_b', set: { 'cardz[0].title': 'x' } })).rejects.toMatchObject({ code: 'bad_input' })
  })
  it('read_slide returns content and what lists can grow or shrink', async () => {
    const r = (await t('read_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slideId: 's_b' })).result as { lists: { path: string }[]; capabilities?: string[] }
    expect(r.lists.some((l) => l.path === 'cards')).toBe(true)
    expect(r.capabilities).toEqual(expect.arrayContaining(['Icon cards', 'Framed contrast']))
    const v = (await t('read_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slideId: 's_b', path: 'cards[0].title' })).result
    expect(v).toMatchObject({ path: 'cards[0].title', value: cardSlide.cards?.[0].title })
  })
  it('move and delete', async () => {
    const moved = await t('move_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slideId: 's_b', after: 'start' })
    expect(moved.deck?.slides.map((s) => s.id)).toEqual(['s_b', 's_a'])
    const del = await t('delete_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slideId: 's_a' })
    expect(del.result).toMatchObject({ deleted: { slideId: 's_a' } })
    expect(del.deck?.slides.map((s) => s.id)).toEqual(['s_b'])
  })
  it('unknown slide ids name the valid ones', async () => {
    await expect(t('read_slide').run(ctxFor({ deck: withSlides() }), { deckId: 'd_1', slideId: 's_zz' })).rejects.toThrow(/s_a, s_b/)
  })
  it('suggest_template asks Jev and returns probabilities', async () => {
    const jev = fakeJev({ template: ['table', 0.7], lead: ['icon', 0.4] })
    const r = (await t('suggest_template').run(ctxFor({ jev }), { deckId: 'd_1', about: 'exact prices by plan' })).result
    expect(r).toMatchObject({ template: 'table', after: 'end', decided: {} })
  })
})

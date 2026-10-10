import { describe, expect, it } from 'vitest'
import { contexts, slideHTML } from '../../src/engine/slides/render'
import { parse, serialize } from '../../src/engine/slides/markup'
import { plain, validate } from '../../src/engine/slides/schema'
import { slideTools } from '../../src/engine/tools/slides'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { ctxFor, emptyDeck } from './tool-ctx'
import { must } from './must'
import type { Slide } from '../../src/engine/types'

const cards = starterSlide(must(STARTERS.find((s) => s.consulting.template === 'cards'), 'cards starter'), 'consulting')
const cover: Slide = { template: 'cover', title: 'Trip', subtitle: 'Five days.' } as Slide
const linked = { ...cards, footnote: 'Times are in [the day plan](#s_plan).' } as Slide

describe('links to a slide', () => {
  it('a link to a slide draws its words and that slide’s page now, set as an attribute so hand editing reads no extra text', () => {
    const ctx = contexts({ footer: 'Trip', slides: [cover, linked, cards], ids: ['s_cov', 's_here', 's_plan'] })
    const html = slideHTML(linked, ctx[1], { style: 'consulting', theme: 'paper' })
    expect(html).toContain('<a href="#s_plan" data-slide="s_plan">the day <span class="nw">plan<span class="ref" data-ref="s_plan" data-page="03"></span></span></a>')
    // Moved: the page follows the slide.
    const moved = contexts({ footer: 'Trip', slides: [cover, cards, linked], ids: ['s_cov', 's_plan', 's_here'] })
    expect(slideHTML(linked, moved[2], { style: 'consulting', theme: 'paper' })).toContain('data-page="02"')
  })
  it('a slide no longer in the deck leaves the words alone, with no page', () => {
    const ctx = contexts({ footer: 'Trip', slides: [cover, linked], ids: ['s_cov', 's_here'] })
    expect(slideHTML(linked, ctx[1], { style: 'consulting', theme: 'ink' })).not.toContain('data-page')
  })
  it('validates as a link (label counts, address does not), and survives hand editing', () => {
    expect(validate(linked).errors).toEqual([])
    expect(plain('See [the day plan](#s_plan).')).toBe('See the day plan.')
    expect(serialize(parse('See [the day plan](#s_plan).'))).toBe('See [the day plan](#s_plan).')
  })
  it('a write that links a slide not in the deck is told so', async () => {
    const tool = must(slideTools.find((x) => x.name === 'create_slide'), 'create_slide')
    const deck = emptyDeck({ slides: [{ id: 's_plan', slide: cards, issues: [], warnings: [], checks: [] }] })
    const ok = await tool.run(ctxFor({ deck }), { deckId: 'd_1', slide: linked })
    expect(JSON.stringify(ok.result)).not.toContain('no slide s_plan')
    const gone = await tool.run(ctxFor({ deck: emptyDeck() }), { deckId: 'd_1', slide: linked })
    expect(JSON.stringify(gone.result)).toContain('[the day plan](#s_plan): no slide s_plan in this deck')
  })
})

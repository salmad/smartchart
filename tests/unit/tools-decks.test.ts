import { describe, expect, it } from 'vitest'
import { deckTools } from '../../src/engine/tools/decks'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { ctxFor, emptyDeck, fakePort } from './tool-ctx'
import { must } from './must'

const t = (name: string) => must(deckTools.find((x) => x.name === name), name)
const slide = starterSlide(STARTERS[0], 'consulting')

describe('deck tools', () => {
  it('create_deck mints an id and returns the empty storyline', async () => {
    const out = await t('create_deck').run(ctxFor({ deck: null, rev: 0 }), { style: 'pitch', name: 'Seed round' })
    expect(out.deck).toMatchObject({ id: 'd_new1', name: 'Seed round', style: 'pitch', slides: [] })
    expect(out.named).toBe(true)
    expect(out.result).toMatchObject({ deckId: 'd_new1', slides: [] })
  })
  it('get_deck is the storyline with links', async () => {
    const deck = emptyDeck({ slides: [{ id: 's_a', slide, issues: ['x'], warnings: [], checks: [] }] })
    const r = (await t('get_deck').run(ctxFor({ deck, rev: 4 }), { deckId: 'd_1' })).result
    expect(r).toMatchObject({ deckId: 'd_1', rev: 4, links: { edit: 'https://x/d/d_1' }, slides: [{ slideId: 's_a', n: 1, issues: 1 }] })
  })
  it('update_deck refuses a style change once there are slides, and a grey accent', async () => {
    const deck = emptyDeck({ slides: [{ id: 's_a', slide, issues: [], warnings: [], checks: [] }] })
    await expect(t('update_deck').run(ctxFor({ deck }), { deckId: 'd_1', style: 'pitch' })).rejects.toMatchObject({ code: 'refused' })
    await expect(t('update_deck').run(ctxFor({ deck }), { deckId: 'd_1', accent: '#808080' })).rejects.toMatchObject({ code: 'bad_input' })
    const ok = await t('update_deck').run(ctxFor({ deck }), { deckId: 'd_1', theme: 'paper', name: 'Q3' })
    expect(ok.deck).toMatchObject({ theme: 'paper', name: 'Q3' })
    expect(ok.events).toEqual([{ slideId: null, what: 'deck', paths: ['theme', 'name'] }])
  })
  it('share_deck goes through the port', async () => {
    const r = (await t('share_deck').run(ctxFor({ port: fakePort({ share: async (_id, on) => (on ? 'https://x/s/t' : null) }) }), { deckId: 'd_1', on: true })).result
    expect(r).toEqual({ share: 'https://x/s/t' })
  })
})

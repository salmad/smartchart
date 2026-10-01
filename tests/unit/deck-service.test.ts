import { describe, expect, it } from 'vitest'
import { runTool } from '../../api/_lib/deck-service'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { fakeJev } from './fakes'
import { fakeDb } from './fake-db'

const caller = (id = 'u1') => ({ user: { id, email: `${id}@x.y` }, client: 'Claude Code', key: `k_${id}` })
const deps = (db = fakeDb()) => ({ db, origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000 })
const card = starterSlide(STARTERS.find((s) => s.consulting.template === 'cards') ?? STARTERS[0], 'consulting')

describe('deck service', () => {
  it('create_deck, create_slide, get_deck round trip with events', async () => {
    const d = deps()
    const made = await runTool('create_deck', { style: 'consulting', name: 'Board' }, caller(), d)
    if (!made.ok) throw new Error(made.error.message)
    const deckId = String(made.result.deckId)
    const slide = await runTool('create_slide', { deckId, slide: card }, caller(), d)
    expect(slide).toMatchObject({ ok: true, result: { applied: true, n: 1 } })
    const got = await runTool('get_deck', { deckId }, caller(), d)
    expect(got).toMatchObject({ ok: true, result: { name: 'Board', links: { edit: `https://app.test/d/${deckId}` }, slides: [{ n: 1 }] } })
    expect((await d.db.eventsSince('u1', deckId, 0)).map((e) => e.what)).toEqual(['deck', 'created'])
  })
  it('another user’s deck is not_found and untouched', async () => {
    const d = deps()
    const made = await runTool('create_deck', { style: 'consulting' }, caller('u1'), d)
    const deckId = made.ok ? String(made.result.deckId) : ''
    expect(await runTool('get_deck', { deckId }, caller('u2'), d)).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(await runTool('create_slide', { deckId, slide: card }, caller('u2'), d)).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })
  it('bad input is named before anything runs', async () => {
    expect(await runTool('get_deck', { deckID: 'x' }, caller(), deps())).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringMatching(/deckId: required/) } })
    expect(await runTool('nope', {}, caller(), deps())).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringMatching(/Unknown tool/) } })
  })
  it('two racing writes both land (conflict → reload → rerun)', async () => {
    const d = deps()
    const made = await runTool('create_deck', { style: 'consulting' }, caller(), d)
    const deckId = made.ok ? String(made.result.deckId) : ''
    const [a, b] = await Promise.all([runTool('create_slide', { deckId, slide: card }, caller(), d), runTool('create_slide', { deckId, slide: card }, caller(), d)])
    expect(a.ok && b.ok).toBe(true)
    const got = await runTool('get_deck', { deckId }, caller(), d)
    expect(got.ok && (got.result.slides as unknown[]).length).toBe(2)
  })
  it('rate limit per key per minute', async () => {
    const d = deps()
    for (let i = 0; i < 60; i++) await runTool('whoami', {}, caller(), d)
    expect(await runTool('whoami', {}, caller(), d)).toMatchObject({ ok: false, error: { code: 'rate' } })
  })
})

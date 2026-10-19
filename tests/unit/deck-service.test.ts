import { describe, expect, it } from 'vitest'
import { runTool } from '../../api/_lib/deck-service'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { fakeJev, seedUser } from './fakes'
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

describe('deck service across workspaces', () => {
  const ann = { id: 'u_ann', email: 'ann@x.y', name: 'Ann' }, bob = { id: 'u_bob', email: 'bob@x.y', name: 'Bob' }
  const as = (u: typeof ann) => ({ user: u, client: 'Claude Code', key: `k_${u.id}` })
  /** Ann owns her personal workspace and Acme; Bob views Acme. */
  async function setup() {
    const d = deps(), mine = await seedUser(d.db, ann), acme = await d.db.createWorkspace(ann.id, 'Acme')
    await seedUser(d.db, bob)
    await d.db.addInvite(ann.id, acme, bob.email, 'viewer', 't_bob', 2e12)
    await d.db.acceptInvite(bob, 't_bob', 1)
    return { d, mine, acme }
  }

  it('list_workspaces: most recently used first, with the role', async () => {
    const { d, mine, acme } = await setup()
    await d.db.touchWorkspace(ann.id, mine)
    await d.db.touchWorkspace(ann.id, acme)
    expect(await runTool('list_workspaces', {}, as(ann), d)).toEqual({ ok: true, result: { workspaces: [
      { workspaceId: acme, name: 'Acme', role: 'owner' }, { workspaceId: mine, name: 'Ann’s workspace', role: 'owner' }] } })
  })

  it('create_deck lands in the most recently used workspace, or the one named; list_decks follows', async () => {
    const { d, mine, acme } = await setup()
    await d.db.touchWorkspace(ann.id, acme)
    const a = await runTool('create_deck', { style: 'pitch', name: 'In Acme' }, as(ann), d)
    const b = await runTool('create_deck', { style: 'pitch', name: 'Mine', workspaceId: mine }, as(ann), d)
    if (!a.ok || !b.ok) throw new Error('create failed')
    expect(d.db.rows.get(String(a.result.deckId))?.ws).toBe(acme)
    expect(d.db.rows.get(String(b.result.deckId))?.ws).toBe(mine)
    expect(await runTool('list_decks', {}, as(ann), d)).toMatchObject({ ok: true, result: { workspaceId: acme, decks: [{ name: 'In Acme' }] } })
    expect(await runTool('list_decks', { workspaceId: mine }, as(ann), d)).toMatchObject({ ok: true, result: { workspaceId: mine, decks: [{ name: 'Mine' }] } })
  })

  it('a viewer is refused, with what to do instead; a stranger hears not_found', async () => {
    const { d, acme } = await setup()
    expect(await runTool('create_deck', { style: 'pitch', workspaceId: acme }, as(bob), d)).toEqual({ ok: false, error: {
      code: 'refused', message: 'You can view this workspace, not add to it.', fix: 'Pick a workspace where you are an editor (list_workspaces).' } })
    const made = await runTool('create_deck', { style: 'consulting', workspaceId: acme }, as(ann), d)
    const deckId = made.ok ? String(made.result.deckId) : ''
    expect(await runTool('get_deck', { deckId }, as(bob), d)).toMatchObject({ ok: true })
    expect(await runTool('create_slide', { deckId, slide: card }, as(bob), d)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this deck, not edit it.' } })
    expect(await runTool('share_deck', { deckId, on: true }, as(bob), d)).toMatchObject({ ok: false, error: { code: 'refused' } })
    const cy = { id: 'u_cy', email: 'cy@x.y', name: 'Cy' }
    expect(await runTool('create_slide', { deckId, slide: card }, as(cy), d)).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(await runTool('create_deck', { style: 'pitch', workspaceId: acme }, as(cy), d)).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(await runTool('list_decks', { workspaceId: acme }, as(cy), d)).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })
})

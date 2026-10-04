import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { runTool } from '../../api/_lib/deck-service'
import { DAILY_IMAGES, type StoreFn } from '../../api/_lib/images'
import { fakeJev } from './fakes'
import { fakeDb } from './fake-db'

const caller = { user: { id: 'u1', email: 'u1@x.y' }, client: 'Claude Code', key: 'k_u1' }
const logoPng = () => sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="100%" height="100%" fill="#fff"/><rect x="100" y="100" width="600" height="100" fill="#123"/></svg>')).png().toBuffer()
function setup(over: { store?: StoreFn | null; fetch?: typeof fetch } = {}) {
  const stored: string[] = [], db = fakeDb()
  const store: StoreFn = async (name) => { stored.push(name); return `https://store1.public.blob.vercel-storage.com/${name}` }
  return { stored, db, deps: { db, origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000, store, ...over } }
}

describe('add_image', () => {
  it('stores a prepared logo under its kind and size, and the src goes straight onto a slide', async () => {
    const { stored, deps } = setup()
    const r = await runTool('add_image', { data: (await logoPng()).toString('base64'), kind: 'logo' }, caller, deps)
    if (!r.ok) throw new Error(r.error.message)
    expect(stored).toEqual([expect.stringMatching(/^img\/[0-9a-f]{16}-logo-600x100\.png$/)])
    expect(r.result).toMatchObject({ kind: 'logo', width: 600, height: 100, image: { src: expect.stringContaining('-logo-600x100.png') } })
    const src = (r.result.image as { src: string }).src
    const deck = await runTool('create_deck', { style: 'consulting' }, caller, deps)
    const deckId = deck.ok ? String(deck.result.deckId) : ''
    const slide = { template: 'logos', title: 'Acme launches inside the tools UK small businesses already use', logos: [1, 2, 3].map((i) => ({ logo: { src: src.replace(/[0-9a-f]{16}/, String(i).padStart(16, '0')) }, name: `Partner ${i}` })) }
    expect(await runTool('create_slide', { deckId, slide }, caller, deps)).toMatchObject({ ok: true, result: { applied: true } })
  })
  it('fetches a url (an IP literal skips DNS) and passes the alt text back with the src', async () => {
    const bytes = await logoPng()
    const { deps } = setup({ fetch: (async () => new Response(bytes)) as unknown as typeof fetch })
    const r = await runTool('add_image', { url: 'https://93.184.216.34/logo.png', kind: 'logo', alt: 'Northwind' }, caller, deps)
    expect(r).toMatchObject({ ok: true, result: { image: { alt: 'Northwind' } } })
  })
  it('names what is wrong and what to pass instead', async () => {
    const { deps } = setup()
    expect(await runTool('add_image', { kind: 'logo' }, caller, deps)).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringMatching(/exactly one of url or data/) } })
    expect(await runTool('add_image', { url: 'http://x.test/a.png', kind: 'photo' }, caller, deps)).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringMatching(/https/) } })
    const small = (await sharp({ create: { width: 120, height: 90, channels: 3, background: '#777' } }).jpeg().toBuffer()).toString('base64')
    expect(await runTool('add_image', { data: small, kind: 'photo' }, caller, deps)).toMatchObject({ ok: false, error: { code: 'bad_input', message: expect.stringMatching(/200 px/), fix: expect.stringMatching(/larger/) } })
    expect(await runTool('add_image', { data: 'not base64!', kind: 'logo' }, caller, deps)).toMatchObject({ ok: false, error: { code: 'bad_input' } })
  })
  it('is refused when the server has no picture store, and capped per day', async () => {
    expect(await runTool('add_image', { data: 'AAAA', kind: 'logo' }, caller, setup({ store: null }).deps)).toMatchObject({ ok: false, error: { code: 'refused' } })
    const { db, deps } = setup()
    for (let i = 0; i < DAILY_IMAGES; i++) await db.bumpRate('img:u1', Math.floor(1_000_000 / 86_400_000))
    expect(await runTool('add_image', { data: 'AAAA', kind: 'logo' }, caller, deps)).toMatchObject({ ok: false, error: { code: 'quota' } })
  })
})

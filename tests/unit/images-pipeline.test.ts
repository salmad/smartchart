import { test, expect } from 'vitest'
import sharp from 'sharp'
import { fetchPublic, isPrivateAddress, prepare, sniff, ImageError } from '../../api/_lib/images'
import { imageMeta } from '@/engine/slides/images'

const svg = (body: string, w = 800, h = 300, bg = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${body}</svg>`)
const png = (s: Buffer) => sharp(s).png().toBuffer()
const alphaAt = async (b: Buffer, x: number, y: number) => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return data[(y * info.width + x) * 4 + 3] }

test('the bytes say what a picture is, whatever its name says', () => {
  expect(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe('png')
  expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
  expect(sniff(new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="x">'))).toBe('svg')
  expect(sniff(new TextEncoder().encode('<html><body>not found</body></html>'))).toBeNull()
})

test('a logo on white has the white keyed out and is trimmed to its ink', async () => {
  const input = await png(svg('<rect x="200" y="100" width="400" height="100" fill="#123"/>', 800, 300, '#fff'))
  const p = await prepare(input, 'logo')
  expect([p.w, p.h]).toEqual([400, 100])
  expect(p.ext).toBe('png')
  expect(await alphaAt(p.bytes, 200, 50)).toBe(255)
  expect(p.name).toMatch(/^img\/[0-9a-f]{16}-logo-400x100\.png$/)
  expect(imageMeta(`https://abc.public.blob.vercel-storage.com/${p.name}`)?.aspect).toBe(4)
})

test('a white letter inside a dark badge is knocked out, as a one-colour mask needs', async () => {
  const input = await png(svg('<rect x="100" y="50" width="600" height="200" fill="#0a3"/><rect x="350" y="120" width="100" height="60" fill="#fff"/>', 800, 300, '#fff'))
  const p = await prepare(input, 'logo')
  expect(await alphaAt(p.bytes, 300, 100)).toBe(0)
  expect(await alphaAt(p.bytes, 20, 20)).toBe(255)
})

test('a transparent logo keeps its alpha and is trimmed', async () => {
  const p = await prepare(await png(svg('<circle cx="400" cy="150" r="100" fill="#e33"/>')), 'logo')
  expect([p.w, p.h]).toEqual([200, 200])
})

test('white details on a transparent mark become holes; a reversed (white) logo keeps its white', async () => {
  const dotted = await prepare(await png(svg('<circle cx="400" cy="150" r="100" fill="#0a3"/><circle cx="400" cy="150" r="20" fill="#fff"/>')), 'logo')
  expect(await alphaAt(dotted.bytes, 100, 100)).toBe(0)
  expect(await alphaAt(dotted.bytes, 100, 30)).toBe(255)
  const reversed = await prepare(await png(svg('<rect x="100" y="100" width="600" height="100" fill="#fff"/>')), 'logo')
  expect(await alphaAt(reversed.bytes, 300, 50)).toBe(255)
})

test('an SVG logo is drawn large enough to stay sharp', async () => {
  const p = await prepare(svg('<rect x="10" y="10" width="80" height="20" fill="#000"/>', 100, 40), 'logo')
  expect(p.w).toBeGreaterThan(600)
})

test('what cannot be a logo is refused with a fix', async () => {
  const noisy = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).png().toBuffer()
  await expect(prepare(noisy, 'logo')).rejects.toThrow(/plain or transparent background/)
  const solid = await png(svg('', 800, 300, '#fff'))
  await expect(prepare(solid, 'logo')).rejects.toThrow(/empty/)
  const tiny = await png(svg('<rect x="5" y="5" width="30" height="10" fill="#000"/>', 40, 20, '#fff'))
  await expect(prepare(tiny, 'logo')).rejects.toBeInstanceOf(ImageError)
  await expect(prepare(new TextEncoder().encode('<html>'), 'photo')).rejects.toThrow(/not a picture/)
})

test('photos and screenshots are fitted, never enlarged, and need enough pixels', async () => {
  const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#888' } }).jpeg().toBuffer()
  const p = await prepare(big, 'photo')
  expect([p.w, p.h, p.ext]).toEqual([2000, 1500, 'webp'])
  const small = await sharp({ create: { width: 150, height: 150, channels: 3, background: '#888' } }).png().toBuffer()
  await expect(prepare(small, 'screenshot')).rejects.toThrow(/at least 200 px/)
})

test('only public addresses are fetched', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])
    expect(isPrivateAddress(ip), ip).toBe(true)
  for (const ip of ['8.8.8.8', '151.101.1.69', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false)
  const never = (() => { throw new Error('must not fetch') }) as unknown as typeof fetch
  await expect(fetchPublic('http://example.com/a.png', { fetch: never })).rejects.toThrow(/https/)
  await expect(fetchPublic('https://metadata.internal/a.png', { fetch: never, lookup: async () => [{ address: '169.254.169.254' }] })).rejects.toThrow(/not public/)
  await expect(fetchPublic('https://[::1]/a.png', { fetch: never })).rejects.toThrow(/not public/)
})

test('a redirect to a private address is refused, and big bodies are cut off', async () => {
  const lookup = async (h: string) => [{ address: h === 'good.example' ? '93.184.216.34' : '10.0.0.5' }]
  const hop = (async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/x.png' } })) as unknown as typeof fetch
  await expect(fetchPublic('https://good.example/a.png', { fetch: hop, lookup })).rejects.toThrow(/not public/)
  const huge = (async () => new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(1_000_000)) } }))) as unknown as typeof fetch
  await expect(fetchPublic('https://good.example/a.png', { fetch: huge, lookup })).rejects.toThrow(/over 10 MB/)
  const ok = (async () => new Response(new Uint8Array([1, 2, 3]))) as unknown as typeof fetch
  expect([...await fetchPublic('https://good.example/a.png', { fetch: ok, lookup })]).toEqual([1, 2, 3])
})

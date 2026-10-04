// Pictures in: whatever an agent points at becomes a SmartChart picture. Fetched safely, read for what it really is,
// prepared for its kind (a logo keyed off its background and trimmed to its ink) and stored under a name that carries
// its kind and size (src/engine/slides/images.ts), so slides render it without loading it first.
import { createHash } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import sharp from 'sharp'
import { imageName, type ImageKind } from '../../src/engine/slides/images.js'

export const MAX_BYTES = 10_000_000
const MAX_PIXELS = 60_000_000
/** What a refusal says: what was wrong and what to do instead. */
export class ImageError extends Error {
  constructor(message: string, readonly fix: string) { super(message) }
}

type Format = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | 'svg'
/** The format the bytes really are, whatever the URL or header said. */
export function sniff(b: Uint8Array): Format | null {
  const at = (i: number, ...xs: number[]) => xs.every((x, k) => b[i + k] === x)
  const text = (i: number, s: string) => at(i, ...[...s].map((c) => c.charCodeAt(0)))
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'jpeg'
  if (text(0, 'RIFF') && text(8, 'WEBP')) return 'webp'
  if (text(0, 'GIF8')) return 'gif'
  if (text(4, 'ftyp') && (text(8, 'avif') || text(8, 'avis'))) return 'avif'
  const head = new TextDecoder().decode(b.subarray(0, 1024)).replace(/^\uFEFF/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'svg'
  return null
}

export interface Prepared { bytes: Buffer; w: number; h: number; ext: 'png' | 'webp'; kind: ImageKind; name: string }

/** Decode, then prepare by kind. Photos and screenshots are fitted and re-encoded; a logo is keyed and trimmed. */
export async function prepare(input: Uint8Array, kind: ImageKind): Promise<Prepared> {
  const format = sniff(input)
  if (!format) throw new ImageError('That is not a picture SmartChart can read.', 'Pass a PNG, JPEG, WebP, GIF, AVIF or SVG.')
  let img = await decode(input, format, kind)
  const meta = await img.metadata()
  if (!meta.width || !meta.height) throw new ImageError('The picture has no size.', 'Pass another file.')
  if (kind === 'logo') return logo(img)
  const short = Math.min(meta.width, meta.height)
  if (short < 200) throw new ImageError(`The picture is ${meta.width}×${meta.height} px; a ${kind} needs at least 200 px on its shorter side to stay sharp on a slide.`, 'Pass a larger version.')
  const box = kind === 'photo' ? 2000 : 2400
  img = img.rotate().resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
  const out = await img.webp({ quality: kind === 'photo' ? 82 : 90 }).toBuffer({ resolveWithObject: true })
  return done(out.data, out.info.width, out.info.height, 'webp', kind)
}

async function decode(input: Uint8Array, format: Format, kind: ImageKind) {
  try {
    if (format !== 'svg') { const img = sharp(input, { limitInputPixels: MAX_PIXELS, animated: false }); await img.metadata(); return img }
    // An SVG is drawn large enough to stay sharp (librsvg runs no scripts and loads nothing external).
    const m = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata(), long = Math.max(m.width ?? 0, m.height ?? 0) || 100
    const target = kind === 'logo' ? 1200 : 2400
    return sharp(input, { density: Math.min(2400, Math.max(72, 72 * target / long)), limitInputPixels: MAX_PIXELS })
  } catch {
    throw new ImageError('The picture could not be read; the file looks damaged.', 'Pass another file.')
  }
}

/* A logo is drawn as a mask in one colour, so only its shape matters. A logo on a plain background has that colour
   keyed out across the whole picture (a white letter inside a badge is knocked out too, as the mask needs); one that is
   already transparent keeps its alpha. Then it is trimmed to its ink. */
async function logo(img: sharp.Sharp): Promise<Prepared> {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info, px = (x: number, y: number) => (y * W + x) * 4
  const border: number[] = []
  for (let x = 0; x < W; x++) border.push(px(x, 0), px(x, H - 1))
  for (let y = 1; y < H - 1; y++) border.push(px(0, y), px(W - 1, y))
  const clear = border.filter((i) => data[i + 3] < 16).length / border.length
  if (clear < 0.5) {
    // The background is the border's most common colour; it must cover most of the border to be a plain background.
    const key = (i: number) => ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const counts = new Map<number, number>()
    for (const i of border) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1)
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const ref = border.filter((i) => key(i) === top[0]), bg = [0, 1, 2].map((c) => ref.reduce((s, i) => s + data[i + c], 0) / ref.length)
    const dist = (i: number) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2])
    if (border.filter((i) => dist(i) < 40).length / border.length < 0.8)
      throw new ImageError('The logo is not on a plain or transparent background, so its shape cannot be cut out.', 'Pass the logo on a plain or transparent background (a PNG or SVG from the company’s press kit works best).')
    const lo = 36, hi = 120
    for (let i = 0; i < data.length; i += 4) {
      const t = Math.min(1, Math.max(0, (dist(i) - lo) / (hi - lo)))
      data[i + 3] = Math.round(data[i + 3] * t)
    }
  } else {
    // Already transparent. White details on a coloured mark (a dot, a letter) are holes in its one-colour shape; a logo
    // that is mostly white is a reversed logo, and its white is the ink.
    const white = (i: number) => Math.min(data[i], data[i + 1], data[i + 2]) > 225
    let ink = 0, light = 0
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) { ink++; if (white(i)) light++ }
    if (light && light / ink < 0.4) for (let i = 0; i < data.length; i += 4) {
      const t = Math.min(1, Math.max(0, (255 - Math.min(data[i], data[i + 1], data[i + 2]) - 8) / 40))
      data[i + 3] = Math.round(data[i + 3] * t)
    }
  }
  // Trim to the ink: the box of every pixel that shows.
  let x0 = W, y0 = H, x1 = -1, y1 = -1, ink = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[px(x, y) + 3] <= 24) continue
    ink++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (x1 < 0) throw new ImageError('The logo came out empty: it is the same colour as its background.', 'Pass a version with the logo in a colour other than its background.')
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  if (ink / (w * h) > 0.88 && w * h > 0.5 * W * H) throw new ImageError('That reads as a photo or a screenshot, not a logo: almost every pixel is solid.', 'Pass the logo on its own (a PNG or SVG), or add it with kind "photo" or "screenshot".')
  if (Math.max(w, h) < 120) throw new ImageError(`The logo is ${w}×${h} px once trimmed; at least 120 px on its longer side is needed to stay sharp.`, 'Pass a larger version, or an SVG.')
  const out = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: w, height: h })
    .resize({ width: 1200, height: 600, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
  return done(out.data, out.info.width, out.info.height, 'png', 'logo')
}

function done(bytes: Buffer, w: number, h: number, ext: 'png' | 'webp', kind: ImageKind): Prepared {
  const hash = createHash('sha256').update(bytes).digest('hex')
  return { bytes, w, h, ext, kind, name: imageName(hash, kind, w, h, ext) }
}

/* ─────────── Fetching a URL without reaching anything private ─────────── */

export type Lookup = (host: string) => Promise<{ address: string }[]>
const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true, verbatim: true })

/** Loopback, private, link-local, carrier-grade NAT, multicast and reserved ranges, in IPv4 and IPv6. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/i.exec(ip)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19))
  }
  const x = ip.toLowerCase()
  return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x) || x.startsWith('64:ff9b:') || x.startsWith('2001:db8')
}

/** Fetch a public https URL: every hop's host resolved and checked, at most 3 redirects, 10 s, MAX_BYTES. */
export async function fetchPublic(url: string, deps: { fetch?: typeof fetch; lookup?: Lookup } = {}): Promise<Uint8Array> {
  const get = deps.fetch ?? fetch, lookup = deps.lookup ?? defaultLookup
  let at: URL
  try { at = new URL(url) } catch { throw new ImageError('url: not a valid URL.', 'Pass a full https:// link to the picture.') }
  const signal = AbortSignal.timeout(10_000)
  for (let hop = 0; hop <= 3; hop++) {
    if (at.protocol !== 'https:') throw new ImageError('url: only https links are fetched.', 'Pass an https:// link, or the bytes as data.')
    if (at.username || at.password) throw new ImageError('url: links with a user name or password are not fetched.', 'Pass a public link.')
    const host = at.hostname.replace(/^\[|\]$/g, '')
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host).catch(() => [])
    if (!addrs.length) throw new ImageError(`url: ${host} could not be found.`, 'Check the link.')
    if (addrs.some((a) => isPrivateAddress(a.address))) throw new ImageError('url: that address is not public.', 'Pass a link anyone on the internet can open.')
    let res: Response
    try { res = await get(at, { redirect: 'manual', signal, headers: { accept: 'image/*,*/*;q=0.5', 'user-agent': 'SmartChart/1 (+https://smartchart.app)' } }) }
    catch { throw new ImageError('url: the picture could not be fetched (no answer within 10 seconds).', 'Check the link, or pass the bytes as data.') }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { at = new URL(res.headers.get('location') as string, at); continue }
    if (!res.ok || !res.body) throw new ImageError(`url: the server answered ${res.status}.`, 'Check that the link opens the picture itself, without signing in.')
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new ImageError('url: the picture is over 10 MB.', 'Pass a smaller version.')
    const reader = res.body.getReader(), parts: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) { await reader.cancel(); throw new ImageError('url: the picture is over 10 MB.', 'Pass a smaller version.') }
      parts.push(value)
    }
    const out = new Uint8Array(size)
    let o = 0
    for (const p of parts) { out.set(p, o); o += p.byteLength }
    return out
  }
  throw new ImageError('url: more than 3 redirects.', 'Pass the final link to the picture.')
}

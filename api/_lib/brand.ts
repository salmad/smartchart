// A company's brand colour, for the deck's accent: the colour its site declares (theme-color), else the main colour of its
// logo (logo-finder.ts). Greys, near-black and near-white are not a brand colour; the slide allocator keeps whatever is
// chosen legible on Ink and Paper.
import sharp from 'sharp'
import { fetchPublicFull, ImageError, type Lookup } from './images.js'
import { findLogo, homeOf } from './logo-finder.js'

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
const rgbOf = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255] as const }

/** A colour with enough of a hue to be a brand: not grey, not near-black, not near-white. */
export function isBrandColour(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  // Very dark navies and browns are a site's text and backgrounds more often than its brand.
  return max - min >= 48 && max >= 90 && min <= 235
}

/** The main colour of a logo: its opaque, coloured pixels grouped by hue; the largest group's average. */
export async function logoColour(png: Uint8Array): Promise<string | null> {
  const { data } = await sharp(png).resize({ width: 300, height: 300, fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const groups = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
    if (a < 200 || !isBrandColour(r, g, b)) continue
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    const k = Math.floor(h * 4), x = groups.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }
    groups.set(k, { n: x.n + 1, r: x.r + r, g: x.g + g, b: x.b + b })
  }
  const top = [...groups.values()].sort((a, b) => b.n - a.n)[0]
  // A few coloured pixels in a black logo are anti-aliasing, not a brand colour.
  const opaque = data.length / 4
  return top && top.n > opaque * 0.01 ? hex(top.r / top.n, top.g / top.n, top.b / top.n) : null
}

/** The theme-color a page declares, when it is a brand colour. */
export function themeColour(html: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]{0,300}>/gi)) {
    const tag = m[0]
    if (!/name\s*=\s*["']theme-color["']/i.test(tag)) continue
    const rgb = rgbOf(/content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '')
    if (rgb && isBrandColour(...rgb)) return hex(...rgb)
  }
  return null
}

/** The coloured hexes the page's own markup and styles use most, most used first: a site repeats its brand colour on
    links, buttons and marks. Five uses at least, so a stray highlight is not offered. */
export function pageColours(html: string, n = 3): string[] {
  const counts = new Map<string, number>()
  for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const rgb = rgbOf(m[1])
    if (!rgb || !isBrandColour(...rgb)) continue
    const k = m[1].toUpperCase()
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, c]) => c >= 5).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => `#${k}`)
}

export interface BrandColour { hex: string; from: string }

/** The colours a company's site offers as its brand, best evidence first: the one it declares, its logo's, then the ones
    its pages use most. The maker picks; none is applied unasked. Close shades count once. */
export async function brandColours(domain: string, deps: { fetch?: typeof fetch; lookup?: Lookup } = {}): Promise<BrandColour[]> {
  const { home } = homeOf(domain), host = home.hostname.replace(/^www\./, '')
  let html = ''
  try { html = new TextDecoder().decode((await fetchPublicFull(home.href, { ...deps, noun: 'page' })).bytes.subarray(0, 3_000_000)) } catch { /* the logo may still be found */ }
  const out: BrandColour[] = []
  const add = (hexCode: string | null, from: string) => {
    const rgb = hexCode ? rgbOf(hexCode) : null
    if (!hexCode || !rgb) return
    if (out.some((x) => { const o = rgbOf(x.hex); return !!o && Math.hypot(o[0] - rgb[0], o[1] - rgb[1], o[2] - rgb[2]) < 40 })) return
    out.push({ hex: hexCode, from })
  }
  if (html) add(themeColour(html), `the colour ${host} declares`)
  try { const { prepared } = await findLogo(domain, deps); add(await logoColour(prepared.bytes), `${host}'s logo`) } catch { /* the page may still have colours */ }
  if (html) for (const c of pageColours(html)) add(c, `used across ${host}`)
  if (!out.length) throw new ImageError(`No brand colour could be found on ${host}: its logo and pages may be black and white.`, 'Pick the colour by hand, or paste its hex code.')
  return out.slice(0, 4)
}

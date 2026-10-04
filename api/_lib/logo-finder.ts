// A company's logo from its own website, for add_image { domain }: the home page is read for the marks that name the
// company (an inline SVG or an image labelled as its logo, near the top), then its app icon as a fallback. Each candidate
// goes through the logo pipeline (images.ts) until one reads as a logo. Never a logo service: the company's own site.
import sharp from 'sharp'
import { fetchPublic, ImageError, prepare, type Lookup, type Prepared } from './images.js'

interface Candidate { score: number; from: string; load: () => Promise<Uint8Array> }

/** "stripe.com", "https://www.stripe.com/gb" → the home page URL, and the brand word to look for ("stripe"). */
export function homeOf(domain: string): { home: URL; brand: string } {
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`) } catch { throw new ImageError(`domain: "${domain}" is not a domain.`, 'Pass the company’s web address, e.g. "stripe.com".') }
  const host = u.hostname.replace(/^www\./, ''), parts = host.split('.')
  // The brand is the label before the public suffix: stripe.com → stripe, monzo.co.uk → monzo.
  const brand = (parts.length > 2 && (parts.at(-2) ?? '').length <= 3 ? parts.at(-3) : parts.at(-2)) ?? host
  return { home: new URL(`https://${u.hostname}/`), brand: brand.toLowerCase() }
}

// Marks that are not the company's own: other companies on its page, and the social networks it links to.
const OTHERS = /customer|partner|client|investor|press|trusted|featured|award|testimonial|integration|marquee|facebook|twitter|linkedin|instagram|youtube|tiktok|github|discord|social|app ?store|google ?play|translat|language/i
const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1] ?? new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag)?.[1] ?? ''

/** Every likely mark on the page, scored: the brand named on it counts most, then "logo", then being near the top. */
export function candidates(html: string, home: URL, brand: string, get: (u: URL) => Promise<Uint8Array>): Candidate[] {
  const out: Candidate[] = [], top = (i: number) => (i < html.length * 0.15 ? 2 : 0)
  // The brand counts only in words written for people (a label, a title, alt text): sites prefix their CSS classes with
  // their own name, so a class names it everywhere. A class or a file name counts only for saying "logo".
  const score = (label: string, cls: string, i: number) => {
    if (OTHERS.test(label) || OTHERS.test(cls)) return -1
    return (label.toLowerCase().includes(brand) ? 6 : 0) + (/logo|wordmark/i.test(label) ? 3 : 0) + (/logo|wordmark|brand/i.test(cls) ? 3 : 0) + top(i)
  }
  /** The link a mark sits in: the nearest opening <a> before it that has not closed. */
  const linkOf = (i: number) => { const before = html.slice(Math.max(0, i - 600), i), at = before.lastIndexOf('<a '); return at >= 0 && !before.slice(at).includes('</a>') ? before.slice(at, before.indexOf('>', at) + 1) : '' }
  for (const m of html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)) {
    const svg = m[0], open = svg.slice(0, svg.indexOf('>') + 1)
    // A sprite reference has nothing to draw on its own; an icon-sized glyph (a menu, an arrow) is not a mark.
    if (/<use\b/i.test(svg) && !/<path\b/i.test(svg)) continue
    if (svg.length < 300) continue
    const link = linkOf(m.index)
    const label = `${attr(open, 'aria-label')} ${/<title>([^<]*)/i.exec(svg)?.[1] ?? ''} ${attr(link, 'aria-label')} ${attr(link, 'title')}`
    // A link to the home page is the classic place for the company's own mark.
    const home0 = /^(\/|https?:\/\/[^/]*\/?)$/.test(attr(link, 'href')) ? 2 : 0
    const s = score(label, `${attr(open, 'class')} ${attr(open, 'id')} ${attr(link, 'class')}`, m.index) + home0
    if (s < 5) continue
    const doc = /xmlns=/.test(open) ? svg : svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
    out.push({ score: s + 1, from: 'an inline SVG on the home page', load: async () => new TextEncoder().encode(doc) })
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0], src = attr(tag, 'src')
    if (!src || src.startsWith('data:')) continue
    const file = src.split('?')[0].split('/').pop() ?? '', label = `${attr(tag, 'alt')} ${attr(tag, 'title')}`
    // A logo is a drawing (SVG, PNG, WebP), never a photo; and something says it is one.
    if (/\.jpe?g$/i.test(file) || !/logo|wordmark/i.test(`${label} ${attr(tag, 'class')} ${file}`)) continue
    const s = score(label, `${attr(tag, 'class')} ${file}`, m.index) + (file.toLowerCase().includes(brand) ? 4 : 0)
    if (s < 7) continue
    let u: URL
    try { u = new URL(src, home) } catch { continue }
    out.push({ score: s, from: `the image ${file} on the home page`, load: () => get(u) })
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0], rel = attr(tag, 'rel').toLowerCase(), href = attr(tag, 'href')
    if (!href || !/icon/.test(rel)) continue
    let u: URL
    try { u = new URL(href, home) } catch { continue }
    const svg = /\.svg(\?|$)/i.test(u.pathname) || /svg/i.test(attr(tag, 'type'))
    // The app icon is the mark on a square of colour: keying the colour leaves the mark. An SVG icon is drawn sharp.
    out.push({ score: rel.includes('apple-touch') ? 2 : svg ? 2.5 : 0.5, from: `the site's ${rel.includes('apple-touch') ? 'app icon' : 'icon'}`, load: () => get(u) })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** The company's logo, prepared; `from` says where it was found so the agent can tell the user what to check. */
export async function findLogo(domain: string, deps: { fetch?: typeof fetch; lookup?: Lookup } = {}): Promise<{ prepared: Prepared; from: string }> {
  const { home, brand } = homeOf(domain)
  let html: string
  try { html = new TextDecoder().decode(await fetchPublic(home.href, deps)) }
  catch (e) { throw new ImageError(`domain: ${home.hostname} could not be read (${e instanceof ImageError ? e.message.replace(/^url: /, '') : 'no answer'}).`, 'Pass a link to the logo itself (its press kit or Wikimedia), or ask the user for it.') }
  const list = candidates(html, home, brand, (u) => fetchPublic(u.href, deps))
  for (const c of list.slice(0, 6)) {
    try {
      const prepared = await prepare(await c.load(), 'logo')
      // A filled disc or square (an icon whose mark could not be cut out) is not a logo to put on a slide.
      if (await inkShare(prepared.bytes) <= 0.72) return { prepared, from: c.from }
    } catch { /* the next one */ }
  }
  throw new ImageError(`domain: no logo of ${brand} could be found on ${home.hostname}.`, 'Pass a link to the logo itself (its press kit or Wikimedia), or ask the user for it.')
}

/** How much of its box a prepared logo covers. */
async function inkShare(png: Buffer): Promise<number> {
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let ink = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 128) ink++
  return ink / (data.length / 4)
}

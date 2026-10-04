/* A link pasted into the chat is read like a dropped file: the server fetches it (/api/read, public https only), and the
   browser reads what came back with the same readers, or, for a web page, keeps its article text. */
import { MAX_CHARS, readFile, type Attached } from './files'

/** A message that is only a link: it becomes an attachment. */
export const LINK = /^https?:\/\/[^\s<>"]+$/i

const words = (t: string) => `${(t.match(/\S+/g)?.length ?? 0).toLocaleString('en-GB')} words`
/** The tidy name a link goes by: its host and the last part of its path. */
export const linkName = (url: string) => { try { const u = new URL(url), last = u.pathname.split('/').filter(Boolean).pop(); return `${u.hostname.replace(/^www\./, '')}${last ? ` · ${decodeURIComponent(last)}` : ''}` } catch { return url } }

/** A web page's own words: the article (or main) without menus, footers, scripts and forms, block by block. */
export function pageText(html: string): { title: string; text: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript, template, svg, iframe, form, nav, header, footer, aside, [aria-hidden="true"], [role="navigation"], [role="banner"], [role="contentinfo"]').forEach((el) => el.remove())
  // Boilerplate by name: navigation, categories, references, cookie banners, share and related-reading blocks.
  // Never the page's containers: a class on <html> or <body> often names a menu that the page merely has.
  doc.querySelectorAll('body [class]:not(main, article, [role="main"]), body [id]:not(main, article, [role="main"])').forEach((el) => { if (/(^|[\s_-])(nav|navbox|menu|sidebar|footer|breadcrumbs?|cookie|consent|catlinks|categories|references?|reflist|share|social|related|newsletter|subscribe|advert|promo)($|[\s_-])/i.test(`${el.getAttribute('class') ?? ''} ${el.id}`)) el.remove() })
  // Citation markers ("[12]") interrupt the sentence they sit in.
  doc.querySelectorAll('sup').forEach((el) => { if (/^\s*\[[^\]]{1,6}\]\s*$/.test(el.textContent ?? '')) el.remove() })
  const root = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body
  const title = (doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? doc.title ?? '').trim()
  const blocks = [...(root?.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, pre, figcaption, td, th') ?? [])]
    // A block inside another block is read with it.
    .filter((el) => !el.parentElement?.closest('p, li, blockquote, pre, td, th'))
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).filter((t) => t.length > 1)
  return { title, text: blocks.join('\n') || (root?.textContent ?? '').replace(/\s+/g, ' ').trim() }
}

const READABLE: [RegExp, string][] = [[/pdf/, 'pdf'], [/wordprocessingml/, 'docx'], [/spreadsheetml/, 'xlsx'], [/csv/, 'csv'], [/markdown/, 'md'], [/json/, 'json'], [/text\/plain/, 'txt']]

export async function readLink(url: string): Promise<Attached> {
  const r = await fetch('/api/read', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { error?: string } | null
    throw new Error(`${linkName(url)}: ${e?.error ?? (r.status === 401 ? 'Sign in to read links.' : 'the link could not be read.')}`)
  }
  const type = (r.headers.get('content-type') ?? '').toLowerCase(), final = r.headers.get('x-final-url') ?? url, blob = await r.blob(), name = linkName(final)
  const ext = READABLE.find(([re]) => re.test(type))?.[1] ?? /\.(pdf|docx|xlsx|csv|md|txt|json)$/i.exec(new URL(final).pathname)?.[1]?.toLowerCase()
  if (ext) return { ...(await readFile(new File([blob], `${name}.${ext}`))), name }
  if (!/html|xml/.test(type)) throw new Error(`${name}: Occam reads web pages, PDF, Word, Excel, CSV and text; this link is ${type || 'something else'}.`)
  const { title, text } = pageText(await blob.text())
  if (text.length < 200) throw new Error(`${name}: the page has almost no text Occam can read (it may need a sign-in, or draw its text with scripts). Download it as a PDF and drop that in.`)
  const body = `${title ? `Title: ${title}\n` : ''}Source: ${final}\n\n${text}`, cut = body.length > MAX_CHARS
  return { name: title ? `${title} · ${new URL(final).hostname.replace(/^www\./, '')}` : name, text: cut ? body.slice(0, MAX_CHARS) : body, about: words(text), cut }
}

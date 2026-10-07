/* A deck made anywhere, read to slides (a title and the rest of the text) in the browser, for the red-pen review.
   PDF: each page is a slide and its largest text is the title. PPTX: a zip of XML, read with the browser's own
   inflate (DecompressionStream), so there is no dependency; the title placeholder is the title. */
import type { Page } from '@/engine/agent/review'

export const DECK_ACCEPT = '.pptx,.pdf'
const MAX_BYTES = 50_000_000
/** Slides read from one file: a review is of the story, and past this the model call grows too large. */
export const MAX_SLIDES = 60

export async function readDeck(file: File): Promise<Page[]> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 50 MB.`)
  const kind = file.name.toLowerCase().split('.').pop()
  let pages: Page[]
  try {
    if (kind === 'pptx') pages = await readPptx(new Uint8Array(await file.arrayBuffer()))
    else if (kind === 'pdf') pages = await readPdfDeck(file)
    else throw new Error(`${file.name}: Occam reviews PowerPoint (.pptx) and PDF. From Google Slides or Keynote, export a PDF.`)
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(file.name)) throw e
    throw new Error(`${file.name} couldn’t be read. Is it protected with a password?`)
  }
  if (!pages.some((p) => p.title || p.body)) throw new Error(`${file.name} has no text Occam can read${kind === 'pdf' ? ' (slides exported as pictures)' : ''}.`)
  return pages
}

/* ---- zip ---- */

/** The files in a zip by name (only the ones `want` keeps), inflated. Stored and deflated entries; no zip64. */
export async function unzip(data: Uint8Array, want: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength), out = new Map<string, Uint8Array>()
  let end = -1
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break }
  if (end < 0) throw new Error('not a zip')
  const count = v.getUint16(end + 10, true)
  let at = v.getUint32(end + 16, true)
  const text = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (v.getUint32(at, true) !== 0x02014b50) throw new Error('bad zip directory')
    const method = v.getUint16(at + 10, true), size = v.getUint32(at + 20, true)
    const nameLen = v.getUint16(at + 28, true), extraLen = v.getUint16(at + 30, true), commentLen = v.getUint16(at + 32, true)
    const local = v.getUint32(at + 42, true), name = text.decode(data.subarray(at + 46, at + 46 + nameLen))
    at += 46 + nameLen + extraLen + commentLen
    if (!want(name)) continue
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), raw = data.subarray(start, start + size)
    if (method === 0) out.set(name, raw)
    else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()))
  }
  return out
}

/* ---- pptx ---- */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unescape = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m)
/** A shape's text, a line per paragraph. */
const paragraphs = (xml: string) => [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p [^>]*>([\s\S]*?)<\/a:p>/g)]
  .map((m) => [...(m[1] ?? m[2] ?? '').matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => unescape(t[1])).join('').trim()).filter(Boolean)

/** One slide's XML: the title placeholder's text as the title (else the first text), everything else as the body. */
export function pptxPage(xml: string): Page {
  const shapes = [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((m) => ({ title: /<p:ph[^>]*type="(?:title|ctrTitle)"/.test(m[1]), lines: paragraphs(m[1]) })).filter((s) => s.lines.length)
  // Tables live in graphic frames, not shapes.
  const tables = [...xml.matchAll(/<a:tbl>([\s\S]*?)<\/a:tbl>/g)].map((m) => [...m[1].matchAll(/<a:tr[\s\S]*?<\/a:tr>/g)].map((r) => paragraphs(r[0]).join('\t')))
  const t = shapes.find((s) => s.title) ?? shapes[0]
  return { title: t ? t.lines.join(' ') : '', body: [...shapes.filter((s) => s !== t).flatMap((s) => s.lines), ...tables.flat()].join('\n') }
}

/** Slides in the order the deck shows them: presentation.xml lists slide ids, its rels map them to files. Without
    those (a stripped file), file number order. Hidden slides are left out. */
export async function readPptx(data: Uint8Array): Promise<Page[]> {
  const files = await unzip(data, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n) || n === 'ppt/presentation.xml' || n === 'ppt/_rels/presentation.xml.rels')
  const text = new TextDecoder(), read = (n: string) => { const f = files.get(n); return f ? text.decode(f) : '' }
  const rels = new Map([...read('ppt/_rels/presentation.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [m[0].match(/Id="([^"]+)"/)?.[1], m[0].match(/Target="([^"]+)"/)?.[1]]))
  const listed = [...read('ppt/presentation.xml').matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => rels.get(m[1])).filter((t): t is string => !!t)
    .map((t) => `ppt/${t.replace(/^\/?ppt\//, '').replace(/^\.\//, '')}`).filter((n) => files.has(n))
  const names = listed.length ? listed : [...files.keys()].filter((n) => n.startsWith('ppt/slides/')).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
  return names.map(read).filter((x) => !/<p:sld\b[^>]*\bshow="(?:0|false)"/.test(x)).slice(0, MAX_SLIDES).map(pptxPage)
}

/* ---- pdf ---- */

/** A page's text runs in reading order, each with its font size: the largest runs (within 85%) are the title. */
export function pageBySize(runs: { str: string; size: number; eol?: boolean }[]): Page {
  const kept = runs.filter((r) => r.str.trim())
  const max = Math.max(0, ...kept.map((r) => r.size))
  const join = (rs: typeof kept) => rs.map((r) => r.str + (r.eol ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim()
  const title = kept.filter((r) => r.size >= max * 0.85)
  return { title: join(title).replace(/\n/g, ' '), body: join(kept.filter((r) => r.size < max * 0.85)) }
}

async function readPdfDeck(file: File): Promise<Page[]> {
  const [pdfjs, { default: worker }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }), doc = await task.promise
  const pages: Page[] = []
  for (let i = 1; i <= Math.min(doc.numPages, MAX_SLIDES); i++) {
    const items = (await (await doc.getPage(i)).getTextContent()).items
    pages.push(pageBySize(items.flatMap((it) => ('str' in it ? [{ str: it.str, size: Math.hypot(it.transform[2], it.transform[3]), eol: it.hasEOL }] : []))))
  }
  void task.destroy()
  return pages
}

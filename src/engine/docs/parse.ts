/* Doc file → Doc. Line-based, over the small Markdown subset docs use (see the M2 plan's grammar); blank lines separate
   blocks. Parsing never throws and never drops text: what does not parse is kept and reported with its line. */
import { plain } from '../slides/schema.js'
import { FIGURE_KINDS, type Block, type Doc, type FigureBody, type FigureKind, type Parsed } from './types.js'

const FRONT = ['title', 'subtitle', 'theme', 'accent'] as const
const FENCE = /^(`{3,})(.*)$/, HEADING = /^(#+)\s+(.*?)(?:\s*\{#([\w-]+)\})?\s*$/, ITEM = /^- (.*)$/, NUM = /^\d+\. (.*)$/
const isKind = (k: string): k is FigureKind => (FIGURE_KINDS as readonly string[]).includes(k)
/** A line that starts a block of its own (so it ends a paragraph). */
const starts = (l: string) => FENCE.test(l) || /^#/.test(l) || l.trim() === '---' || /^>/.test(l) || ITEM.test(l) || NUM.test(l)

export const slug = (text: string): string => plain(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')

export function outline(doc: Doc): { id: string; level: 2 | 3; text: string }[] {
  return doc.blocks.flatMap((b) => (b.type === 'heading' ? [{ id: b.id, level: b.level, text: plain(b.text) }] : []))
}

export function parseDoc(text: string): Parsed {
  const lines = text.replace(/\r\n?/g, '\n').split('\n'), errors: string[] = [], doc: Doc = { title: '', blocks: [] }
  let i = 0
  const err = (n: number, msg: string) => errors.push(`line ${n + 1}: ${msg}`)
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1)
    if (end < 0) err(0, 'the front matter has no closing ---.')
    for (i = 1; i < (end < 0 ? lines.length : end); i++) {
      const m = lines[i].match(/^(\w+):\s?(.*)$/)
      if (!lines[i].trim()) continue
      if (!m || !(FRONT as readonly string[]).includes(m[1])) { err(i, `"${lines[i]}": the front matter takes ${FRONT.join(', ')}.`); continue }
      const v = m[2].trim()
      if (m[1] === 'title') doc.title = v
      else if (m[1] === 'subtitle') doc.subtitle = v
      else if (m[1] === 'accent') doc.accent = v
      else doc.theme = v as Doc['theme'] // validateDoc reports a theme other than ink or paper
    }
    i = end < 0 ? lines.length : end + 1
  }
  const ids: (string | undefined)[] = []
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const fence = line.match(FENCE)
    if (fence) {
      const open = i, n = fence[1].length, info = fence[2].trim()
      let j = i + 1
      while (j < lines.length && !new RegExp(`^\`{${n},}\\s*$`).test(lines[j])) j++
      const inner = lines.slice(open + 1, j).join('\n'), whole = lines.slice(open, j + 1).join('\n')
      if (j >= lines.length) err(open, 'this block has no closing fence.')
      i = j + 1
      const occam = info.match(/^occam:(\w+)(?:\s*\{#([\w-]+)\})?$/)
      if (!occam) { doc.blocks.push({ type: 'code', lang: info, text: inner }); ids.push(undefined); continue }
      const [, kind, id] = occam
      let body: unknown
      try { body = JSON.parse(inner || '{}') } catch (e) { body = e instanceof Error ? e : null }
      if (!isKind(kind)) err(open, `occam:${kind} is not a component. Use one of: ${FIGURE_KINDS.join(', ')}.`)
      else if (body instanceof Error) err(open, `occam:${kind}: the JSON does not parse (${body.message}).`)
      else if (!body || typeof body !== 'object' || Array.isArray(body)) err(open, `occam:${kind}: the body must be a JSON object.`)
      if (!isKind(kind) || !body || typeof body !== 'object' || Array.isArray(body) || body instanceof Error) {
        doc.blocks.push({ type: 'raw', text: whole }); ids.push(undefined); continue
      }
      doc.blocks.push({ type: 'figure', kind, id: id ?? '', body: body as FigureBody }); ids.push(id)
      continue
    }
    const h = line.match(HEADING)
    if (h && (h[1].length === 2 || h[1].length === 3)) {
      doc.blocks.push({ type: 'heading', level: h[1].length as 2 | 3, id: h[3] ?? '', text: h[2] }); ids.push(h[3]); i++; continue
    }
    if (h) err(i, h[1].length === 1 ? 'a # heading: the title lives in the front matter; sections are ## and ###.' : 'headings go to ### at most.')
    if (!h && line.trim() === '---') { doc.blocks.push({ type: 'divider' }); ids.push(undefined); i++; continue }
    if (!h && /^>/.test(line)) {
      const parts: string[] = []
      while (i < lines.length && /^>/.test(lines[i])) parts.push(lines[i++].replace(/^>\s?/, '').trim())
      doc.blocks.push({ type: 'quote', text: parts.join(' ') }); ids.push(undefined); continue
    }
    const list = !h && (ITEM.test(line) ? ITEM : NUM.test(line) ? NUM : null)
    if (list) {
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(list)
        if (m) items.push(m[1].trim())
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += ` ${lines[i].trim()}`
        else break
        i++
      }
      doc.blocks.push({ type: list === ITEM ? 'bullets' : 'numbered', items }); ids.push(undefined); continue
    }
    // A paragraph: its first line as written (a leading \ says "this is text"), then lines up to a blank or a block.
    const parts = [line.trim().replace(/^\\/, '')]
    i++
    while (i < lines.length && lines[i].trim() && !starts(lines[i])) parts.push(lines[i++].trim())
    doc.blocks.push({ type: 'paragraph', text: parts.join(' ') }); ids.push(undefined)
  }
  giveIds(doc.blocks, ids)
  return { doc, errors }
}

/* Explicit ids are kept as written (validation reports duplicates); a missing one is a slug for a heading and
   <kind>-<n> for a figure, made unique against every id in the doc. */
function giveIds(blocks: Block[], explicit: (string | undefined)[]) {
  const taken = new Set(explicit.filter((x): x is string => !!x)), count: Record<string, number> = {}
  const unique = (base: string) => { let id = base, n = 2; while (taken.has(id)) id = `${base}-${n++}`; taken.add(id); return id }
  blocks.forEach((b, k) => {
    if (explicit[k] || (b.type !== 'heading' && b.type !== 'figure')) return
    if (b.type === 'heading') b.id = unique(slug(b.text) || 'section')
    else { let id: string; do { count[b.kind] = (count[b.kind] ?? 0) + 1; id = `${b.kind}-${count[b.kind]}` } while (taken.has(id)); taken.add(id); b.id = id }
  })
}

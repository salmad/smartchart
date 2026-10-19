/* The doc as the editor's document (ProseMirror's JSON, written here without the library so it is tested in node):
   `doc: title subtitle block* section*`, a section being `sectionHead` and a `sectionBody` of blocks, as the read view
   draws them. Text is marks over characters (markup.ts). A figure, code or raw block is one atom holding its Block.
   fromProse is toProse's inverse; a block the editor did not change comes back as the very Block it started from, so
   opening a doc and saving it writes the same file. */
import { parse, serialize, type Char, type Mark } from '../slides/markup.js'
import type { Block, ListBlock } from './types.js'

export interface ProseMark { type: string; attrs?: { href: string } }
export interface ProseNode { type: string; attrs?: Record<string, unknown>; content?: ProseNode[]; text?: string; marks?: ProseMark[] }
export interface Head { title: string; subtitle: string; blocks: Block[] }

const MARK: Record<string, Mark> = { bold: 'b', focus: 'f', neg: 'neg', pos: 'pos' }
const NAME: Record<string, string> = { b: 'bold', f: 'focus', neg: 'neg', pos: 'pos' }
const ORDER = ['bold', 'focus', 'neg', 'pos', 'link']

/** Markup as text nodes: a run of characters with the same marks is one node. */
export function inline(markup: string): ProseNode[] {
  const out: ProseNode[] = []
  let last = ''
  for (const c of parse(markup)) {
    const marks: ProseMark[] = c.marks.map((m) => (m.startsWith('link:') ? { type: 'link', attrs: { href: m.slice(5) } } : { type: NAME[m] }))
    const key = JSON.stringify(marks), prev = out[out.length - 1]
    if (prev && key === last) prev.text += c.ch
    else { out.push({ type: 'text', text: c.ch, ...(marks.length ? { marks } : {}) }); last = key }
  }
  return out
}

/** Text nodes back to markup. Marks are put in the order the format writes them. */
export function markupOf(nodes: readonly ProseNode[] | undefined): string {
  const chars: Char[] = []
  for (const n of nodes ?? []) {
    const marks = [...(n.marks ?? [])].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
      .map((m): Mark => (m.type === 'link' ? `link:${m.attrs?.href ?? ''}` : MARK[m.type]))
    for (const ch of n.text ?? '') chars.push({ ch, marks })
  }
  return serialize(chars)
}

const para = (text: string): ProseNode => ({ type: 'paragraph', ...(text ? { content: inline(text) } : {}) })
const list = (l: ListBlock): ProseNode => ({
  type: l.type === 'bullets' ? 'bulletList' : 'orderedList',
  content: l.items.map((x, i) => ({ type: 'listItem', content: [para(x), ...(l.nested?.[i] ? [list(l.nested[i] as ListBlock)] : [])] })),
})

/** One block as its node. `key` names a figure for the editor's open figure; it is never saved. */
export function toNode(b: Block, key: () => string): ProseNode {
  switch (b.type) {
    case 'paragraph': return para(b.text)
    case 'heading': return { type: 'heading', attrs: { level: 3, id: b.id }, ...(b.text ? { content: inline(b.text) } : {}) }
    case 'bullets': case 'numbered': return list(b)
    case 'quote': return { type: 'blockquote', content: [para(b.text)] }
    case 'divider': return { type: 'horizontalRule' }
    case 'code': case 'figure': case 'raw': return { type: 'figure', attrs: { block: b, key: key() } }
  }
}

export function toProse(d: Head): ProseNode {
  let n = 0
  const key = () => `f${++n}`, content: ProseNode[] = [
    { type: 'docTitle', ...(d.title ? { content: inline(d.title) } : {}) },
    { type: 'docSubtitle', ...(d.subtitle ? { content: inline(d.subtitle) } : {}) },
  ]
  let body: ProseNode[] | null = null
  for (const b of d.blocks) {
    if (b.type === 'heading' && b.level === 2) {
      body = []
      content.push({ type: 'section', content: [{ type: 'sectionHead', attrs: { id: b.id }, ...(b.text ? { content: inline(b.text) } : {}) }, { type: 'sectionBody', content: body }] })
    } else (body ?? content).push(toNode(b, key))
  }
  return { type: 'doc', content }
}

const textOf = (n: ProseNode) => markupOf(n.content)
function listOf(n: ProseNode): ListBlock {
  const items: string[] = [], nested: (ListBlock | null)[] = []
  for (const li of n.content ?? []) {
    const [p, sub] = li.content ?? []
    items.push(p ? textOf(p) : ''); nested.push(sub ? listOf(sub) : null)
  }
  const l: ListBlock = { type: n.type === 'bulletList' ? 'bullets' : 'numbered', items }
  return nested.some((x) => x) ? { ...l, nested } : l
}

/** The node without what the editor adds (a figure's key), as a string: how an unchanged block is recognised. */
const same = (n: ProseNode): string => JSON.stringify(n, (k, v: unknown) => (k === 'key' ? undefined : v))

export function fromNode(n: ProseNode): Block {
  switch (n.type) {
    case 'heading': return { type: 'heading', level: 3, id: String(n.attrs?.id ?? ''), text: textOf(n) }
    case 'bulletList': case 'orderedList': return listOf(n)
    case 'blockquote': return { type: 'quote', text: n.content?.[0] ? textOf(n.content[0]) : '' }
    case 'horizontalRule': return { type: 'divider' }
    case 'figure': return structuredClone(n.attrs?.block as Block)
    default: return { type: 'paragraph', text: textOf(n) }
  }
}

/** `originals` are the blocks the editor opened with: a node that is what one of them draws as gives that block back. */
export function fromProse(doc: ProseNode, originals: readonly Block[] = []): Head {
  const pool = new Map<string, Block[]>(), key = (b: Block, k: () => string) => same(b.type === 'heading' && b.level === 2 ? { type: 'sectionHead', attrs: { id: b.id }, ...(b.text ? { content: inline(b.text) } : {}) } : toNode(b, k))
  for (const o of originals) { const s = key(o, () => ''), q = pool.get(s) ?? []; q.push(o); pool.set(s, q) }
  const reuse = (n: ProseNode, make: () => Block): Block => { const q = pool.get(same(n)); return q?.length ? (q.shift() as Block) : make() }
  const [title, subtitle, ...rest] = doc.content ?? []
  const blocks: Block[] = []
  for (const n of rest) {
    if (n.type === 'section') {
      const [head, body] = n.content ?? []
      blocks.push(reuse(head, () => ({ type: 'heading', level: 2, id: String(head.attrs?.id ?? ''), text: textOf(head) })))
      for (const c of body?.content ?? []) blocks.push(reuse(c, () => fromNode(c)))
    } else blocks.push(reuse(n, () => fromNode(n)))
  }
  return { title: title ? textOf(title) : '', subtitle: subtitle ? textOf(subtitle) : '', blocks }
}

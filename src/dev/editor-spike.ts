/* THROWAWAY spike (plan task 2): can a Tiptap document whose schema is the Block union draw exactly the read view's
   structure, with doc.css and components.css unchanged? ?doc=<id>&view=read|edit&theme=paper|ink. */
import '@/engine/components/components.css'
import '@/engine/docs/doc.css'
import '@/app/components/docs/docs-edit.css'
import { Editor, Extension, Node, Mark } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Heading from '@tiptap/extension-heading'
import { BulletList, OrderedList, ListItem } from '@tiptap/extension-list'
import Blockquote from '@tiptap/extension-blockquote'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Bold from '@tiptap/extension-bold'
import Link from '@tiptap/extension-link'
import { UndoRedo } from '@tiptap/extensions'
import { DOC_STARTERS, starterDoc } from '@/engine/starters'
import { docHTML, blockHTML, DEFAULT_THEME } from '@/engine/docs/render'
import { fitFigures, mountDoc } from '@/engine/docs/mount'
import { parse, type Mark as M } from '@/engine/slides/markup'
import { md } from '@/engine/components/text'
import type { Block, FigureBlock } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'

const q = new URLSearchParams(location.search)
const starter = DOC_STARTERS.find((s) => s.id === q.get('doc')) ?? DOC_STARTERS[0]
const doc = starterDoc(starter)
if (q.get('theme') === 'ink' || q.get('theme') === 'paper') doc.theme = q.get('theme') as Theme
const theme = doc.theme ?? DEFAULT_THEME
const root = document.getElementById('doc') as HTMLElement

const span = (name: string, cls: string) => Mark.create({ name, parseHTML: () => [{ tag: `span.${cls}` }], renderHTML: () => ['span', { class: cls }, 0] })
const Focus = span('focus', 'hl-focus'), Neg = span('neg', 'hl-neg'), Pos = span('pos', 'hl-pos')

// The arrow after a link, as the read view draws it: a widget at the end of each link run, inside the link, glued to the
// last word by a word joiner (the read view's .nw span does the same job and cannot be a mark).
const EXT = '<svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'
const LinkTails = Extension.create({ name: 'linkTails', addProseMirrorPlugins: () => [new Plugin({ props: { decorations: (state) => {
  const out: Decoration[] = []
  state.doc.descendants((n, pos) => {
    if (!n.isTextblock) return
    const st: { run: { href: string; end: number } | null } = { run: null }
    const flush = () => { const r = st.run; if (r) out.push(Decoration.widget(r.end, () => { const e = document.createElement('span'); e.innerHTML = `\u2060${r.href.startsWith('#') ? '' : EXT}`; return e }, { side: -1, marks: [state.schema.marks.link.create({ href: r.href })] })); st.run = null }
    n.forEach((c, off) => { const l = c.marks.find((m) => m.type.name === 'link'), end = pos + 1 + off + c.nodeSize; const cur = st.run; if (l && cur && cur.href === l.attrs.href) cur.end = end; else { flush(); if (l) st.run = { href: l.attrs.href as string, end } } })
    flush()
    return false
  })
  return DecorationSet.create(state.doc, out)
} } })] })

// Sections as the read view has them: section.doc-sec > h2 + div.sec-body.
const Section = Node.create({ name: 'section', content: 'sectionHead sectionBody', defining: true, renderHTML: () => ['section', { class: 'doc-sec' }, 0] })
const SectionHead = Node.create({ name: 'sectionHead', content: 'inline*', marks: '_', addAttributes: () => ({ id: { default: '' } }), renderHTML: ({ node }) => ['h2', { id: node.attrs.id as string }, 0] })
const SectionBody = Node.create({ name: 'sectionBody', content: 'block*', renderHTML: () => ['div', { class: 'sec-body' }, 0] })

// Figures, code and raw: atoms drawn by the same blockHTML as the read view.
const Atom = Node.create({
  name: 'figure', group: 'block', atom: true, selectable: true, draggable: true,
  addAttributes: () => ({ block: { default: null } }),
  renderHTML: () => ['div', { class: 'doc-fig' }],
  addNodeView: () => ({ node }) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = blockHTML(node.attrs.block as Block, theme)
    const dom = tmp.firstElementChild as HTMLElement
    return { dom }
  },
})

const marksOf = (ms: M[]) => ms.map((m) => (m === 'b' ? { type: 'bold' } : m === 'f' ? { type: 'focus' } : m === 'neg' ? { type: 'neg' } : m === 'pos' ? { type: 'pos' } : { type: 'link', attrs: { href: m.slice(5) } }))
function inline(markup: string) {
  const out: { type: 'text'; text: string; marks?: object[] }[] = []
  for (const c of parse(markup)) {
    const key = JSON.stringify(c.marks), last = out[out.length - 1] as { text: string; key?: string } | undefined
    if (last && last.key === key) last.text += c.ch
    else out.push({ type: 'text', text: c.ch, ...(c.marks.length ? { marks: marksOf(c.marks) } : {}), key } as never)
  }
  return out.map(({ key: _k, ...x }: Record<string, unknown>) => x)
}
const para = (text: string) => ({ type: 'paragraph', content: inline(text) })
function node(b: Block) {
  switch (b.type) {
    case 'paragraph': return para(b.text)
    case 'heading': return { type: 'heading', attrs: { level: 3, id: b.id }, content: inline(b.text) }
    case 'bullets': return { type: 'bulletList', content: b.items.map((x) => ({ type: 'listItem', content: [para(x)] })) }
    case 'numbered': return { type: 'orderedList', content: b.items.map((x) => ({ type: 'listItem', content: [para(x)] })) }
    case 'quote': return { type: 'blockquote', content: [para(b.text)] }
    case 'divider': return { type: 'horizontalRule' }
    default: return { type: 'figure', attrs: { block: b } }
  }
}
function toPM(blocks: Block[]) {
  const content: object[] = []
  let section: { content: object[] } | null = null
  for (const b of blocks) {
    if (b.type === 'heading' && b.level === 2) {
      section = { content: [] }
      content.push({ type: 'section', content: [{ type: 'sectionHead', attrs: { id: b.id }, content: inline(b.text) }, { type: 'sectionBody', content: section.content }] })
    } else (section ? section.content : content).push(node(b))
  }
  return { type: 'doc', content }
}

const head = `<header class="doc-head"><h1 class="doc-title">${md(doc.title)}</h1>${doc.subtitle ? `<p class="doc-sub">${md(doc.subtitle)}</p>` : ''}</header>`
void Promise.all(['800 100px Archivo', '900 100px Archivo', '400 30px Geist', '600 30px Geist', "500 20px 'Geist Mono'"].map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(() => {
  if (q.get('view') === 'read') {
    // Without the contents and fold controls the read view differs from edit: draw the same bare page for the comparison.
    mountDoc(root, doc, 'spike')
    document.querySelector('.doc-toc, .doc-toc-mini')?.remove()
    document.querySelectorAll('.doc-toc, .doc-toc-mini').forEach((e) => e.remove())
    document.querySelectorAll('h2 .fold').forEach((e) => e.remove())
    // The edit page has no contents, and docs-edit.css starts its first heading at the top.
    document.querySelector<HTMLElement>('.doc-body > .doc-sec:first-child > h2')?.style.setProperty('margin-top', '0')
    document.querySelectorAll('.doc-sec > h2 > a').forEach((a) => a.replaceWith(...a.childNodes))
  } else {
    root.innerHTML = `<article class="doc theme-${theme} doc-editing">${head}</article>`
    const el = root.querySelector('article') as HTMLElement
    const editor = new Editor({
      element: el,
      editorProps: { attributes: { class: 'doc-body' } },
      extensions: [Document.extend({ content: 'block* section*' }), Paragraph, Text, Heading.configure({ levels: [3] }).extend({ addAttributes: () => ({ id: { default: '' } }) }),
        BulletList.configure({ HTMLAttributes: { class: 'doc-list' } }), OrderedList.configure({ HTMLAttributes: { class: 'doc-list' } }), ListItem, Blockquote, HorizontalRule, Bold, Link.configure({ openOnClick: false }), Focus, Neg, Pos,
        Section, SectionHead, SectionBody, Atom, UndoRedo, LinkTails],
      content: toPM(doc.blocks),
    })
    void editor
    const byKey = new Map<HTMLElement, FigureBlock>()
    document.querySelectorAll<HTMLElement>('.doc-fig').forEach((f, i) => { const b = doc.blocks.filter((x) => x.type === 'figure')[i]; if (b) byKey.set(f, b as FigureBlock) })
    fitFigures(root, (frame) => byKey.get(frame.closest<HTMLElement>('.doc-fig') as HTMLElement) ?? null, theme, doc.accent)
  }
  ;(window as unknown as { ready: boolean }).ready = true
})
export { docHTML }

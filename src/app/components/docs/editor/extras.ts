/* The editor's smaller parts: the arrow after a link (as the read view draws it), and unique ids. */
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Block } from '@/engine/docs/types'

const EXT = '<svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'

/** The arrow after a link is a widget at the end of each link run, inside the link, glued to the last word by a word
    joiner (the read view's .nw span does the same and cannot be a mark). A link to a section has none. */
export const LinkTails = Extension.create({
  name: 'linkTails',
  addProseMirrorPlugins: () => [new Plugin({ props: { decorations: (state) => {
    const out: Decoration[] = []
    state.doc.descendants((n, pos) => {
      if (!n.isTextblock) return
      const st: { run: { href: string; end: number } | null } = { run: null }
      const flush = () => {
        const r = st.run
        if (r && !r.href.startsWith('#')) out.push(Decoration.widget(r.end, () => { const e = document.createElement('span'); e.innerHTML = `⁠${EXT}`; return e }, { side: -1, marks: [state.schema.marks.link.create({ href: r.href })] }))
        st.run = null
      }
      n.forEach((c, off) => {
        const l = c.marks.find((m) => m.type.name === 'link'), end = pos + 1 + off + c.nodeSize, cur = st.run
        if (l && cur && cur.href === l.attrs.href) cur.end = end
        else { flush(); if (l) st.run = { href: l.attrs.href as string, end } }
      })
      flush()
      return false
    })
    return DecorationSet.create(state.doc, out)
  } } })],
})

/** A copy of a section or a figure must not carry the original's id (Save refuses an id used twice): the first keeps it,
    the others lose it, and Save names them. A figure's key, which only the editor uses, is made new. */
export const UniqueIds = Extension.create({
  name: 'uniqueIds',
  addProseMirrorPlugins: () => [new Plugin({ appendTransaction: (trs, _old, state) => {
    if (!trs.some((t) => t.docChanged)) return null
    const seen = new Set<string>(), keys = new Set<string>(), tr = state.tr
    state.doc.descendants((n, pos) => {
      const t = n.type.name
      if (t === 'sectionHead' || t === 'heading') {
        const id = String(n.attrs.id ?? '')
        if (id && seen.has(id)) tr.setNodeMarkup(pos, undefined, { ...n.attrs, id: '' }); else if (id) seen.add(id)
      } else if (t === 'figure') {
        const b = n.attrs.block as Block, id = b.type === 'figure' ? b.id : '', key = String(n.attrs.key)
        const dupId = id && seen.has(id), dupKey = keys.has(key)
        if (dupId || dupKey) tr.setNodeMarkup(pos, undefined, { ...n.attrs, key: dupKey ? `n${Date.now().toString(36)}${pos}` : key, block: dupId && b.type === 'figure' ? { ...b, id: '' } : b })
        else { if (id) seen.add(id); keys.add(key) }
      }
      return t !== 'figure'
    })
    return tr.docChanged ? tr.setMeta('addToHistory', false) : null
  } })],
})

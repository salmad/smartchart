/* Changes that move a section's edge (a paragraph becomes a heading, a heading goes, Enter at the end of a heading, a
   block moves) are made on the doc's flat list of blocks with the same pure ops the doc tools use (engine/docs/blocks),
   and the result replaces only the top-level nodes it changed. Everything inside one block (typing, marks, lists) is
   ProseMirror's own. An open figure keeps its slot: its node is the same node. */
import type { Editor } from '@tiptap/core'
import { Fragment, Node as PMNode, Slice } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { fromProse, toProse, type ProseNode } from '@/engine/docs/prose'
import type { Keyed } from '@/engine/docs/blocks'
import type { Block } from '@/engine/docs/types'

export type Where = { key: string; at: number; item?: number } | { key: string; select: true }
export interface Op { list: Keyed[]; focus?: Where }

/** The doc's blocks in reading order, each with where it is: a section's heading counts as a block, then its body's. */
export interface Entry { node: PMNode; pos: number; head: boolean }
export function entries(doc: PMNode): Entry[] {
  const out: Entry[] = []
  doc.forEach((n, off) => {
    const pos = off
    if (n.type.name === 'section') {
      const head = n.child(0), body = n.child(1)
      out.push({ node: head, pos: pos + 1, head: true })
      let at = pos + 1 + head.nodeSize + 1
      body.forEach((c) => { out.push({ node: c, pos: at, head: false }); at += c.nodeSize })
    } else if (!['docTitle', 'docSubtitle'].includes(n.type.name)) out.push({ node: n, pos, head: false })
  })
  return out
}

const textStart = (e: Entry) => e.pos + (e.node.type.name === 'blockquote' ? 2 : 1)

/** The block the cursor (or selected node) is in, and the plain-text offset in it when it is a text block; null in the
    title or the subtitle. */
export function caretIn(editor: Editor): { index: number; offset: number } | null {
  const { from } = editor.state.selection, list = entries(editor.state.doc)
  const index = list.findIndex((e) => from >= e.pos && from <= e.pos + e.node.nodeSize)
  const e = list[index]
  if (!e) return null
  return { index, offset: ['bulletList', 'orderedList', 'figure', 'horizontalRule'].includes(e.node.type.name) ? 0 : from - textStart(e) }
}

export function applyBlocks(editor: Editor, originals: readonly Block[], op: (list: Keyed[], index: number, offset: number) => Op | null, at?: { index: number; offset: number } | null): boolean {
  const here = at === undefined ? caretIn(editor) : at
  if (!here) return false
  const json = editor.getJSON() as ProseNode, head = fromProse(json, originals), flat = entries(editor.state.doc)
  // Keys: a figure's own, else a number. The list's order is the doc's.
  const keys = flat.map((e, i) => (e.node.type.name === 'figure' ? String(e.node.attrs.key) : `b${i}`)), list: Keyed[] = head.blocks.map((block, i) => ({ key: keys[i], block }))
  const r = op(list, here.index, here.offset)
  if (!r) return false
  const byBlock = new Map<Block, string>(r.list.map((k) => [k.block, k.key]))
  let n = 0
  const next = PMNode.fromJSON(editor.schema, toProse({ title: head.title, subtitle: head.subtitle, blocks: r.list.map((k) => k.block) }, (b) => { const k = byBlock.get(b); return k && !k.startsWith('b') ? k : `n${Date.now().toString(36)}${++n}` }))
  const old = editor.state.doc
  // Replace what changed: the nodes between the common start and the common end.
  let a = 0
  while (a < old.childCount && a < next.childCount && old.child(a).eq(next.child(a))) a++
  let z = 0
  while (z < old.childCount - a && z < next.childCount - a && old.child(old.childCount - 1 - z).eq(next.child(next.childCount - 1 - z))) z++
  const from = [...Array(a).keys()].reduce((s, i) => s + old.child(i).nodeSize, 0)
  const to = old.content.size - [...Array(z).keys()].reduce((s, i) => s + old.child(old.childCount - 1 - i).nodeSize, 0)
  const mid: PMNode[] = []
  for (let i = a; i < next.childCount - z; i++) mid.push(next.child(i))
  const tr = editor.state.tr.replace(from, to, new Slice(Fragment.from(mid), 0, 0))
  const after = entries(tr.doc)
  if (r.focus) {
    const idx = r.list.findIndex((k) => k.key === r.focus?.key), e = after[idx]
    if (e) {
      if ('select' in r.focus) tr.setSelection(NodeSelection.create(tr.doc, e.pos))
      else if (['bulletList', 'orderedList'].includes(e.node.type.name)) {
        // Inside the first item's words (the lists the ops make put the cursor in an item of the top list).
        const start = e.pos + 3
        tr.setSelection(TextSelection.create(tr.doc, Math.min(start + r.focus.at, start + (e.node.child(0).child(0).content.size))))
      } else tr.setSelection(TextSelection.create(tr.doc, Math.min(textStart(e) + r.focus.at, textStart(e) + e.node.content.size)))
    }
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

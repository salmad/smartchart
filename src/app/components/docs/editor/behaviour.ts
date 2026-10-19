/* The editor's keys and rules. Inside one block ProseMirror does the work. Where a key or a rule changes a section's
   edge it is made on the flat list of blocks (structure.ts), with the same pure ops the doc tools use. */
import { Extension, type Editor } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { convert, insertAfter, mergeBack, moveBlock, removeBlock, splitText, type Keyed } from '@/engine/docs/blocks'
import type { Block } from '@/engine/docs/types'
import { applyBlocks, caretIn, type Op } from './structure'

export interface BehaviourOptions { originals: () => readonly Block[]; slash: (e: KeyboardEvent) => boolean }

/** The depth of the list item the cursor is in (0 outside lists). */
const listDepth = (editor: Editor) => { const $f = editor.state.selection.$from; let d = 0; for (let i = $f.depth; i > 0; i--) if ($f.node(i).type.name === 'listItem') d++; return d }

/** The first line of the editor after the title: the subtitle's, or the first block's, start. */
const focusAfter = (editor: Editor, name: 'docTitle' | 'docSubtitle') => {
  const doc = editor.state.doc
  let pos = 0, found = false
  doc.forEach((n, off) => { if (found) return; if (n.type.name === name) { pos = off + n.nodeSize; found = true } })
  const next = doc.nodeAt(pos)
  if (!next) { editor.chain().insertContentAt(pos, { type: 'paragraph' }).focus(pos + 1).run(); return true }
  return editor.commands.focus(next.isTextblock ? pos + 1 : pos + 1)
}

/** The editor's selection, made the DOM's: only for a cursor or range inside text. */
function syncSelection(view: EditorView) {
  const s = window.getSelection()
  if (!s || !s.anchorNode || !s.focusNode || !view.dom.contains(s.anchorNode) || !view.dom.contains(s.focusNode)) return
  // A cursor inside a figure belongs to the figure's own editor, not to this one.
  const at = s.anchorNode instanceof Element ? s.anchorNode : s.anchorNode.parentElement
  if (at?.closest('.doc-fig')) return
  try {
    const a = view.posAtDOM(s.anchorNode, s.anchorOffset), f = view.posAtDOM(s.focusNode, s.focusOffset), cur = view.state.selection
    if (a === cur.anchor && f === cur.head) return
    view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.doc.resolve(a), view.state.doc.resolve(f))).setMeta('addToHistory', false))
  } catch { /* a position the DOM could not name: leave the selection as it is */ }
}

export const Behaviour = Extension.create<BehaviourOptions>({
  name: 'docBehaviour', priority: 1000,
  addOptions: () => ({ originals: () => [], slash: () => false }),

  addProseMirrorPlugins() {
    const o = () => this.options, ed = () => this.editor
    return [new Plugin({
      props: {
        // `## ` and `# ` in an empty paragraph make a section heading.
        handleTextInput(view, _from, _to, text) {
          if (text !== ' ') return false
          const { $from } = view.state.selection, before = $from.parent.textContent.slice(0, $from.parentOffset)
          if (!/^#{1,2}$/.test(before) || $from.parent.type.name !== 'paragraph' || $from.parent.textContent !== before || $from.parentOffset !== before.length) return false
          const at = caretIn(ed())
          if (!at) return false
          return applyBlocks(ed(), o().originals(), (list, i): Op | null => {
            const key = list[i]?.key
            if (!key) return null
            const cleared = list.map((k) => (k.key === key ? { ...k, block: { type: 'paragraph' as const, text: '' } } : k))
            return { list: convert(cleared, key, 'heading2'), focus: { key, at: 0 } }
          }, at)
        },
        // The browser tells the editor about a moved cursor a moment after the key that moved it: a key that follows at
        // once (a fast typist, a test) must see where the cursor is now, before any key handler reads it.
        handleDOMEvents: { keydown: (view, e) => { syncSelection(view); return o().slash(e as KeyboardEvent) } },
      },
    })]
  },

  addKeyboardShortcuts() {
    const ed = () => this.editor, o = () => this.options
    const flat = (fn: (list: Keyed[], index: number, offset: number) => Op | null) => applyBlocks(ed(), o().originals(), fn)
    const move = (dir: -1 | 1) => () => flat((list, i): Op | null => { const to = i + dir; if (to < 0 || to >= list.length) return null; const key = list[i].key; return { list: moveBlock(list, key, to), focus: list[i].block.type === 'figure' || list[i].block.type === 'divider' ? { key, select: true } : { key, at: caretIn(ed())?.offset ?? 0 } } })
    return {
      'Mod-i': () => true, 'Mod-u': () => true,
      // The file has no line breaks inside a block.
      'Shift-Enter': () => true,
      'Alt-Shift-ArrowUp': move(-1), 'Alt-Shift-ArrowDown': move(1),
      Escape: () => { (ed().view.dom as HTMLElement).blur(); return true },
      // Lists nest to three levels, no further.
      Tab: () => listDepth(ed()) >= 3,
      Enter: () => {
        const { $from, empty } = ed().state.selection, type = $from.parent.type.name
        if (type === 'docTitle') return focusAfter(ed(), 'docTitle')
        if (type === 'docSubtitle') return focusAfter(ed(), 'docSubtitle')
        // A heading, or a quote: the part after the cursor is a new paragraph under it.
        const inQuote = type === 'paragraph' && $from.node(-1)?.type.name === 'blockquote'
        if (type !== 'sectionHead' && !inQuote) return false
        // A selection is typed over: it goes first, then the split is where it started.
        if (!empty) ed().commands.deleteSelection()
        return flat((list, i, offset): Op | null => { const key = list[i].key, r = splitText(list, key, offset); return { list: r.list, focus: { key: r.key, at: 0 } } })
      },
      Backspace: () => {
        const { $from, empty } = ed().state.selection
        if (!empty || $from.parentOffset !== 0) return false
        const type = $from.parent.type.name
        if (type === 'docTitle') return true
        if (type === 'docSubtitle') return ed().commands.focus(1 + (ed().state.doc.child(0).content.size))
        // A section heading turns into a paragraph first; the next Backspace joins it to what is above.
        if (type === 'sectionHead') return flat((list, i): Op | null => { const key = list[i].key; return { list: convert(list, key, 'paragraph'), focus: { key, at: 0 } } })
        const first = $from.parent.type.name === 'paragraph' && $from.node(-1)?.type.name === 'sectionBody' && $from.index(-1) === 0
        if (first) return flat((list, i): Op | null => {
          const key = list[i].key, prev = list[i - 1]
          if (!prev || prev.block.type !== 'heading') return null
          if (list[i].block.type === 'paragraph' && (list[i].block as { text: string }).text === '') { const rest = removeBlock(list, key); return { list: rest, focus: { key: prev.key, at: Number.MAX_SAFE_INTEGER } } }
          const r = mergeBack(list, key)
          return r ? { list: r.list, focus: { key: r.key, at: r.at } } : null
        })
        // The first block under the subtitle: the cursor goes to the end of the subtitle, nothing is joined to it.
        if ($from.parent.type.name === 'paragraph' && $from.depth === 1) {
          const idx = $from.index(0)
          if (idx === 2) return ed().commands.focus(1 + ed().state.doc.child(0).nodeSize + ed().state.doc.child(1).content.size)
        }
        return false
      },
    }
  },
})

/** A block removed with the cursor kept: to the block after it, else the one before; the last block leaves a paragraph. */
export function removeBlockAt(editor: Editor, originals: readonly Block[], index: number): boolean {
  return applyBlocks(editor, originals, (list, i): Op | null => {
    const key = list[i]?.key, before = list[i - 1], after = list[i + 1]
    if (!key) return null
    const rest = removeBlock(list, key), target = after ?? before
    if (!target) { const r = insertAfter(rest, null, { type: 'paragraph', text: '' }); return { list: r.list, focus: { key: r.key, at: 0 } } }
    const isText = ['paragraph', 'heading', 'quote'].includes(target.block.type)
    return { list: rest, focus: !isText ? { key: target.key, select: true } : { key: target.key, at: target === after ? 0 : Number.MAX_SAFE_INTEGER } }
  }, { index, offset: 0 })
}

export const moveBlockBy = (editor: Editor, originals: readonly Block[], index: number, dir: -1 | 1): boolean => applyBlocks(editor, originals, (list, i): Op | null => {
  const to = i + dir
  if (to < 0 || to >= list.length) return null
  const key = list[i].key, b = list[i].block
  return { list: moveBlock(list, key, to), focus: b.type === 'figure' || b.type === 'divider' || b.type === 'code' ? { key, select: true } : { key, at: 0 } }
}, { index, offset: 0 })


/** A block dropped at a place in the list (its index among the others), selected or with the cursor at its start. */
export const moveBlockTo = (editor: Editor, originals: readonly Block[], index: number, to: number): boolean => applyBlocks(editor, originals, (list, i): Op | null => {
  const key = list[i].key, b = list[i].block
  return { list: moveBlock(list, key, to), focus: b.type === 'figure' || b.type === 'divider' || b.type === 'code' ? { key, select: true } : { key, at: 0 } }
}, { index, offset: 0 })

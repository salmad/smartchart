/* A figure, code or raw block in the editor: one atom holding its Block, drawn by the read view's own blockHTML and
   laid out by fitFigures, so it cannot differ from the read page. One figure at a time is open in place: its slot is
   the same element for as long as it stays open (edits elsewhere on the page do not rebuild it), and React draws the
   slide's edit surface into it. */
import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Editor } from '@tiptap/core'
import { fitFigures, loadFaces } from '@/engine/docs/mount'
import { blockHTML } from '@/engine/docs/render'
import type { Block, FigureBlock } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'

export interface FigureHost {
  theme(): Theme
  accent(): string | undefined
  /** A click on a figure. */
  open(key: string): void
  /** The element the open figure's edit surface is drawn into: one per figure for as long as it is open, so the surface
      (and its unsaved edits) outlives its node view when a move rebuilds the node. */
  slotFor(key: string): HTMLElement
  /** The figure was opened (with its slot) or closed (null). */
  slot(key: string, el: HTMLElement | null): void
}

const OPEN = new PluginKey<string | null>('openFigure')
/** The key of the figure open in place, or null. */
export const openKeyOf = (editor: Editor): string | null => OPEN.getState(editor.state) ?? null
/** Open a figure (or none): a transaction that only moves the decoration. */
export const setOpenKey = (editor: Editor, key: string | null) => editor.view.dispatch(editor.state.tr.setMeta(OPEN, { key }).setMeta('addToHistory', false))

/** Where the figure with this key is, and its node. */
export function findFigure(editor: Editor, key: string): { pos: number; block: Block } | null {
  let found: { pos: number; block: Block } | null = null
  editor.state.doc.descendants((n, pos) => { if (found) return false; if (n.type.name === 'figure' && n.attrs.key === key) found = { pos, block: n.attrs.block as Block }; return n.type.name !== 'figure' })
  return found
}

export const Figure = Node.create<{ host: FigureHost | null }>({
  name: 'figure', group: 'block', atom: true, selectable: true, draggable: false,
  addOptions: () => ({ host: null }),
  addAttributes: () => ({ block: { default: null, rendered: false }, key: { default: '', rendered: false } }),
  renderHTML: () => ['div', { class: 'doc-fig' }],

  addProseMirrorPlugins() {
    return [new Plugin<string | null>({
      key: OPEN,
      state: { init: () => null, apply: (tr, v) => (tr.getMeta(OPEN) ? ((tr.getMeta(OPEN) as { key: string | null }).key) : v) },
      props: { decorations(state) {
        const key = OPEN.getState(state)
        if (!key) return null
        const out: Decoration[] = []
        state.doc.descendants((n, pos) => { if (n.type.name === 'figure' && n.attrs.key === key) out.push(Decoration.node(pos, pos + n.nodeSize, { 'data-figure-open': '' }, { open: true })); return n.type.name !== 'figure' })
        return DecorationSet.create(state.doc, out)
      } },
    })]
  },

  addNodeView() {
    const host = this.options.host
    return ({ node, decorations }) => {
      let block = node.attrs.block as Block, key = String(node.attrs.key), open = false, fit: { disconnect(): void } | null = null, slotEl: HTMLElement | null = null
      const theme = host?.theme() ?? 'paper', tmp = document.createElement('div')
      tmp.innerHTML = blockHTML(block, theme)
      const dom = tmp.firstElementChild as HTMLElement
      const isOpen = (d: readonly Decoration[]) => d.some((x) => (x.spec as { open?: boolean } | undefined)?.open)
      let drawn = 0
      const draw = () => {
        fit?.disconnect(); fit = null
        const html = document.createElement('div'), id = ++drawn
        html.innerHTML = blockHTML(block, host?.theme() ?? 'paper')
        dom.innerHTML = (html.firstElementChild as HTMLElement).innerHTML
        // Figures measure text, as slides do: the fonts first (the read page waits for them too).
        void loadFaces().then(() => {
          if (id !== drawn || open) return
          fit = fitFigures(dom, () => (block.type === 'figure' ? (block as FigureBlock) : null), host?.theme() ?? 'paper', host?.accent())
        })
      }
      const show = (now: boolean) => {
        if (now === open) return
        open = now
        // React draws into a child of its own, which is only let go of (never emptied), so it can unmount its tree cleanly.
        if (now) { fit?.disconnect(); fit = null; dom.innerHTML = ''; slotEl = host?.slotFor(key) ?? document.createElement('div'); dom.appendChild(slotEl); host?.slot(key, slotEl) } else { slotEl?.remove(); slotEl = null; host?.slot(key, null); draw() }
      }
      requestAnimationFrame(() => { if (!open) draw() })
      // A click inside the figure's own edit surface is the editor's (Done closes it; the click must not reopen it).
      dom.addEventListener('click', (e) => { if (!open && !(e.target instanceof Element && (e.target.closest('.fig-checks') || e.target.closest('[data-figure-edit]')))) host?.open(key) })
      // The checks badge is a native <details>; Esc closes it and keeps the focus on it (PM never sees events there).
      dom.addEventListener('keydown', (e) => {
        const badge = e.target instanceof Element ? e.target.closest<HTMLDetailsElement>('details.fig-checks') : null
        if (badge && e.key === 'Escape' && badge.open) { badge.open = false; badge.querySelector('summary')?.focus(); e.stopPropagation() }
      })
      // Select-all in a field of the open figure is that field's: the browser would take the whole page (the page is the
      // outer editing host).
      dom.addEventListener('keydown', (e) => {
        if (!open || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'a' || !(e.target instanceof Element)) return
        const field = e.target.closest('[contenteditable="true"], input, textarea')
        if (!field || field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return
        e.preventDefault()
        const r = document.createRange(); r.selectNodeContents(field)
        const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r)
      })
      show(isOpen(decorations))
      return {
        dom,
        update: (n, d) => {
          if (n.type.name !== 'figure') return false
          const next = n.attrs.block as Block
          if (next.type !== block.type || (next.type === 'figure' && block.type === 'figure' && next.kind !== block.kind)) return false
          const changed = JSON.stringify(next) !== JSON.stringify(block)
          block = next; key = String(n.attrs.key)
          show(isOpen(d))
          if (changed && !open) draw()
          return true
        },
        // While open, every event in the slot is the figure editor's; the checks badge (a <details>) keeps its own keys too.
        stopEvent: (e) => open || (e.target instanceof Element && !!e.target.closest('.fig-checks')),
        ignoreMutation: () => true,
        // A moved figure is destroyed and made again: its slot is only taken out of this node, and the next one takes it.
        destroy: () => { fit?.disconnect(); slotEl?.remove() },
      }
    }
  },
})

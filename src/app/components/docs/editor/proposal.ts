/* In-place proposal preview: decorations mark the block and optionally show a read-style widget. The doc JSON is untouched until Approve. */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Editor } from '@tiptap/core'
import { loadFaces, mountFigure } from '@/engine/docs/mount'
import { blockHTML } from '@/engine/docs/render'
import { parseText } from '@/engine/docs/ops'
import type { Doc, FigureBlock } from '@/engine/docs/types'
import { checkProposal, type DocProposal } from '@/engine/docs/proposals'
import { previewDoc, type ProposalShowing } from '../proposal-preview'
import { blockIdsInOrder } from '../proposal-preview'
import { entries } from './structure'
import { byFirstBlock, suggestionMark } from '../suggestionMarks'

export interface ProposalView {
  /** The suggestion shown in place; null when none is open. */
  proposal: DocProposal | null
  showing: ProposalShowing
  canEdit: boolean
  /** Every suggestion, each marked in the margin beside its block; a mark opens it. */
  marks?: { list: DocProposal[]; open: (p: DocProposal) => void }
}

export interface ProposalOptions {
  getDoc: () => Doc
  view: () => ProposalView | null
  theme: () => 'ink' | 'paper'
  accent: () => string | undefined
}

const KEY = new PluginKey('proposalDecor')

export function refreshProposalDecorations(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(KEY, 1).setMeta('addToHistory', false))
}

const previewHTML = (proposal: DocProposal, doc: Doc, theme: 'ink' | 'paper') => {
  // A suggestion that no longer applies (its block changed, or it breaks a rule) says so; it never takes the editor down.
  let shown: Doc
  try { shown = previewDoc(doc, proposal, 'suggestion') } catch (e) { return `<p class="doc-proposal-note">${e instanceof Error ? e.message : 'This suggestion no longer applies.'}</p>` }
  if (proposal.markdown) {
    const parsed = parseText(proposal.markdown)
    if (typeof parsed === 'string') return `<p class="doc-proposal-note">${parsed}</p>`
    return parsed.map((b) => blockHTML(b, theme)).join('')
  }
  if (proposal.figure) {
    const hit = shown.blocks.find((b): b is FigureBlock => b.type === 'figure' && b.kind === proposal.figure?.kind)
    const block: FigureBlock = hit ?? { type: 'figure', kind: proposal.figure.kind, id: 'preview', body: proposal.figure.body }
    return blockHTML(block, theme)
  }
  return ''
}

const mountFigures = (root: HTMLElement, proposal: DocProposal, theme: 'ink' | 'paper', accent: string | undefined) => {
  if (!proposal.figure) return
  const block: FigureBlock = { type: 'figure', kind: proposal.figure.kind, id: 'preview', body: proposal.figure.body }
  for (const frame of root.querySelectorAll<HTMLElement>('.doc-fig > .fig-frame')) {
    void loadFaces().then(() => mountFigure(frame, block, theme, accent))
  }
}

const entryRange = (doc: Doc, blockIds: string[]) => {
  const order = blockIdsInOrder(doc)
  const indices = blockIds.map((id) => order.indexOf(id)).filter((i) => i >= 0).sort((a, b) => a - b)
  if (!indices.length) return null
  return { from: indices[0], to: indices[indices.length - 1] }
}

export const ProposalPreview = Extension.create<ProposalOptions>({
  name: 'proposalPreview',
  addOptions: () => ({ getDoc: () => ({ title: '', blocks: [] }), view: () => null, theme: () => 'ink', accent: () => undefined }),

  addProseMirrorPlugins() {
    const opt = () => this.options
    return [new Plugin({
      key: KEY,
      state: { init: () => 0, apply: (tr, n) => (tr.getMeta(KEY) !== undefined ? n + 1 : n) },
      props: {
        decorations(state) {
          const view = opt().view()
          if (!view) return DecorationSet.empty
          const doc = opt().getDoc()
          const flat = entries(state.doc)
          const decs: Decoration[] = []
          // Margin marks: every suggested block but the one open.
          if (view.marks) {
            const order = blockIdsInOrder(doc), open = view.marks.open
            for (const [id, list] of byFirstBlock(view.marks.list)) {
              const e = flat[order.indexOf(id)]
              if (!e || view.proposal?.blockIds[0] === id) continue
              decs.push(Decoration.widget(e.pos, () => suggestionMark(list, open), { side: -1, key: `sugg-${list.map((p) => p.id).join('-')}`, stopEvent: () => true, ignoreSelection: true }))
            }
          }
          if (!view.proposal) return DecorationSet.create(state.doc, decs)
          const range = entryRange(doc, view.proposal.blockIds)
          if (!range) return DecorationSet.create(state.doc, decs)
          const theme = opt().theme()
          const accent = opt().accent()
          const checked = checkProposal(doc, view.proposal)
          const mode = checked.ok ? checked.mode : view.proposal.mode
          const swapIn = view.showing === 'suggestion' && mode === 'replace'
          for (let i = range.from; i <= range.to; i++) {
            const e = flat[i]
            if (!e) continue
            decs.push(Decoration.node(e.pos, e.pos + e.node.nodeSize, { class: swapIn ? 'doc-proposal-hidden' : 'doc-proposal-marked' }))
          }
          const start = flat[range.from]
          if (!start) return DecorationSet.create(state.doc, decs)
          if (view.showing === 'suggestion') {
            const wrap = document.createElement('div')
            wrap.className = 'doc-proposal-widget'
            const chip = document.createElement('p')
            chip.className = 'doc-proposal-chip'
            chip.textContent = `✦ ${view.proposal.label}`
            const body = document.createElement('div')
            body.className = 'doc-proposal-body'
            body.innerHTML = previewHTML(view.proposal, doc, theme)
            mountFigures(body, view.proposal, theme, accent)
            wrap.append(chip, body)
            decs.push(Decoration.widget(start.pos, wrap, { side: -1 }))
          } else if (view.canEdit) {
            const chip = document.createElement('p')
            chip.className = 'doc-proposal-chip'
            chip.textContent = `✦ ${view.proposal.label}`
            decs.push(Decoration.widget(start.pos, chip, { side: -1 }))
          }
          return DecorationSet.create(state.doc, decs)
        },
      },
    })]
  },
})

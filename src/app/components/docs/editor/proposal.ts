/* In-place proposal preview: decorations mark the block and optionally show a read-style widget. The doc JSON is untouched until Approve. */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Editor } from '@tiptap/core'
import { blockHTML } from '@/engine/docs/render'
import { parseText } from '@/engine/docs/ops'
import type { Doc, FigureBlock } from '@/engine/docs/types'
import type { DocProposal } from '@/engine/docs/proposals'
import { previewDoc, type ProposalShowing } from '../proposal-preview'
import { blockIdsInOrder } from '../proposal-preview'
import { entries } from './structure'

export interface ProposalView {
  proposal: DocProposal
  showing: ProposalShowing
  canEdit: boolean
}

export interface ProposalOptions {
  getDoc: () => Doc
  view: () => ProposalView | null
  theme: () => 'ink' | 'paper'
}

const KEY = new PluginKey('proposalDecor')

export function refreshProposalDecorations(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(KEY, 1).setMeta('addToHistory', false))
}

const previewHTML = (proposal: DocProposal, doc: Doc, theme: 'ink' | 'paper') => {
  const shown = previewDoc(doc, proposal, 'suggestion')
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

const entryRange = (doc: Doc, blockIds: string[]) => {
  const order = blockIdsInOrder(doc)
  const indices = blockIds.map((id) => order.indexOf(id)).filter((i) => i >= 0).sort((a, b) => a - b)
  if (!indices.length) return null
  return { from: indices[0], to: indices[indices.length - 1] }
}

export const ProposalPreview = Extension.create<ProposalOptions>({
  name: 'proposalPreview',
  addOptions: () => ({ getDoc: () => ({ title: '', blocks: [] }), view: () => null, theme: () => 'ink' }),

  addProseMirrorPlugins() {
    const opt = () => this.options
    return [new Plugin({
      key: KEY,
      state: { init: () => 0, apply: (tr, n) => (tr.getMeta(KEY) !== undefined ? n + 1 : n) },
      props: {
        decorations(state) {
          const view = opt().view()
          if (!view?.proposal) return DecorationSet.empty
          const doc = opt().getDoc()
          const range = entryRange(doc, view.proposal.blockIds)
          if (!range) return DecorationSet.empty
          const flat = entries(state.doc)
          const decs: Decoration[] = []
          const theme = opt().theme()
          for (let i = range.from; i <= range.to; i++) {
            const e = flat[i]
            if (!e) continue
            const hide = view.showing === 'suggestion'
            decs.push(Decoration.node(e.pos, e.pos + e.node.nodeSize, { class: hide ? 'doc-proposal-hidden' : 'doc-proposal-marked' }))
          }
          const start = flat[range.from]
          if (!start) return DecorationSet.create(state.doc, decs)
          if (view.showing === 'suggestion') {
            const wrap = document.createElement('div')
            wrap.className = 'doc-proposal-widget'
            wrap.innerHTML = `<p class="doc-proposal-chip">✦ ${view.proposal.label}</p><div class="doc-proposal-body">${previewHTML(view.proposal, doc, theme)}</div>`
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

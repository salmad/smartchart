/* Proposal preview and approve: the live doc JSON stays until Approve runs applyProposal. */
import { applyProposal, checkProposal, type DocProposal } from '@/engine/docs/proposals'
import { identify } from '@/engine/docs/ops'
import type { Doc } from '@/engine/docs/types'

export type ProposalShowing = 'original' | 'suggestion'

export function keepsLabel(doc: Doc, p: DocProposal): string {
  const checked = checkProposal(doc, p)
  if (!checked.ok) return ''
  if (p.markdown) return 'every word kept'
  if (checked.keeps.keeps === 'all') return 'every word kept'
  if (checked.keeps.keeps === 'facts') return 'condensed'
  return 'adds above'
}

export function keepsTitle(doc: Doc, p: DocProposal): string | undefined {
  const checked = checkProposal(doc, p)
  if (!checked.ok || !checked.keeps.dropped.length) return undefined
  const list = checked.keeps.dropped
  return `Leaves out: ${list.slice(0, 12).join(', ')}${list.length > 12 ? '…' : ''}`
}

/** Preview doc for rendering only; the stored doc is unchanged until Approve. */
export function previewDoc(base: Doc, p: DocProposal, showing: ProposalShowing): Doc {
  if (showing === 'original') return base
  return applyProposal(base, p)
}

export function proposalsForBlock(blockId: string, list: DocProposal[]): DocProposal[] {
  return list.filter((p) => p.blockIds.includes(blockId))
}

export function blockIdsInOrder(doc: Doc): string[] {
  const byBlock = new Map(identify(doc).map((x) => [x.block, x.id]))
  return doc.blocks.map((b) => {
    if (b.type === 'figure' || (b.type === 'heading' && b.level === 2)) return b.id
    return byBlock.get(b) ?? ''
  }).filter(Boolean)
}

export function showProposalControls(canEdit: boolean): boolean {
  return canEdit
}

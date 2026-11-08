/* The Checks panel's state for DocScreen: checks and suggestions, dismissals, fixes, the picked check and the figure
   badges that open it. */
import { useCallback } from 'react'
import { proposeDoc } from '@/engine/agent/propose'
import type { DocProposal } from '@/engine/docs/proposals'
import type { Doc } from '@/engine/docs/types'
import type { DocRepo } from '@/app/docs'
import type { RowActions } from './CheckList'
import { checkKey } from '@/engine/docs/checks'
import { useCheckActions, useQuietChecks } from './useCheckActions'
import { useDocProposals } from './useDocProposals'
import { useFigureBadges } from './useFigureBadges'

interface Options {
  docs: DocRepo
  id: string
  doc: Doc | null
  canEdit: boolean
  /** The page the doc is drawn in (read view or editor): badges are found and blocks are shown there. */
  root: HTMLElement | null
  fixBlocked: string | null
  turn: (text: string, shown: string) => Promise<string | null>
  /** Scroll to a block and ring it; null clears the ring. */
  show: (blockId: string | null) => void
  /** Open the Checks panel (from a figure's badge). */
  openPanel: () => void
  onReview: (p: DocProposal) => void
}

export function useDocChecks({ docs, id, doc, canEdit, root, fixBlocked, turn, show, openPanel, onReview }: Options) {
  const loadStored = useCallback(() => docs.proposals(id), [docs, id])
  const dismissStored = useCallback((pid: string) => docs.proposal(id, { dismiss: pid }), [docs, id])
  const { quiet, setQuiet, error } = useQuietChecks(docs, id)
  const state = useDocProposals({ docId: id, doc, rev: docs.known(id), canEdit, loadStored, dismissStored, quiet, proposeDoc })
  const acts = useCheckActions({ docId: id, fixBlocked, turn, refreshStored: state.refreshStored })

  const { select } = acts
  const pickKey = useCallback((key: string | null) => {
    select(key)
    const c = key ? state.checks.find((x) => checkKey(x) === key) : null
    show(c && c.blockId !== 'doc' ? c.blockId : null)
  }, [select, state.checks, show])
  const fromBadge = useCallback((key: string) => { openPanel(); pickKey(key) }, [openPanel, pickKey])
  useFigureBadges(root, quiet, fromBadge)

  const actions: RowActions = {
    selected: acts.selected,
    onSelect: (row) => pickKey(row?.key ?? null),
    onShow: (blockId) => show(blockId),
    canEdit,
    fixBlocked: acts.fixBlocked,
    fixes: acts.fixes,
    onFix: (row, label) => void acts.fix(row.check, label),
    onQuiet: (key, on) => { if (on) { select(null); show(null) } void setQuiet(key, on) },
    onReview,
  }
  /** The panel closed: nothing picked, no ring. */
  const reset = useCallback(() => { select(null); show(null) }, [select, show])
  return { state, quiet, error, actions, reset }
}

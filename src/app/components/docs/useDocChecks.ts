/* The Checks panel's state for DocScreen: checks and suggestions, dismissals, fixes, the picked check and the figure
   badges that open it. */
import { useCallback, type MutableRefObject } from 'react'
import { sendDocTurn } from '@/app/doc-turn'
import type { ChatMessage } from '@/engine/agent/llm'
import type { Message } from '@/app/store'
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
  /** What stops Occam taking a fix now. */
  gate: { editing: boolean; live: boolean; busy: boolean }
  /** The doc chat: a fix is a turn there (propose-only), so the writer sees it. */
  chat: { history: MutableRefObject<ChatMessage[]>; setMessages: (fn: (m: Message[]) => Message[]) => void; setBusy: (b: boolean) => void }
  /** Scroll to a block and ring it; null clears the ring. */
  show: (blockId: string | null) => void
  /** Open the Checks panel (from a figure's badge). */
  openPanel: () => void
  onReview: (p: DocProposal) => void
}

export function useDocChecks({ docs, id, doc, canEdit, root, gate, chat, show, openPanel, onReview }: Options) {
  const fixBlocked = !canEdit ? 'Only editors can ask Occam to fix a check.' : gate.editing ? 'Save or discard your changes to ask Occam.'
    : !gate.live ? 'Occam’s models are offline right now.' : gate.busy ? 'Occam is answering in the chat; try again when it’s done.' : null
  const { history, setMessages, setBusy } = chat
  const turn = useCallback((text: string, shown: string) => {
    setBusy(true)
    return sendDocTurn(text, { docId: id, mode: 'propose', shown, getHistory: () => history.current, setHistory: (h) => { history.current = h }, setMessages, onDone: () => {} }).finally(() => setBusy(false))
  }, [id, history, setMessages, setBusy])
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

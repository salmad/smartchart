/* Edit mode for a doc: the draft, the editor page and its bar, ⌘S / ⌘Z, and asking before changes are dropped. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Doc } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import type { DocProposal } from '@/engine/docs/proposals'
import { applyProposal } from '@/engine/docs/proposals'
import { toProse } from '@/engine/docs/prose'
import { DocEditor } from './DocEditor'
import { EditBar } from './DocBar'
import { ProposalBar } from './ProposalBar'
import { proposalsForBlock, type ProposalShowing } from './proposal-preview'
import { useDocEdit } from './useDocEdit'
import { serializeDoc } from '@/engine/docs/serialize'

interface Props {
  doc: Doc
  docId: string
  look: { theme: Theme; accent: string | undefined }
  /** Null when saved; otherwise why not, as a sentence. */
  save: (doc: Doc, opts?: { label?: string }) => Promise<string | null>
  onDone: () => void
  /** Someone else saved a newer version, or this save was refused for it. */
  stale: { by: string | null; onReload: () => void; refused: boolean } | null
  comments: { open: boolean; count: number; onToggle: () => void }
  checks?: { open: boolean; count: number; pass: boolean; onToggle: () => void }
  proposals?: DocProposal[]
  activeProposal?: DocProposal | null
  onActiveProposal?: (p: DocProposal | null) => void
  onDismissProposal?: (id: string) => Promise<void>
  children: (bar: ReactNode, page: ReactNode) => ReactNode
}

export function DocEditing({ doc, docId, look, save, onDone, stale, comments, checks, proposals = [], activeProposal = null, onActiveProposal, onDismissProposal, children }: Props) {
  const [showing, setShowing] = useState<ProposalShowing>('suggestion')
  const [proposalIndex, setProposalIndex] = useState(0)
  const [proposalBusy, setProposalBusy] = useState(false)
  const grouped = useMemo(() => (activeProposal ? proposalsForBlock(activeProposal.blockIds[0], proposals) : []), [activeProposal, proposals])
  const active = grouped[proposalIndex] ?? activeProposal
  useEffect(() => { setProposalIndex(Math.max(0, grouped.findIndex((p) => p.id === activeProposal?.id))); setShowing('suggestion') }, [activeProposal?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- reset only when another suggestion is picked
  const [tick, setTick] = useState(0)
  useEffect(() => setTick((n) => n + 1), [active?.id, showing])
  const proposalView = useMemo(() => () => (active ? { proposal: active, showing, canEdit: true } : null), [active, showing])
  const edit = useDocEdit({ doc, theme: look.theme, accent: look.accent, save, onDone, proposalView, proposalTick: tick })
  const discard = useCallback(() => { if (!edit.dirty || window.confirm('Discard your changes to this doc?')) edit.discard() }, [edit])

  // The words as they would be saved, for the clipboard.
  const copyText = useCallback(async () => {
    try { const d = edit.current(); if (!d) return false; await navigator.clipboard.writeText(serializeDoc(d)); return true } catch { return false }
  }, [edit])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || edit.saving) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') { e.preventDefault(); void edit.save(); return }
    }
    const leave = (e: BeforeUnloadEvent) => { if (edit.dirty) e.preventDefault() }
    document.addEventListener('keydown', key); window.addEventListener('beforeunload', leave)
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave) }
  }, [edit])

  const approve = async () => {
    if (!active) return
    const cur = edit.current()
    if (!cur) return
    let next: Doc
    // The block was edited since the suggestion was made: its id is gone, so the suggestion no longer applies.
    try { next = applyProposal(cur, active) } catch { await onDismissProposal?.(active.id); onActiveProposal?.(null); return }
    setProposalBusy(true)
    try {
      edit.editor?.commands.setContent(toProse({ title: next.title, subtitle: next.subtitle ?? '', blocks: next.blocks }))
      const why = await save(next, { label: `Suggestion: ${active.label}` })
      if (!why) { await onDismissProposal?.(active.id); onActiveProposal?.(null) }
    } finally { setProposalBusy(false) }
  }
  const cancel = async () => {
    if (!active) return
    await onDismissProposal?.(active.id)
    onActiveProposal?.(null)
  }

  return (
    <>
      {children(
        <EditBar edit={edit} onDiscard={discard} checks={checks} comments={comments} stale={stale && { ...stale, onCopy: copyText }} />,
        <>
          <DocEditor edit={edit} theme={look.theme} accent={look.accent} docId={docId} />
          {active && <ProposalBar proposals={grouped.length ? grouped : [active]} active={active} index={proposalIndex} showing={showing} canEdit
            busy={proposalBusy} keepsDoc={edit.current() ?? doc} onShowing={setShowing} onIndex={setProposalIndex} onApprove={() => void approve()} onCancel={() => void cancel()} />}
        </>,
      )}
    </>
  )
}

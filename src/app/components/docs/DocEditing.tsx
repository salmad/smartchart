/* Edit mode for a doc: the draft, the editor page and its bar, ⌘S / ⌘Z, and asking before changes are dropped. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { DISCARD_CHANGES, useConfirm } from '../ConfirmDialog'
import type { ProposalView } from './editor/proposal'
import { serializeDoc } from '@/engine/docs/serialize'
import { parseDoc } from '@/engine/docs/parse'
import { SourceEditor } from '../SourceEditor'
import { docBlockSuggestionsEnabled } from '@/app/features'

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
  checks?: { open: boolean; count: number; pass: boolean; label?: string; onToggle: () => void }
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
  useEffect(() => setTick((n) => n + 1), [active?.id, showing, proposals])
  // Every suggestion has a margin mark; one opened shows in place.
  // Read through a ref, so the editor (built with this function) is never made again when a suggestion comes or goes.
  const viewNow = useRef<ProposalView>({ proposal: null, showing, canEdit: true })
  const marksOn = docBlockSuggestionsEnabled()
  viewNow.current = {
    proposal: active ?? null, showing, canEdit: true,
    ...(marksOn ? { marks: { list: proposals, open: (p: DocProposal) => onActiveProposal?.(p) } } : {}),
  }
  const proposalView = useCallback(() => viewNow.current, [])
  const edit = useDocEdit({ doc, theme: look.theme, accent: look.accent, save, onDone, proposalView, proposalTick: tick })
  const [confirm, ask] = useConfirm()
  const discard = useCallback(() => {
    if (!edit.dirty) { edit.discard(); return }
    void ask(DISCARD_CHANGES('this doc')).then((yes) => { if (yes) edit.discard() })
  }, [edit, ask])

  // The doc's file while it is shown in place of the page (null on the page). Lines that don't parse are kept as they
  // are and listed; nothing is refused.
  const [source, setSource] = useState<{ text: string; from: string } | null>(null)
  const sourceNotes = useMemo(() => (source ? parseDoc(source.text).errors : []), [source])
  /** The file's words into the editor (one undo step), when they changed. */
  const applySource = useCallback(() => {
    if (!source || source.text === source.from || !edit.editor) return
    const d = parseDoc(source.text).doc
    edit.editor.commands.setContent(toProse({ title: d.title, subtitle: d.subtitle ?? '', blocks: d.blocks }))
  }, [source, edit.editor])
  const toggleSource = useCallback(() => {
    if (source) { applySource(); setSource(null); return }
    const d = edit.current()
    if (!d) return
    edit.openFigure(null)
    const text = serializeDoc(d)
    setSource({ text, from: text })
  }, [source, applySource, edit])
  const saveNow = useCallback(() => { applySource(); void edit.save() }, [applySource, edit])

  // The words as they would be saved, for the clipboard.
  const copyText = useCallback(async () => {
    try {
      const text = source?.text ?? (() => { const d = edit.current(); return d && serializeDoc(d) })()
      if (!text) return false
      await navigator.clipboard.writeText(text); return true
    } catch { return false }
  }, [edit, source])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || edit.saving) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') { e.preventDefault(); saveNow(); return }
    }
    const leave = (e: BeforeUnloadEvent) => { if (edit.dirty) e.preventDefault() }
    document.addEventListener('keydown', key); window.addEventListener('beforeunload', leave)
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave) }
  }, [edit, saveNow])

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
      {confirm}
      {children(
        <EditBar edit={edit} onDiscard={discard} onSave={saveNow} checks={checks} comments={comments} stale={stale && { ...stale, onCopy: copyText }}
          source={{ open: !!source, onToggle: toggleSource }} />,
        <>
          {source && (
            <div className="mx-auto flex h-full w-full max-w-[860px] px-8 py-6 max-[900px]:px-4">
              <SourceEditor label="Doc source" value={source.text} onChange={(text) => setSource({ ...source, text })} error={null} notes={sourceNotes} />
            </div>
          )}
          {/* Kept while the file is open: the editor holds the draft and its undo. */}
          <div hidden={!!source}><DocEditor edit={edit} theme={look.theme} accent={look.accent} docId={docId} /></div>
          {active && <ProposalBar proposals={grouped.length ? grouped : [active]} active={active} index={proposalIndex} showing={showing} canEdit
            busy={proposalBusy} keepsDoc={edit.current() ?? doc} onShowing={setShowing} onIndex={setProposalIndex} onApprove={() => void approve()} onCancel={() => void cancel()} />}
        </>,
      )}
    </>
  )
}

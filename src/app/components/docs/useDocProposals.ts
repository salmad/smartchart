/* Doc checks and suggestions: code checks on every doc; Occam's suggestions when an editor opens it (one model call per
   change, kept in this browser); agent suggestions from the server. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { proposeDoc as defaultProposeDoc } from '@/engine/agent/propose'
import { checkDoc, checkKey, type DocCheck } from '@/engine/docs/checks'
import { identify } from '@/engine/docs/ops'
import type { DocProposal } from '@/engine/docs/proposals'
import type { Doc } from '@/engine/docs/types'
import { docBlockSuggestionsEnabled } from '@/app/features'
import { dropSuggestion, keepSuggestions, keptSuggestions, suggestionSig } from './occamCache'

type ProposeFn = typeof defaultProposeDoc

export function proposalsInDoc(doc: Doc, list: DocProposal[]): DocProposal[] {
  const ids = new Set(identify(doc).map((x) => x.id))
  return list.filter((p) => p.blockIds.length > 0 && p.blockIds.every((id) => ids.has(id)))
}

const mergeProposals = (stored: DocProposal[], occam: DocProposal[]) => [...stored, ...occam]

/** The one count the bar and the panel both show: open checks (failed, not dismissed) and suggestions, and each part. */
export function badgeFor(checks: DocCheck[], proposalCount: number, quiet: ReadonlySet<string> = new Set()): { count: number; pass: boolean; checks: number; suggestions: number } {
  const failed = checks.filter((c) => !c.ok && !quiet.has(checkKey(c))).length
  const count = failed + proposalCount
  return { count, pass: count === 0, checks: failed, suggestions: proposalCount }
}

/** "2 checks · 1 suggestion", "1 check", "3 suggestions"; empty when there is nothing. */
export function countText(b: { checks: number; suggestions: number }): string {
  const part = (n: number, one: string) => (n ? `${n} ${one}${n === 1 ? '' : 's'}` : '')
  return [part(b.checks, 'check'), part(b.suggestions, 'suggestion')].filter(Boolean).join(' · ')
}

export function createDocProposalsRunner(deps: {
  canEdit: boolean
  proposeDoc: ProposeFn
  fetchStored: () => Promise<DocProposal[]>
}) {
  let occamRev: number | null = null
  let occam: DocProposal[] = []
  return {
    async open(doc: Doc, rev: number) {
      const stored = proposalsInDoc(doc, await deps.fetchStored())
      if (deps.canEdit && occamRev !== rev) {
        occam = proposalsInDoc(doc, await deps.proposeDoc(doc, { rev }))
        occamRev = rev
      }
      if (!deps.canEdit) occam = []
      return { proposals: mergeProposals(stored, occam) }
    },
    reset() { occamRev = null; occam = [] },
    callsForTest: () => (deps.canEdit ? (occamRev !== null ? 1 : 0) : 0),
  }
}

interface Options {
  docId: string
  doc: Doc | null
  rev: number
  canEdit: boolean
  loadStored: () => Promise<DocProposal[]>
  dismissStored: (id: string) => Promise<DocProposal[] | string>
  /** Checks a writer dismissed (checkKey): left out of the count. */
  quiet?: ReadonlySet<string>
  /** The models answer: Occam's suggestions are asked for only then. */
  live?: boolean
  proposeDoc?: ProposeFn
}

const NONE: ReadonlySet<string> = new Set()

export function useDocProposals({ docId, doc, rev, canEdit, loadStored, dismissStored, quiet = NONE, live = true, proposeDoc = defaultProposeDoc }: Options) {
  const [checks, setChecks] = useState<DocCheck[]>([])
  const [stored, setStored] = useState<DocProposal[]>([])
  const [occam, setOccam] = useState<DocProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const runRef = useRef<AbortController | null>(null)
  const revRef = useRef(rev)
  revRef.current = rev

  useEffect(() => {
    if (!doc) { setChecks([]); return }
    let go = true
    void checkDoc(doc).then((c) => { if (go) setChecks(c) })
    return () => { go = false }
  }, [doc])

  useEffect(() => {
    let go = true
    void loadStored().then((p) => { if (go && doc) setStored(proposalsInDoc(doc, p)) })
    return () => { go = false }
  }, [docId, doc, loadStored])

  // Occam's suggestions, as soon as an editor has the doc: from this browser when made for these blocks and dismissed
  // checks, else one model call (none when the doc reads well). A newer doc aborts the call.
  const occamOn = docBlockSuggestionsEnabled()

  useEffect(() => {
    runRef.current?.abort()
    if (!doc || !canEdit || !occamOn) { setOccam([]); setLoading(false); return }
    const sig = suggestionSig(doc, quiet), kept = keptSuggestions(docId, sig)
    if (kept) { setOccam(proposalsInDoc(doc, kept)); setLoading(false); return }
    setOccam([])
    if (!live) { setLoading(false); return }
    const ctl = new AbortController()
    runRef.current = ctl
    setLoading(true)
    void proposeDoc(doc, { rev: revRef.current, signal: ctl.signal, quiet })
      .then((list) => { if (ctl.signal.aborted) return; const next = proposalsInDoc(doc, list); keepSuggestions(docId, sig, next); setOccam(next) })
      .catch(() => { if (!ctl.signal.aborted) setOccam([]) })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false) })
    return () => ctl.abort()
  }, [docId, doc, canEdit, quiet, live, proposeDoc, occamOn])

  const verdict = useMemo(() => checks.find((c) => c.id === 'D7') ?? null, [checks])
  const readability = useMemo(() => checks.filter((c) => /^D[4-7]$/.test(c.id)), [checks])
  const figures = useMemo(() => checks.filter((c) => !/^D[4-7]$/.test(c.id)), [checks])
  const proposals = useMemo(() => mergeProposals(stored, occam), [stored, occam])
  const badge = useMemo(() => badgeFor(checks, proposals.length, quiet), [checks, proposals.length, quiet])

  /** The stored suggestions read again (after an agent left one), shown and returned. */
  const refreshStored = useCallback(async () => {
    const list = doc ? proposalsInDoc(doc, await loadStored()) : []
    setStored(list)
    return list
  }, [doc, loadStored])

  /** The panel opened: agents' suggestions read again (Occam's are already in hand). */
  const openPanel = useCallback(async () => {
    if (!doc) return
    setOpen(true)
    setStored(proposalsInDoc(doc, await loadStored()))
  }, [doc, loadStored])

  const dismiss = useCallback(async (id: string) => {
    if (!stored.some((p) => p.id === id)) { dropSuggestion(docId, id); setOccam((list) => list.filter((p) => p.id !== id)); return }
    const r = await dismissStored(id)
    if (typeof r === 'string') return
    setStored(doc ? proposalsInDoc(doc, r) : r)
  }, [dismissStored, doc, stored, docId])

  return {
    open,
    setOpen,
    openPanel,
    loading,
    checks,
    readability,
    figures,
    verdict,
    proposals,
    badge,
    dismiss,
    refreshStored,
    occamOn,
  }
}

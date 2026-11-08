/* Doc checks and suggestions: code verdict on every doc; Occam proposals on open (editors only); agent rows from the server. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { proposeDoc as defaultProposeDoc } from '@/engine/agent/propose'
import { checkDoc, checkKey, type DocCheck } from '@/engine/docs/checks'
import { identify } from '@/engine/docs/ops'
import type { DocProposal } from '@/engine/docs/proposals'
import type { Doc } from '@/engine/docs/types'

type ProposeFn = typeof defaultProposeDoc

export function proposalsInDoc(doc: Doc, list: DocProposal[]): DocProposal[] {
  const ids = new Set(identify(doc).map((x) => x.id))
  return list.filter((p) => p.blockIds.length > 0 && p.blockIds.every((id) => ids.has(id)))
}

const mergeProposals = (stored: DocProposal[], occam: DocProposal[]) => [...stored, ...occam]

/** The one count the bar and the panel both show: open checks (failed, not dismissed) and stored suggestions. */
export function badgeFor(checks: DocCheck[], proposalCount: number, quiet: ReadonlySet<string> = new Set()): { count: number; pass: boolean } {
  const failed = checks.filter((c) => !c.ok && !quiet.has(checkKey(c))).length
  const count = failed + proposalCount
  return { count, pass: count === 0 }
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
  proposeDoc?: ProposeFn
}

const NONE: ReadonlySet<string> = new Set()

export function useDocProposals({ docId, doc, rev, canEdit, loadStored, dismissStored, quiet = NONE, proposeDoc = defaultProposeDoc }: Options) {
  const [checks, setChecks] = useState<DocCheck[]>([])
  const [stored, setStored] = useState<DocProposal[]>([])
  const [occam, setOccam] = useState<DocProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const occamRev = useRef<number | null>(null)
  const runRef = useRef<AbortController | null>(null)

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

  // A new revision, or a check dismissed or restored: Occam's suggestions are asked for again on the next open.
  useEffect(() => {
    occamRev.current = null
    runRef.current?.abort()
    setOccam([])
  }, [docId, rev, quiet])

  const verdict = useMemo(() => checks.find((c) => c.id === 'D7') ?? null, [checks])
  const readability = useMemo(() => checks.filter((c) => /^D[4-7]$/.test(c.id)), [checks])
  const figures = useMemo(() => checks.filter((c) => !/^D[4-7]$/.test(c.id)), [checks])
  const proposals = useMemo(() => mergeProposals(stored, occam), [stored, occam])
  const badge = useMemo(() => badgeFor(checks, stored.length, quiet), [checks, stored.length, quiet])

  /** The stored suggestions read again (after an agent left one), shown and returned. */
  const refreshStored = useCallback(async () => {
    const list = doc ? proposalsInDoc(doc, await loadStored()) : []
    setStored(list)
    return list
  }, [doc, loadStored])

  const openPanel = useCallback(async () => {
    if (!doc) return
    setOpen(true)
    runRef.current?.abort()
    const ctl = new AbortController()
    runRef.current = ctl
    const freshStored = proposalsInDoc(doc, await loadStored())
    setStored(freshStored)
    if (canEdit && occamRev.current !== rev) {
      setLoading(true)
      try {
        const next = proposalsInDoc(doc, await proposeDoc(doc, { rev, signal: ctl.signal, quiet }))
        if (!ctl.signal.aborted) { setOccam(next); occamRev.current = rev }
      } catch { if (!ctl.signal.aborted) setOccam([]) }
      finally { if (!ctl.signal.aborted) setLoading(false) }
    }
  }, [doc, rev, canEdit, loadStored, proposeDoc, quiet])

  const dismiss = useCallback(async (id: string) => {
    if (!stored.some((p) => p.id === id)) { setOccam((list) => list.filter((p) => p.id !== id)); return }
    const r = await dismissStored(id)
    if (typeof r === 'string') return
    setStored(doc ? proposalsInDoc(doc, r) : r)
  }, [dismissStored, doc, stored])

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
  }
}

/* Doc checks and suggestions: code verdict on every doc; Occam proposals on open (editors only); agent rows from the server. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { proposeDoc as defaultProposeDoc } from '@/engine/agent/propose'
import { checkDoc, type DocCheck } from '@/engine/docs/checks'
import { identify } from '@/engine/docs/ops'
import type { DocProposal } from '@/engine/docs/proposals'
import type { Doc } from '@/engine/docs/types'

type ProposeFn = typeof defaultProposeDoc

export function proposalsInDoc(doc: Doc, list: DocProposal[]): DocProposal[] {
  const ids = new Set(identify(doc).map((x) => x.id))
  return list.filter((p) => p.blockIds.length > 0 && p.blockIds.every((id) => ids.has(id)))
}

const mergeProposals = (stored: DocProposal[], occam: DocProposal[]) => [...stored, ...occam]

export function badgeFor(checks: DocCheck[], proposalCount: number): { count: number; pass: boolean } {
  const failed = checks.filter((c) => !c.ok).length
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
  proposeDoc?: ProposeFn
}

export function useDocProposals({ docId, doc, rev, canEdit, loadStored, dismissStored, proposeDoc = defaultProposeDoc }: Options) {
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

  useEffect(() => {
    occamRev.current = null
    setOccam([])
  }, [docId, rev])

  const verdict = useMemo(() => checks.find((c) => c.id === 'D7') ?? null, [checks])
  const readability = useMemo(() => checks.filter((c) => /^D[4-7]$/.test(c.id)), [checks])
  const figures = useMemo(() => checks.filter((c) => !/^D[4-7]$/.test(c.id)), [checks])
  const proposals = useMemo(() => mergeProposals(stored, occam), [stored, occam])
  const badge = useMemo(() => badgeFor(checks, stored.length), [checks, stored.length])

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
        const next = proposalsInDoc(doc, await proposeDoc(doc, { rev, signal: ctl.signal }))
        if (!ctl.signal.aborted) { setOccam(next); occamRev.current = rev }
      } catch { if (!ctl.signal.aborted) setOccam([]) }
      finally { if (!ctl.signal.aborted) setLoading(false) }
    }
  }, [doc, rev, canEdit, loadStored, proposeDoc])

  const dismiss = useCallback(async (id: string) => {
    const r = await dismissStored(id)
    if (typeof r === 'string') return
    setStored(doc ? proposalsInDoc(doc, r) : r)
  }, [dismissStored, doc])

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
  }
}

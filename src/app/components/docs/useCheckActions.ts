/* What a writer can do with one check: pick it (the doc scrolls to its block and rings it), dismiss it for everyone who
   opens the doc, or ask Occam to fix it. A fix is a propose-only agent turn: it comes back as a suggestion to review,
   never a rewrite. */
import { useCallback, useEffect, useState } from 'react'
import { checkKey, type DocCheck } from '@/engine/docs/checks'
import type { DocProposal } from '@/engine/docs/proposals'
import type { DocRepo } from '@/app/docs'

/** Where a fix stands: Occam at work, the suggestions it left, or what it said when it left none. */
export type FixState = { busy: true } | { busy: false; proposals: DocProposal[]; reply: string | null }

interface Options {
  docs: DocRepo
  docId: string
  /** Why Occam cannot take a fix now, as a sentence; null when it can. */
  fixBlocked: string | null
  /** One propose-only agent turn; its reply, or null when it failed. */
  turn: (text: string, shown: string) => Promise<string | null>
  /** The doc's stored suggestions, read again. */
  refreshStored: () => Promise<DocProposal[]>
}

/** What the agent is told: the check, its block and that the writer agrees. How to fix it is the agent's call. */
export function fixAsk(c: DocCheck, label: string): { text: string; shown: string } {
  const where = c.blockId === 'doc' ? 'the whole doc' : `block ${c.blockId} (${label})`
  return {
    text: `I agree with this check and want it fixed. Check ${c.id} on ${where}: ${c.msg}. Leave the fix as a suggestion I can review.`,
    shown: `Fix: ${c.msg} (${label})`,
  }
}

/** The checks a writer dismissed on this doc, kept with the doc for everyone who opens it. */
export function useQuietChecks(docs: DocRepo, docId: string) {
  const [quiet, setQuietList] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let go = true
    setQuietList(new Set()); setError(null)
    void docs.quiet?.(docId).then((k) => { if (go) setQuietList(new Set(k)) })
    return () => { go = false }
  }, [docs, docId])

  const setQuiet = useCallback(async (key: string, on: boolean) => {
    if (!docs.setQuiet) return
    // Shown at once; put back if the server says no.
    const flip = (add: boolean) => setQuietList((s) => { const n = new Set(s); if (add) n.add(key); else n.delete(key); return n })
    flip(on)
    const r = await docs.setQuiet(docId, { key, on })
    if (typeof r === 'string') { setError(r); flip(!on) } else { setError(null); setQuietList(new Set(r)) }
  }, [docs, docId])
  return { quiet, setQuiet, error }
}

/** The picked check, and the fixes asked for (by checkKey). */
export function useCheckActions({ docId, fixBlocked, turn, refreshStored }: Omit<Options, 'docs'>) {
  const [selected, setSelected] = useState<string | null>(null)
  const [fixes, setFixes] = useState<Record<string, FixState>>({})
  useEffect(() => { setSelected(null); setFixes({}) }, [docId])

  const fix = useCallback(async (c: DocCheck, label: string) => {
    if (fixBlocked) return
    const key = checkKey(c)
    setFixes((f) => ({ ...f, [key]: { busy: true } }))
    const before = new Set((await refreshStored().catch(() => [])).map((p) => p.id))
    const ask = fixAsk(c, label)
    const reply = await turn(ask.text, ask.shown)
    const after = await refreshStored().catch(() => [])
    setFixes((f) => ({ ...f, [key]: { busy: false, proposals: after.filter((p) => !before.has(p.id)), reply } }))
  }, [fixBlocked, turn, refreshStored])

  return { selected, select: setSelected, fixes, fix, fixBlocked }
}

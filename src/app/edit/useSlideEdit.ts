/* The slide being edited: the draft (the truth, changed on every keystroke), the shown slide (re-rendered only on
   structural changes and when a field is left), and the issues measured on the draft, 300 ms after the last change. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyPatch } from '@/engine/agent/patch'
import { ruleChecks } from '@/engine/agent/checks'
import { validate } from '@/engine/slides/schema'
import { issuePath } from '@/engine/slides/edit'
import type { Deck, Slide, Style } from '@/engine/types'
import type { Measurer } from '../measure'
import type { Item } from '../store'

export interface Issue { msg: string; path?: string }
export interface SlideEdit {
  draft: Slide; shown: Slide; dirty: boolean; issues: Issue[]; samples: Set<string>; saving: boolean; error: string | null
  set(path: string, value: string): void
  patch(set: Record<string, unknown>): void
  replace(slide: Slide, samples: string[]): void
  commit(): void
  save(): Promise<void>
  discard(): void
}
interface Options { item: Item; index: number; deck: Deck; style: Style; measurer: () => Measurer; save: (draft: Slide) => Promise<string | null>; onDone: () => void }

const MEASURE_MS = 300

export function useSlideEdit({ item, index, deck, style, measurer, save, onDone }: Options): SlideEdit {
  const draft = useRef(item.slide)
  const [version, setVersion] = useState(0), [shown, setShown] = useState(item.slide)
  const [issues, setIssues] = useState<Issue[]>([]), [samples, setSamples] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)

  const write = useCallback((set: Record<string, unknown>) => {
    const r = applyPatch(draft.current, set)
    if (!r.slide) return false
    draft.current = r.slide
    // A field written by hand is no longer sample text; a whole-list write (a new card, the chart grid) clears the list's.
    const covers = (p: string) => Object.keys(set).some((k) => p === k || p.startsWith(`${k}.`) || p.startsWith(`${k}[`))
    setSamples((s) => ([...s].some(covers) ? new Set([...s].filter((p) => !covers(p))) : s))
    setVersion((v) => v + 1)
    return true
  }, [])

  // Issues on the draft: limits from the schema, fit from the measurer, rules and sample text as counts.
  useEffect(() => {
    const t = setTimeout(() => {
      const d = draft.current, m = measurer()
      let fit: Issue[] = []
      try { m.measure(d, deck, index); fit = m.located } catch (e) { fit = [{ msg: `slide could not be rendered: ${e instanceof Error ? e.message : String(e)}` }] }
      const limits = validate(d, style).errors.map((msg) => ({ msg, path: issuePath(msg) }))
      const rules = ruleChecks(d, style, m.lines).filter((c) => !c.ok).map((c) => ({ msg: `${c.id}: ${c.msg}` }))
      const sample = samples.size ? [{ msg: `${samples.size} field${samples.size === 1 ? '' : 's'} still ${samples.size === 1 ? 'has' : 'have'} sample text` }] : []
      setIssues([...limits, ...fit, ...rules, ...sample])
    }, MEASURE_MS)
    return () => clearTimeout(t)
  }, [version, samples, deck, index, style, measurer])

  const dirty = version > 0
  return useMemo<SlideEdit>(() => ({
    // Read through, not copied: two keystrokes before React re-renders must both see the latest draft.
    get draft() { return draft.current }, shown, dirty, issues, samples, saving, error,
    set: (path, value) => { write({ [path]: value }) },
    patch: (set) => { if (write(set)) setShown(draft.current) },
    replace: (slide, next) => { draft.current = slide; setSamples(new Set(next)); setVersion((v) => v + 1); setShown(slide) },
    commit: () => setShown(draft.current),
    save: async () => {
      setSaving(true); setError(null)
      const reason = await save(draft.current)
      setSaving(false)
      if (reason) setError(reason); else onDone()
    },
    discard: onDone,
  }), [shown, dirty, issues, samples, saving, error, write, save, onDone])
}

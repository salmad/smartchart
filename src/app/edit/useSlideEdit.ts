/* The slide being edited: the draft (the truth, changed on every keystroke), the shown slide (re-rendered only on
   structural changes and when a field is left), and the issues measured on the draft, 300 ms after the last change. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyPatch } from '@/engine/agent/patch'
import { ruleChecks } from '@/engine/agent/checks'
import { validate } from '@/engine/slides/schema'
import { getAt, issuePath } from '@/engine/slides/edit'
import type { Result, Target } from '@/engine/slides/actions'
import type { Deck, Slide, Style } from '@/engine/types'
import type { Measurer } from '../measure'
import type { Item } from '../store'

export interface Issue { msg: string; path?: string }
export interface SlideEdit {
  draft: Slide; shown: Slide; dirty: boolean; issues: Issue[]; samples: Set<string>; saving: boolean; error: string | null
  set(path: string, value: string): void
  /** Writes a patch and re-renders. `focus` is where the cursor goes after: a field's path, or an item's (its first field). */
  patch(set: Record<string, unknown>, focus?: string): void
  /** The cursor request left by the last patch, once. */
  takeFocus(): string | null
  replace(slide: Slide, samples: string[]): void
  commit(): void
  /** What is selected (model coordinates), for the menu, the bar and the keys. */
  target: Target
  setTarget(t: Target): void
  /** Runs an action's result: its patch, then where the cursor or selection goes. */
  apply(r: Result): void
  /** A selection to put back after the slide is redrawn, once. */
  takeSelect(): { path: string; from: number; to: number } | null
  undo(): void
  redo(): void
  canUndo: boolean; canRedo: boolean
  save(): Promise<void>
  discard(): void
}
interface Options { item: Item; index: number; deck: Deck; style: Style; measurer: () => Measurer; save: (draft: Slide) => Promise<string | null>; onDone: () => void }

const MEASURE_MS = 300

export function useSlideEdit({ item, index, deck, style, measurer, save, onDone }: Options): SlideEdit {
  const draft = useRef(item.slide), focus = useRef<string | null>(null), select = useRef<{ path: string; from: number; to: number } | null>(null)
  // History: the drafts before each change (they are immutable, so keeping them is cheap). Typing in one field is one step.
  const past = useRef<Slide[]>([]), future = useRef<Slide[]>([]), lastTyped = useRef<string | null>(null)
  const [target, setTargetState] = useState<Target>({ kind: 'slide' }), [depth, setDepth] = useState({ past: 0, future: 0 })
  const [version, setVersion] = useState(0), [shown, setShown] = useState(item.slide)
  const [issues, setIssues] = useState<Issue[]>([]), [samples, setSamples] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)

  const record = useCallback(() => { past.current.push(draft.current); future.current = []; setDepth({ past: past.current.length, future: 0 }) }, [])

  const write = useCallback((set: Record<string, unknown>) => {
    const before = draft.current, r = applyPatch(before, set)
    if (!r.slide) return false
    draft.current = r.slide
    // A field written by hand is no longer sample text; a whole-list write (a new card, the chart grid) clears the list's,
    // except a reorder: the same items in a new order keep their sample text, at their new places.
    const moved = new Map<string, string>()
    for (const [k, v] of Object.entries(set)) {
      const old = getAt(before, k)
      if (!Array.isArray(v) || !Array.isArray(old) || v.length !== old.length) continue
      const used = new Set<number>()
      old.forEach((o, i) => { const j = v.findIndex((x, n) => !used.has(n) && JSON.stringify(x) === JSON.stringify(o)); if (j >= 0) { used.add(j); moved.set(`${k}[${i}]`, `${k}[${j}]`) } })
    }
    const covers = (p: string) => Object.keys(set).some((k) => p === k || p.startsWith(`${k}.`) || p.startsWith(`${k}[`))
    const remap = (p: string) => { for (const [from, to] of moved) if (p === from || p.startsWith(`${from}.`) || p.startsWith(`${from}[`)) return to + p.slice(from.length); return null }
    setSamples((s) => {
      const next = new Set<string>()
      for (const p of s) { const m = remap(p); if (m) next.add(m); else if (!covers(p)) next.add(p) }
      return [...s].some(covers) || moved.size ? next : s
    })
    setVersion((v) => v + 1)
    return true
  }, [])

  const restore = useCallback((slide: Slide) => { draft.current = slide; lastTyped.current = null; setVersion((v) => v + 1); setShown(slide); setTargetState({ kind: 'slide' }) }, [])

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
    set: (path, value) => { if (lastTyped.current !== path) record(); lastTyped.current = path; write({ [path]: value }) },
    patch: (set, at) => { record(); lastTyped.current = null; if (write(set)) { focus.current = at ?? null; setShown(draft.current) } else past.current.pop() },
    target, setTarget: setTargetState,
    apply: (r) => {
      record(); lastTyped.current = null
      if (!write(r.set)) { past.current.pop(); return }
      focus.current = r.focus ?? null
      if (r.target) setTargetState(r.target)
      else if (target.kind === 'text') select.current = { path: target.path, from: target.from, to: target.to }
      setShown(draft.current)
    },
    takeSelect: () => { const x = select.current; select.current = null; return x },
    undo: () => { const prev = past.current.pop(); if (!prev) return; future.current.push(draft.current); setDepth({ past: past.current.length, future: future.current.length }); restore(prev) },
    redo: () => { const next = future.current.pop(); if (!next) return; past.current.push(draft.current); setDepth({ past: past.current.length, future: future.current.length }); restore(next) },
    canUndo: depth.past > 0, canRedo: depth.future > 0,
    takeFocus: () => { const f = focus.current; focus.current = null; return f },
    replace: (slide, next) => { record(); draft.current = slide; setSamples(new Set(next)); setVersion((v) => v + 1); setShown(slide) },
    commit: () => setShown(draft.current),
    save: async () => {
      setSaving(true); setError(null)
      const reason = await save(draft.current)
      setSaving(false)
      if (reason) setError(reason); else onDone()
    },
    discard: onDone,
  }), [shown, dirty, issues, samples, saving, error, write, save, onDone, target, depth, record, restore])
}

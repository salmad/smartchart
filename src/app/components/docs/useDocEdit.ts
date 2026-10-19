/* The doc being edited: the draft (the truth, changed on every keystroke) and the shown draft (redrawn only on structural
   changes: a split, a join, a new block). Blocks carry keys in memory only; Save tidies, names new headings and writes
   the file. Typing in one field is one undo step, as in slide edit mode. */
import { useCallback, useMemo, useRef, useState } from 'react'
import { keyed, unkeyed, type Keyed } from '@/engine/docs/blocks'
import { tidy } from '@/engine/docs/lists'
import { giveIds } from '@/engine/docs/parse'
import { plainOf } from '@/engine/slides/markup'
import type { Block, Doc, FigureBody } from '@/engine/docs/types'

export interface Draft { title: string; subtitle: string; blocks: Keyed[] }
/** Where the cursor goes after a redraw: a field (a block, or one of a list's items) at a plain-text offset, or a block selected. */
export type Focus = { key: string; item?: number; at: number } | { key: string; select: true }
export type HeadField = 'title' | 'subtitle'

export interface DocEdit {
  draft: Draft; shown: Draft; dirty: boolean; saving: boolean; error: string | null
  /** Typing: one block's markup (or one item's), no redraw. */
  setText(key: string, markup: string, item?: number): void
  setHead(field: HeadField, markup: string): void
  /** A structural change: the new list is drawn, then the cursor goes to `focus`. */
  apply(list: Keyed[], focus?: Focus): void
  /** A mark or link: one undo step, the field redrawn in place by the caller. */
  mark(key: string | HeadField, markup: string, item?: number): void
  takeFocus(): Focus | null
  /** Back or forward one step, the page redrawn; the cursor goes to `focus` (the field it was in). */
  undo(focus?: Focus): void; redo(focus?: Focus): void; canUndo: boolean; canRedo: boolean
  save(): Promise<void>
  discard(): void
  /** The figure open in place, by key. Opening another, or saving, first runs the open one's Done: if that refuses
      (the figure has an error), nothing else happens. */
  figure: string | null
  openFigure(key: string | null): void
  /** The open figure's Done, held while it is open: it writes the figure back (or not) and says why not, or null.
      Discard lets go of it (null), then closes the figure. */
  holdFigure(done: (() => string | null) | null): void
  /** Done on a changed figure: its new body, one undo step, the page redrawn. */
  setFigure(key: string, body: FigureBody): void
}
interface Options { doc: Doc; save: (doc: Doc) => Promise<string | null>; onDone: () => void }

const withText = (b: Block, markup: string, item?: number): Block =>
  (b.type === 'bullets' || b.type === 'numbered') && item !== undefined ? { ...b, items: b.items.map((x, i) => (i === item ? markup : x)) }
    : 'text' in b && b.type !== 'code' && b.type !== 'raw' ? { ...b, text: markup } : b

/** The doc to save: the draft's words, tidied (no empty blocks), new headings and figures named. */
export function docOf(base: Doc, d: Draft): Doc {
  const subtitle = plainOf(d.subtitle).trim() ? d.subtitle : undefined
  return { ...base, title: d.title, subtitle, blocks: giveIds(tidy(unkeyed(d.blocks))) }
}

export function useDocEdit({ doc, save, onDone }: Options): DocEdit {
  const start = useMemo<Draft>(() => ({ title: doc.title, subtitle: doc.subtitle ?? '', blocks: keyed(doc.blocks) }), [doc])
  const draft = useRef(start), focus = useRef<Focus | null>(null)
  const past = useRef<Draft[]>([]), future = useRef<Draft[]>([]), lastTyped = useRef<string | null>(null)
  const [shown, setShown] = useState(start), [version, setVersion] = useState(0), [depth, setDepth] = useState({ past: 0, future: 0 })
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)
  const [figure, setFigureKey] = useState<string | null>(null), figureDone = useRef<(() => string | null) | null>(null)
  // The open figure closes first: Done, which refuses while it has an error. True when nothing is open any more.
  const closeFigure = useCallback(() => {
    const done = figureDone.current
    if (done && done() !== null) return false
    figureDone.current = null; setFigureKey(null)
    return true
  }, [])

  const record = useCallback(() => { past.current.push(draft.current); future.current = []; setDepth({ past: past.current.length, future: 0 }) }, [])
  const typedIn = useCallback((field: string) => { if (lastTyped.current !== field) record(); lastTyped.current = field }, [record])
  const write = useCallback((next: Draft) => { draft.current = next; setVersion((v) => v + 1) }, [])
  // A copy, not `d` itself: typing never redraws, so `shown` can already be `d`, and the same object would skip the redraw
  // and leave the page showing words the draft no longer has.
  const restore = useCallback((d: Draft, at?: Focus) => { draft.current = d; lastTyped.current = null; focus.current = at ?? null; setVersion((v) => v + 1); setShown({ ...d }) }, [])
  const text = useCallback((key: string, markup: string, item?: number) => {
    const d = draft.current
    write({ ...d, blocks: d.blocks.map((k) => (k.key === key ? { key, block: withText(k.block, markup, item) } : k)) })
  }, [write])

  return useMemo<DocEdit>(() => ({
    // Read through, not copied: two keystrokes before React re-renders must both see the latest draft.
    get draft() { return draft.current }, shown, dirty: version > 0, saving, error,
    setText: (key, markup, item) => { typedIn(`${key}:${item ?? ''}`); text(key, markup, item) },
    setHead: (field, markup) => { typedIn(field); write({ ...draft.current, [field]: markup }) },
    apply: (list, at) => {
      record(); lastTyped.current = null; focus.current = at ?? null; write({ ...draft.current, blocks: list }); setShown(draft.current)
      // A deleted figure is no longer open.
      if (figure && !list.some((k) => k.key === figure)) { figureDone.current = null; setFigureKey(null) }
    },
    mark: (key, markup, item) => {
      record(); lastTyped.current = null
      if (key === 'title' || key === 'subtitle') write({ ...draft.current, [key]: markup }); else text(key, markup, item)
    },
    takeFocus: () => { const f = focus.current; focus.current = null; return f },
    undo: (at) => { const prev = past.current.pop(); if (!prev) return; future.current.push(draft.current); setDepth({ past: past.current.length, future: future.current.length }); restore(prev, at) },
    redo: (at) => { const next = future.current.pop(); if (!next) return; past.current.push(draft.current); setDepth({ past: past.current.length, future: future.current.length }); restore(next, at) },
    canUndo: depth.past > 0, canRedo: depth.future > 0,
    figure,
    openFigure: (key) => { if (key !== figure && closeFigure()) setFigureKey(key) },
    holdFigure: (done) => { figureDone.current = done },
    setFigure: (key, body) => {
      record(); lastTyped.current = null
      write({ ...draft.current, blocks: draft.current.blocks.map((k) => (k.key === key && k.block.type === 'figure' ? { key, block: { ...k.block, body } } : k)) })
      setShown(draft.current)
    },
    save: async () => {
      if (!closeFigure()) return
      if (!plainOf(draft.current.title).trim()) { setError('A doc needs a title.'); return }
      setSaving(true); setError(null)
      const reason = await save(docOf(doc, draft.current))
      setSaving(false)
      if (reason) setError(reason); else onDone()
    },
    discard: onDone,
  }), [shown, version, saving, error, depth, typedIn, text, write, record, restore, save, doc, onDone, figure, closeFigure])
}

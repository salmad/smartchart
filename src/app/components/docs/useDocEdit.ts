/* The doc being edited: a Tiptap editor holds the draft (the truth), Save turns it into the file. Agents go through
   refusal in ops; a person’s Save is relaxed (warnings never block). One figure at a time is open in place and closes
   first on Save (figure validation still applies to Done). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import { Node as PMNode } from '@tiptap/pm/model'
import { giveIds } from '@/engine/docs/parse'
import { tidy } from '@/engine/docs/tidy'
import { hardSaveRefusal } from '@/engine/docs/ops'
import { validateDoc } from '@/engine/docs/validate'
import { fromProse, literalMarkup, toProse, type ProseNode } from '@/engine/docs/prose'
import { plainOf } from '@/engine/slides/markup'
import type { Block, Doc, FigureBody } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import { docExtensions } from './editor'
import type { ProposalOptions, ProposalView } from './editor/proposal'
import { refreshProposalDecorations } from './editor/proposal'
import { findFigure, setOpenKey, type FigureHost } from './editor/figure'

export interface DocEdit {
  editor: Editor | null
  /** The blocks the editor opened with (an unchanged block is written back as it was). */
  originals: readonly Block[]
  dirty: boolean; saving: boolean; error: string | null
  /** Reserved for a hard client stop; human Save is not blocked by schema or layout. */
  blockers: string[]
  /** Schema, links and title notes: shown, never block a person’s Save. */
  warnings: string[]
  canUndo: boolean; canRedo: boolean
  undo(): void; redo(): void
  /** The doc as Save would write it, or null before the editor exists. */
  current(): Doc | null
  save(): Promise<void>
  discard(): void
  /** The figure open in place, by key. Opening another, or saving, first runs the open one's Done: if that refuses
      (the figure has an error), nothing else happens. */
  figure: string | null
  /** Where the open figure's edit surface goes (its element), when it is open. */
  slot: HTMLElement | null
  openFigure(key: string | null): void
  /** The open figure's Done, held while it is open: it writes the figure back (or not) and says why not, or null.
      Discard lets go of it (null), then closes the figure. */
  holdFigure(done: ((force?: boolean) => string | null) | null): void
  /** Done on a changed figure: its new body, one undo step. */
  setFigure(key: string, body: FigureBody): void
  /** For the slash menu: the editor hands it every key first. */
  onKey: { current: (e: KeyboardEvent) => boolean }
}
interface Options {
  doc: Doc
  theme: Theme
  accent: string | undefined
  save: (doc: Doc, opts?: { label?: string }) => Promise<string | null>
  onDone: () => void
  proposalView?: () => ProposalView | null
  /** Bumped when the active proposal or Original/Suggestion mode changes. */
  proposalTick?: number
}

const MEASURE_MS = 300

/** Every schema issue on the draft, as warnings (relaxed doc rules). */
export function docEditWarnings(_before: Doc, next: Doc, json: ProseNode): string[] {
  const notes: string[] = []
  if (!plainOf(next.title).trim()) notes.push('Title is empty; Save keeps the previous title until you add one.')
  const typed = literalMarkup(json)
  if (typed) notes.push(`“${typed.slice(0, 40)}” looks like formatting in plain text. Save anyway; use the toolbar for bold and links if you meant styling.`)
  notes.push(...validateDoc(next, { strict: false }).warnings)
  const trip = hardSaveRefusal(next)
  if (trip) notes.push(trip)
  return notes
}

/** Title used in the file when the field is empty (so Save never drops the draft). */
export function titleForSave(base: Doc, next: Doc): Doc {
  if (plainOf(next.title).trim()) return next
  const kept = plainOf(base.title).trim()
  return { ...next, title: kept || 'Untitled' }
}

/** The doc to save: the editor's words, empty blocks gone, new headings and figures named. */
export function docOf(base: Doc, json: ProseNode): Doc {
  const h = fromProse(json, base.blocks)
  const subtitle = plainOf(h.subtitle).trim() ? h.subtitle : undefined
  return { ...base, title: h.title, subtitle, blocks: giveIds(tidy(h.blocks)) }
}

export function useDocEdit({ doc, theme, accent, save, onDone, proposalView, proposalTick = 0 }: Options): DocEdit {
  const [figure, setFigureKey] = useState<string | null>(null), [slot, setSlot] = useState<HTMLElement | null>(null)
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null), [blockers, setBlockers] = useState<string[]>([]), [warnings, setWarnings] = useState<string[]>([]), [tick, setTick] = useState(0)
  const done = useRef<((force?: boolean) => string | null) | null>(null), initial = useRef<PMNode | null>(null), look = useRef({ theme, accent }), onKey = useRef<(e: KeyboardEvent) => boolean>(() => false)
  look.current = { theme, accent }
  const editorRef = useRef<Editor | null>(null)

  const host = useMemo<FigureHost>(() => ({
    theme: () => look.current.theme, accent: () => look.current.accent,
    open: (key) => open.current(key),
    slotFor: (key) => { let el = slots.current.get(key); if (!el) { el = document.createElement('div'); slots.current.set(key, el) } return el },
    slot: (key, el) => { setSlot(el); if (!el) slots.current.delete(key) },
  }), [])
  const open = useRef<(key: string | null) => void>(() => {}), slots = useRef(new Map<string, HTMLElement>())

  const proposalOpts = useMemo<ProposalOptions | undefined>(() => (proposalView ? {
    getDoc: () => { const e = editorRef.current; return e ? docOf(doc, e.getJSON() as ProseNode) : doc },
    view: proposalView,
    theme: () => look.current.theme,
  } : undefined), [doc, proposalView])

  const editor = useEditor({
    extensions: docExtensions(host, { originals: () => doc.blocks, slash: (e) => onKey.current(e) }, proposalOpts),
    content: toProse({ title: doc.title, subtitle: doc.subtitle ?? '', blocks: doc.blocks }),
    editorProps: { attributes: { class: 'doc-body', spellcheck: 'true' } },
    shouldRerenderOnTransaction: false,
    onCreate: ({ editor: e }) => { initial.current = e.state.doc },
    onTransaction: () => setTick((t) => t + 1),
  }, [doc, proposalOpts])

  useEffect(() => {
    if (editor && proposalView) refreshProposalDecorations(editor)
  }, [editor, proposalView, proposalTick])

  editorRef.current = editor
  // A figure deleted while it was open is no longer open.
  useEffect(() => {
    if (editor && figure && !findFigure(editor, figure)) { done.current = null; slots.current.delete(figure); setFigureKey(null); setSlot(null); setOpenKey(editor, null) }
  }, [editor, figure, tick])
  useEffect(() => { editor?.setEditable(!saving) }, [editor, saving])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!editor) { setBlockers([]); setWarnings([]); return }
      const json = editor.getJSON() as ProseNode, next = docOf(doc, json)
      setBlockers([])
      setWarnings(docEditWarnings(doc, next, json))
    }, MEASURE_MS)
    return () => clearTimeout(t)
  }, [editor, doc, tick])

  const closeFigure = useCallback((force = false) => {
    const d = done.current
    if (d) {
      const why = d(force)
      if (why !== null) { if (!force) setError(why); return false }
    }
    done.current = null; setFigureKey(null); setSlot(null)
    if (editorRef.current) setOpenKey(editorRef.current, null)
    return true
  }, [])
  open.current = (key) => { if (key !== figure && closeFigure() && key && editorRef.current) { setFigureKey(key); setOpenKey(editorRef.current, key) } }

  const current = useCallback((): Doc | null => (editor ? docOf(doc, editor.getJSON() as ProseNode) : null), [editor, doc])

  return useMemo<DocEdit>(() => ({
    editor, originals: doc.blocks,
    dirty: !!editor && !!initial.current && !editor.state.doc.eq(initial.current), saving, error, blockers, warnings,
    canUndo: !!editor?.can().undo(), canRedo: !!editor?.can().redo(),
    undo: () => { editor?.commands.undo() }, redo: () => { editor?.commands.redo() },
    current, figure, slot, onKey,
    openFigure: (key) => open.current(key),
    holdFigure: (d) => { done.current = d },
    setFigure: (key, body) => {
      const f = editor && findFigure(editor, key)
      if (!editor || !f || f.block.type !== 'figure') return
      const n = editor.state.doc.nodeAt(f.pos)
      if (n) editor.view.dispatch(editor.state.tr.setNodeMarkup(f.pos, undefined, { ...n.attrs, block: { ...f.block, body } }))
    },
    save: async () => {
      if (!editor || !closeFigure(true)) return
      const json = editor.getJSON() as ProseNode, next = titleForSave(doc, docOf(doc, json))
      // Nothing changed: nothing is written, and no version is made.
      if (initial.current && editor.state.doc.eq(initial.current)) { onDone(); return }
      setSaving(true); setError(null)
      const reason = await save(next)
      setSaving(false)
      if (reason) setError(reason); else onDone()
    },
    discard: onDone,
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick: the editor's state changed; the memo reads it
  }), [editor, doc, tick, saving, error, figure, slot, current, closeFigure, save, onDone]) as DocEdit
}

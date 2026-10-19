/* The doc being edited: a Tiptap editor holds the draft (the truth), Save turns it into the file. Opening a doc and
   saving it with nothing changed writes nothing; a change goes through the same gate the doc tools use, and the gate
   refuses with a sentence, never rewriting. One figure at a time is open in place and closes first, on Save. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import { Node as PMNode } from '@tiptap/pm/model'
import { giveIds } from '@/engine/docs/parse'
import { tidy } from '@/engine/docs/tidy'
import { refusal } from '@/engine/docs/ops'
import { fromProse, literalMarkup, toProse, type ProseNode } from '@/engine/docs/prose'
import { plainOf } from '@/engine/slides/markup'
import type { Block, Doc, FigureBody } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import { docExtensions } from './editor'
import { findFigure, setOpenKey, type FigureHost } from './editor/figure'

export interface DocEdit {
  editor: Editor | null
  /** The blocks the editor opened with (an unchanged block is written back as it was). */
  originals: readonly Block[]
  dirty: boolean; saving: boolean; error: string | null
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
  holdFigure(done: (() => string | null) | null): void
  /** Done on a changed figure: its new body, one undo step. */
  setFigure(key: string, body: FigureBody): void
  /** For the slash menu: the editor hands it every key first. */
  onKey: { current: (e: KeyboardEvent) => boolean }
}
interface Options { doc: Doc; theme: Theme; accent: string | undefined; save: (doc: Doc) => Promise<string | null>; onDone: () => void }

/** The doc to save: the editor's words, empty blocks gone, new headings and figures named. */
export function docOf(base: Doc, json: ProseNode): Doc {
  const h = fromProse(json, base.blocks)
  const subtitle = plainOf(h.subtitle).trim() ? h.subtitle : undefined
  return { ...base, title: h.title, subtitle, blocks: giveIds(tidy(h.blocks)) }
}

export function useDocEdit({ doc, theme, accent, save, onDone }: Options): DocEdit {
  const [figure, setFigureKey] = useState<string | null>(null), [slot, setSlot] = useState<HTMLElement | null>(null)
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null), [tick, setTick] = useState(0)
  const done = useRef<(() => string | null) | null>(null), initial = useRef<PMNode | null>(null), look = useRef({ theme, accent }), onKey = useRef<(e: KeyboardEvent) => boolean>(() => false)
  look.current = { theme, accent }
  const editorRef = useRef<Editor | null>(null)

  const host = useMemo<FigureHost>(() => ({
    theme: () => look.current.theme, accent: () => look.current.accent,
    open: (key) => open.current(key),
    slotFor: (key) => { let el = slots.current.get(key); if (!el) { el = document.createElement('div'); slots.current.set(key, el) } return el },
    slot: (key, el) => { setSlot(el); if (!el) slots.current.delete(key) },
  }), [])
  const open = useRef<(key: string | null) => void>(() => {}), slots = useRef(new Map<string, HTMLElement>())

  const editor = useEditor({
    extensions: docExtensions(host, { originals: () => doc.blocks, slash: (e) => onKey.current(e) }),
    content: toProse({ title: doc.title, subtitle: doc.subtitle ?? '', blocks: doc.blocks }),
    editorProps: { attributes: { class: 'doc-body', spellcheck: 'true' } },
    shouldRerenderOnTransaction: false,
    onCreate: ({ editor: e }) => { initial.current = e.state.doc },
    onTransaction: () => setTick((t) => t + 1),
  }, [doc])

  editorRef.current = editor
  // A figure deleted while it was open is no longer open.
  useEffect(() => {
    if (editor && figure && !findFigure(editor, figure)) { done.current = null; slots.current.delete(figure); setFigureKey(null); setSlot(null); setOpenKey(editor, null) }
  }, [editor, figure, tick])
  useEffect(() => { editor?.setEditable(!saving) }, [editor, saving])

  const closeFigure = useCallback(() => {
    const d = done.current
    if (d && d() !== null) return false
    done.current = null; setFigureKey(null); setSlot(null)
    if (editorRef.current) setOpenKey(editorRef.current, null)
    return true
  }, [])
  open.current = (key) => { if (key !== figure && closeFigure() && key && editorRef.current) { setFigureKey(key); setOpenKey(editorRef.current, key) } }

  const current = useCallback((): Doc | null => (editor ? docOf(doc, editor.getJSON() as ProseNode) : null), [editor, doc])

  return useMemo<DocEdit>(() => ({
    editor, originals: doc.blocks,
    dirty: !!editor && !!initial.current && !editor.state.doc.eq(initial.current), saving, error,
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
      if (!editor || !closeFigure()) return
      const json = editor.getJSON() as ProseNode, next = docOf(doc, json)
      if (!plainOf(next.title).trim()) { setError('A doc needs a title.'); return }
      const typed = literalMarkup(json)
      if (typed) { setError(`“${typed.slice(0, 40)}” would be read as formatting once saved. Reword it.`); return }
      // Nothing changed: nothing is written, and no version is made.
      if (initial.current && editor.state.doc.eq(initial.current)) { onDone(); return }
      const why = refusal(doc, next)
      if (why) { setError(why); return }
      setSaving(true); setError(null)
      const reason = await save(next)
      setSaving(false)
      if (reason) setError(reason); else onDone()
    },
    discard: onDone,
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick: the editor's state changed; the memo reads it
  }), [editor, doc, tick, saving, error, figure, slot, current, closeFigure, save, onDone]) as DocEdit
}

/* The slash menu's state: open when / is typed into an empty paragraph, filtered by what follows it, closed by Esc (the
   / stays as text), by a pick, or when the paragraph no longer starts with /. The editor hands it every key first. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyBlocks } from './editor/structure'
import { matching, pick, type SlashChoice } from './slash'
import type { DocEdit } from './useDocEdit'

export interface Slash { query: string; x: number; y: number; /** Opens above the line when there is no room below it. */ above: boolean; choices: SlashChoice[]; active: string | null }

export function useSlash(edit: DocEdit, frame: () => HTMLElement | null) {
  const { editor } = edit
  const [slash, setSlash] = useState<Slash | null>(null), live = useRef<Slash | null>(null), dismissed = useRef<number | null>(null)
  const set = useCallback((s: Slash | null) => { live.current = s; setSlash(s) }, [])

  /** After every change: open, filter or close. */
  useEffect(() => {
    if (!editor) return
    const update = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      const { $from, empty } = editor.state.selection, p = $from.parent, cur = live.current, start = $from.start()
      const ok = empty && p.type.name === 'paragraph' && ['sectionBody', 'doc'].includes($from.node(-1)?.type.name ?? '') && /^\/\S*$/.test(p.textContent)
      if (!ok) { dismissed.current = null; if (cur) set(null); return }
      // It opens when words are typed into such a paragraph (all at once, as a paste or a fast typist does), not when the
      // cursor merely arrives in one.
      if (dismissed.current === start || (!cur && !transaction.docChanged)) return
      const box = frame()?.getBoundingClientRect(), at = editor.view.coordsAtPos($from.pos), choices = matching(p.textContent.slice(1))
      const active = cur && choices.some((c) => c.id === cur.active) ? cur.active : choices[0]?.id ?? null
      const above = window.innerHeight - at.bottom < 340 && at.top > 340
      set({ query: p.textContent.slice(1), x: at.left - (box?.left ?? 0) - 4, y: (above ? at.top - 6 : at.bottom + 6) - (box?.top ?? 0), above, choices, active })
    }
    editor.on('transaction', update)
    return () => { editor.off('transaction', update) }
  }, [editor, frame, set])

  const choose = useCallback((c: SlashChoice) => {
    if (!editor || !live.current) return
    set(null)
    applyBlocks(editor, edit.originals, (list, i) => pick(list, list[i].key, c))
    editor.view.focus()
  }, [editor, edit.originals, set])

  /** A key while the menu is open: true when it was the menu's. */
  const key = useCallback((e: KeyboardEvent): boolean => {
    const cur = live.current
    if (!cur || !editor) return false
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const ids = cur.choices.map((c) => c.id), i = ids.indexOf(cur.active ?? ''), n = ids.length
      if (n) set({ ...cur, active: ids[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n] })
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const c = cur.choices.find((x) => x.id === cur.active)
      if (c) choose(c); else set(null)
      return true
    }
    if (e.key === 'Escape') { e.preventDefault(); dismissed.current = editor.state.selection.$from.start(); set(null); return true }
    return false
  }, [choose, editor, set])
  useEffect(() => { edit.onKey.current = key }, [edit, key])

  const hover = useCallback((id: string) => { const cur = live.current; if (cur && id) set({ ...cur, active: id }) }, [set])
  const close = useCallback(() => { if (live.current) set(null) }, [set])
  return { slash, choose, hover, close }
}

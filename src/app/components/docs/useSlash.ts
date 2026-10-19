/* The slash menu's state: open when / is typed into an empty paragraph, filtered by what follows it, closed by Esc
   (the / stays as text), by a pick, or when the paragraph no longer starts with /. The editor hands it every input and
   key in a paragraph first. */
import { useCallback, useRef, useState } from 'react'
import { matching, pick, type SlashChoice } from './slash'
import type { Field } from './editorKeys'
import type { DocEdit } from './useDocEdit'

export interface Slash { key: string; query: string; x: number; y: number; choices: SlashChoice[]; active: string | null }

export function useSlash(edit: DocEdit, frame: () => HTMLElement | null) {
  const [slash, setSlash] = useState<Slash | null>(null), live = useRef<Slash | null>(null), dismissed = useRef<string | null>(null)
  const set = useCallback((s: Slash | null) => { live.current = s; setSlash(s) }, [])

  /** After typing in a field: open, filter or close. */
  const input = useCallback((f: Field) => {
    const text = f.el.textContent ?? '', b = edit.draft.blocks.find((k) => k.key === f.key)?.block, cur = live.current
    if (!f.key || b?.type !== 'paragraph' || !/^\/\S*$/.test(text)) { dismissed.current = null; if (cur) set(null); return }
    if (dismissed.current === f.key || (!cur && text !== '/')) return
    const box = frame()?.getBoundingClientRect(), r = f.el.getBoundingClientRect(), choices = matching(text.slice(1))
    const active = cur && choices.some((c) => c.id === cur.active) ? cur.active : choices[0]?.id ?? null
    set({ key: f.key, query: text.slice(1), x: r.left - (box?.left ?? 0), y: r.bottom - (box?.top ?? 0) + 6, choices, active })
  }, [edit, frame, set])

  const choose = useCallback((c: SlashChoice) => {
    const cur = live.current
    if (!cur) return
    set(null)
    const r = pick(edit.draft.blocks, cur.key, c)
    edit.apply(r.list, r.focus)
  }, [edit, set])

  /** A key while the menu is open: true when it was the menu's. */
  const key = useCallback((e: KeyboardEvent): boolean => {
    const cur = live.current
    if (!cur) return false
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
    if (e.key === 'Escape') { e.preventDefault(); dismissed.current = cur.key; set(null); return true }
    return false
  }, [choose, set])

  const hover = useCallback((id: string) => { const cur = live.current; if (cur && id) set({ ...cur, active: id }) }, [set])
  const close = useCallback(() => { if (live.current) set(null) }, [set])
  return { slash, input, key, choose, hover, close }
}

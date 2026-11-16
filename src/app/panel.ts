/* A side panel the maker shows and hides, as in Cursor's title bar: toggled by its button or a ⌘ shortcut, and
   remembered in this browser. Until the maker chooses, it opens when `byDefault` says so. */
import { useCallback, useEffect, useState } from 'react'

export function usePanel(storageKey: string, key: string, byDefault: () => boolean = () => true): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try { const saved = localStorage.getItem(storageKey); return saved === null ? byDefault() : saved !== '0' } catch { return byDefault() }
  })
  const toggle = useCallback(() => setOpen((o) => { try { localStorage.setItem(storageKey, o ? '0' : '1') } catch { /* storage blocked */ } return !o }), [storageKey])
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === key) { e.preventDefault(); toggle() } }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [key, toggle])
  return [open, toggle]
}

/** Wide enough for the sidebar, the agent and a full-size slide: a window this wide opens with the sidebar out. */
export const ROOMY = '(min-width: 1500px)'

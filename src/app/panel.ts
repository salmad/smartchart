/* A side panel the maker shows and hides, as in Cursor's title bar: open unless hidden, toggled by its button or a
   ⌘ shortcut, and remembered in this browser. */
import { useCallback, useEffect, useState } from 'react'

export function usePanel(storageKey: string, key: string): [boolean, () => void] {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(storageKey) !== '0' } catch { return true } })
  const toggle = useCallback(() => setOpen((o) => { try { localStorage.setItem(storageKey, o ? '0' : '1') } catch { /* storage blocked */ } return !o }), [storageKey])
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === key) { e.preventDefault(); toggle() } }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [key, toggle])
  return [open, toggle]
}

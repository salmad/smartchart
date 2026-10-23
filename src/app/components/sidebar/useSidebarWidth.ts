/* The sidebar's width: dragged from its right edge or set with the arrow keys, kept in this browser. The width goes to the
   element as a CSS custom property (`--sidebar-w`), so no style attribute is rendered. */
import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

export const MIN = 200, MAX = 480, DEFAULT = 248, STEP = 16
const KEY = 'occam.sidebar.width'

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)))
const read = () => { try { const n = Number(localStorage.getItem(KEY)); return n ? clamp(n) : DEFAULT } catch { return DEFAULT } }
const keep = (n: number) => { try { localStorage.setItem(KEY, String(n)) } catch { /* not kept */ } }

export function useSidebarWidth() {
  const nav = useRef<HTMLElement>(null), width = useRef(read()), grip = useRef<HTMLDivElement>(null)
  const apply = useCallback((n: number, save = true) => {
    width.current = clamp(n)
    nav.current?.style.setProperty('--sidebar-w', `${width.current}px`)
    grip.current?.setAttribute('aria-valuenow', String(width.current))
    if (save) keep(width.current)
  }, [])
  useEffect(() => apply(width.current, false), [apply])

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = e.currentTarget, x0 = e.clientX, w0 = width.current
    el.setPointerCapture(e.pointerId)
    document.body.classList.add('select-none')
    const move = (m: globalThis.PointerEvent) => apply(w0 + m.clientX - x0, false)
    const up = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      document.body.classList.remove('select-none'); apply(width.current)
    }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
  }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.key === 'ArrowLeft' ? -STEP : e.key === 'ArrowRight' ? STEP : 0
    if (by) { e.preventDefault(); apply(width.current + by) }
    else if (e.key === 'Home') { e.preventDefault(); apply(MIN) }
    else if (e.key === 'End') { e.preventDefault(); apply(MAX) }
  }
  return {
    nav,
    gripProps: { ref: grip, role: 'separator', 'aria-orientation': 'vertical' as const, 'aria-label': 'Resize sidebar', 'aria-valuemin': MIN, 'aria-valuemax': MAX,
      'aria-valuenow': width.current, tabIndex: 0, onPointerDown: down, onKeyDown: key, onDoubleClick: () => apply(DEFAULT) },
  }
}

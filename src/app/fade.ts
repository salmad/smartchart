/* Marks a horizontal scroller's edges that have more beyond them (data-more-start, data-more-end), for .edge-fade.
   Returns a callback ref, so a scroller that mounts later (the filmstrip once a deck has slides) is still followed. */
import { useCallback, useRef } from 'react'

export function useEdgeFade(): (el: HTMLElement | null) => void {
  const stop = useRef<(() => void) | null>(null)
  return useCallback((el: HTMLElement | null) => {
    stop.current?.()
    stop.current = null
    if (!el) return
    const mark = () => {
      el.toggleAttribute('data-more-start', el.scrollLeft > 1)
      el.toggleAttribute('data-more-end', el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }
    mark()
    el.addEventListener('scroll', mark, { passive: true })
    // Resizes of the scroller and of its content (thumbs added, a panel opened) both change what is hidden.
    const seen = new ResizeObserver(mark)
    const watch = () => { seen.observe(el); for (const child of el.children) seen.observe(child) }
    watch()
    const added = new MutationObserver(() => { watch(); mark() })
    added.observe(el, { childList: true })
    stop.current = () => { el.removeEventListener('scroll', mark); seen.disconnect(); added.disconnect() }
  }, [])
}

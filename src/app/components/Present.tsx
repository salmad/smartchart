import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Deck } from '@/engine/types'
import { contexts } from '@/engine/slides/render'
import { SlideView } from './SlideView'

interface Props { deck: Deck; start: number; onExit: (index: number) => void }

/** Full-screen presentation overlay, ported from the prototype's present.js. */
export function Present({ deck, start, onExit }: Props) {
  const n = deck.slides.length
  const ctx = contexts(deck)
  const [index, setIndex] = useState(() => Math.max(0, Math.min(start, n - 1)))
  const indexRef = useRef(index)
  indexRef.current = index
  const rootRef = useRef<HTMLDivElement>(null)
  const exitedRef = useRef(false)
  // The parent passes a new callback each render; the listeners below are set up once.
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  // Keep the URL hash in sync with the shown slide.
  useEffect(() => {
    history.replaceState(null, '', `#/${index + 1}`)
  }, [index])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const exit = () => {
      if (exitedRef.current) return
      exitedRef.current = true
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      history.replaceState(null, '', location.pathname + location.search)
      onExitRef.current(indexRef.current)
    }
    // The ref moves at once, so keys pressed before the next render still count from the new slide.
    const show = (to: number) => { indexRef.current = Math.max(0, Math.min(n - 1, to)); setIndex(indexRef.current) }
    let typed = ''
    const onKey = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') show(indexRef.current + 1)
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') show(indexRef.current - 1)
      else if (k === 'Home') show(0)
      else if (k === 'End') show(n - 1)
      else if (/^\d$/.test(k)) { typed += k; return }
      else if (k === 'Enter' && typed) show(Number(typed) - 1)
      else if (k === 'f' || k === 'F') (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())?.catch(() => {})
      else if (k === 'Escape') exit()
      else return
      typed = ''
      e.preventDefault()
    }
    const onFullscreenChange = () => { if (!document.fullscreenElement) exit() }
    window.addEventListener('keydown', onKey)
    root.requestFullscreen?.().then(() => document.addEventListener('fullscreenchange', onFullscreenChange)).catch(() => {})
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [n])

  const onClick = (e: MouseEvent) => { indexRef.current = Math.max(0, Math.min(n - 1, indexRef.current + (e.clientX > window.innerWidth / 2 ? 1 : -1))); setIndex(indexRef.current) }

  return (
    <div ref={rootRef} onClick={onClick} className="fixed inset-0 z-10 bg-black grid place-items-center cursor-none">
      <SlideView
        slide={deck.slides[index]}
        deck={deck}
        ctx={ctx[index]}
        className="relative overflow-hidden aspect-video w-[min(100vw,calc(100vh*16/9))]"
      />
      <div className="fixed right-5 bottom-4 font-mono text-xs text-white/35">{index + 1} / {n}</div>
    </div>
  )
}

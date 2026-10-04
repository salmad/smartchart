import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Deck } from '@/engine/types'
import { contexts } from '@/engine/slides/render'
import { SlideView } from './SlideView'
import { openPresenter, presenterChannel, type PresenterMsg } from '@/app/presenter-channel'

interface Props { deck: Deck; start: number; onExit: (index: number) => void }

/** Full-screen presentation overlay, ported from the prototype's present.js. */
export function Present({ deck, start, onExit }: Props) {
  const n = deck.slides.length
  const ctx = contexts(deck)
  const [index, setIndex] = useState(() => Math.max(0, Math.min(start, n - 1)))
  const indexRef = useRef(index)
  indexRef.current = index
  const rootRef = useRef<HTMLDivElement>(null)
  const exitedRef = useRef(false), presenter = useRef<Window | null>(null)
  // The parent passes a new callback each render; the listeners below are set up once.
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  // Keep the URL hash in sync with the shown slide.
  useEffect(() => {
    history.replaceState(null, '', `#/${index + 1}`)
  }, [index])

  // The presenter view (P): it is told every slide shown, and can move the slide itself.
  const channel = useRef<BroadcastChannel | null>(null), deckRef = useRef(deck)
  deckRef.current = deck
  useEffect(() => {
    const ch = presenterChannel()
    channel.current = ch
    ch.onmessage = (e: MessageEvent<PresenterMsg>) => {
      if (e.data.type === 'hello') ch.postMessage({ type: 'state', deck: deckRef.current, index: indexRef.current } satisfies PresenterMsg)
      if (e.data.type === 'go') { indexRef.current = Math.max(0, Math.min(n - 1, e.data.index)); setIndex(indexRef.current) }
    }
    return () => { ch.postMessage({ type: 'end' } satisfies PresenterMsg); ch.close(); channel.current = null }
  }, [n])
  useEffect(() => { channel.current?.postMessage({ type: 'state', deck: deckRef.current, index } satisfies PresenterMsg) }, [index])

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
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') show(indexRef.current + 1)
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') show(indexRef.current - 1)
      else if (k === 'Home') show(0)
      else if (k === 'End') show(n - 1)
      else if (/^\d$/.test(k)) { typed += k; return }
      else if (k === 'Enter' && typed) show(Number(typed) - 1)
      else if (k === 'f' || k === 'F') (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())?.catch(() => {})
      else if (k === 'p' || k === 'P') presenter.current = openPresenter()
      else if (k === 'Escape') exit()
      else return
      typed = ''
      e.preventDefault()
    }
    // Leaving full screen ends the presentation, except while the presenter view is open: opening it leaves full screen,
    // and the maker then moves this window to the projector and presses F.
    const onFullscreenChange = () => { if (!document.fullscreenElement && !(presenter.current && !presenter.current.closed)) exit() }
    // On a notched MacBook, full screen keeps the strip beside the camera black and centres the slide below it.
    // Keynote centres on the whole screen: lift the slide by half that strip, within its letterbox room.
    const lift = () => {
      const inset = document.fullscreenElement ? screen.height - innerHeight : 0
      const room = (innerHeight - Math.min(innerWidth * 9 / 16, innerHeight)) / 2
      root.style.setProperty('--lift', `${inset > 0 && inset < 100 ? Math.min(inset / 2, room) : 0}px`)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', lift)
    root.requestFullscreen?.().then(() => { lift(); document.addEventListener('fullscreenchange', onFullscreenChange) }).catch(() => {})
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', lift)
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
        className="relative overflow-hidden aspect-video w-[min(100vw,calc(100vh*16/9))] -translate-y-[var(--lift,0px)]"
      />
    </div>
  )
}

/* The presentation (/present): full screen in its own tab, so the deck can be edited in another while this one runs.
   It shows the deck as the source tab last published it and keeps to one slide with the presenter view. */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { contexts } from '@/engine/slides/render'
import { SlideView } from './SlideView'
import { Ink, type InkHandle } from './Ink'
import { openPresenter, useLiveShow } from '@/app/presenter-channel'

export function Present() {
  const { deck, index, go, atRef, key } = useLiveShow()
  const rootRef = useRef<HTMLDivElement>(null), ink = useRef<InkHandle>(null), press = useRef<{ x: number; y: number; far: boolean } | null>(null)
  const [hint, setHint] = useState(true)
  const n = deck?.slides.length ?? 0
  const goRef = useRef(go), nRef = useRef(n)
  goRef.current = go
  nRef.current = n

  useEffect(() => { document.title = 'Presenting · Occam' }, [])
  useEffect(() => { history.replaceState(null, '', `${location.pathname}${location.search}#/${index + 1}`) }, [index])
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 6000); return () => window.clearTimeout(t) }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())?.catch(() => {})
    let typed = ''
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key, at = atRef.current, last = nRef.current - 1
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') goRef.current(at + 1)
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') goRef.current(at - 1)
      else if (k === 'Home') goRef.current(0)
      else if (k === 'End') goRef.current(last)
      else if (/^\d$/.test(k)) { typed += k; return }
      else if (k === 'Enter' && typed) goRef.current(Number(typed) - 1)
      else if (k === 'f' || k === 'F') fullscreen()
      else if (k === 'p' || k === 'P') openPresenter(key.current, at)
      else if (k === 'Escape') { if (!document.fullscreenElement) window.close() }
      else return
      typed = ''
      e.preventDefault()
    }
    // On a notched MacBook, full screen keeps the strip beside the camera black and centres the slide below it.
    // Keynote centres on the whole screen: lift the slide by half that strip, within its letterbox room.
    const lift = () => {
      const inset = document.fullscreenElement ? screen.height - innerHeight : 0
      const room = (innerHeight - Math.min(innerWidth * 9 / 16, innerHeight)) / 2
      root.style.setProperty('--lift', `${inset > 0 && inset < 100 ? Math.min(inset / 2, room) : 0}px`)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', lift)
    document.addEventListener('fullscreenchange', lift)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', lift)
      document.removeEventListener('fullscreenchange', lift)
    }
  }, [atRef, key])

  // A click turns the slide (right half forward, left half back); holding and dragging draws disappearing ink instead.
  const onLink = (e: PointerEvent) => !!(e.target as Element).closest('a')
  const down = (e: PointerEvent) => { ink.current?.at(e.clientX, e.clientY); if (onLink(e)) return; press.current = { x: e.clientX, y: e.clientY, far: false }; ink.current?.down(e.clientX, e.clientY) }
  const move = (e: PointerEvent) => {
    ink.current?.at(e.clientX, e.clientY)
    const p = press.current
    if (!p) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.far = true
    ink.current?.move(e.clientX, e.clientY)
  }
  const up = (e: PointerEvent) => {
    const p = press.current
    press.current = null
    ink.current?.up()
    if (p && !p.far && !onLink(e)) go(atRef.current + (e.clientX > window.innerWidth / 2 ? 1 : -1))
  }

  const ctx = deck ? contexts(deck) : []
  return (
    <div ref={rootRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { press.current = null; ink.current?.up() }}
      data-links className="fixed inset-0 z-10 grid cursor-none touch-none select-none place-items-center bg-black">
      {deck
        ? <SlideView
            slide={deck.slides[index]}
            deck={deck}
            ctx={ctx[index]}
            className="relative overflow-hidden aspect-video w-[min(100vw,calc(100vh*16/9))] -translate-y-[var(--lift,0px)]"
          />
        : <div className="grid cursor-default gap-2 p-8 text-center text-white">
            <p className="text-[17px] font-medium">Waiting for your deck…</p>
            <p className="text-white/60">Open it in Occam and press Present. This tab shows it as you edit.</p>
          </div>}
      <Ink ref={ink} />
      {deck && hint && <p className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-[13px] text-white/70">F full screen · P presenter view · hold and drag to draw (fades in 2s)</p>}
    </div>
  )
}

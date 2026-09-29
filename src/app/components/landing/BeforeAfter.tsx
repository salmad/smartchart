import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { DefaultChart } from './DefaultChart'
import { LiveSlide } from './LiveSlide'

// The one orchestrated moment: on first view the default slides in from the right edge to PEEK, holds so the two can be
// compared, then draws back to REST, where the Occam slide's title reads whole (it ends near 72% across).
const REST = 82, FROM = 100, PEEK = 45
const LEGS: [from: number, to: number, ms: number][] = [[FROM, PEEK, 1200], [PEEK, PEEK, 900], [PEEK, REST, 1100]]
const ease = (k: number) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

/** The same numbers twice: the Occam slide, with a slide tool's default chart over its right side, split by a line you
    drag. It rests mostly on Occam, so the slide reads whole without a drag. */
export function BeforeAfter() {
  const box = useRef<HTMLDivElement>(null), handle = useRef<HTMLDivElement>(null)
  const at = useRef(REST), dragging = useRef(false)

  const set = (pct: number) => {
    at.current = Math.min(100, Math.max(0, pct))
    box.current?.style.setProperty('--x', `${at.current}%`)
    handle.current?.setAttribute('aria-valuenow', String(Math.round(at.current)))
  }

  useEffect(() => {
    const el = box.current
    if (!el) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { set(REST); return }
    set(FROM)
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      let leg = 0, t0 = performance.now()
      const step = (t: number) => {
        if (dragging.current) return
        const [a, b, ms] = LEGS[leg], k = Math.min(1, (t - t0) / ms)
        set(a + (b - a) * ease(k))
        if (k === 1) { leg += 1; t0 = t }
        if (leg < LEGS.length) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.35 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  const fromPointer = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect()
    if (r) set(((e.clientX - r.left) / r.width) * 100)
  }
  const down = (e: PointerEvent<HTMLDivElement>) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); handle.current?.focus({ preventScroll: true }) }
  const move = (e: PointerEvent) => { if (dragging.current) fromPointer(e) }
  const up = () => { dragging.current = false }
  const key = (e: KeyboardEvent) => {
    const d = { ArrowLeft: -5, ArrowRight: 5, Home: -100, End: 100 }[e.key]
    if (d === undefined) return
    e.preventDefault(); dragging.current = true; set(at.current + d)
  }

  return (
    <figure className="grid gap-4">
      <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="ba relative aspect-video cursor-ew-resize touch-pan-y select-none overflow-hidden site-lift rounded-[20px] bg-stage">
        <LiveSlide id="chart-notes" className="absolute inset-0" />
        <div className="ba-before absolute inset-0" aria-hidden><DefaultChart className="block size-full" /></div>
        <div ref={handle} role="slider" tabIndex={0} aria-label="Compare the default chart with Occam" aria-valuemin={0} aria-valuemax={100} aria-valuenow={REST}
          aria-valuetext="Drag to compare" onKeyDown={key}
          className="ba-line group absolute inset-y-0 w-11 -translate-x-1/2 outline-none">
          <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.18)]" />
          <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,.28)] transition-transform group-focus-visible:ring-2 group-focus-visible:ring-type group-focus-visible:ring-offset-2 group-active:scale-95">
            <svg viewBox="0 0 24 24" className="size-5 text-type" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 7-5 5 5 5M15 7l5 5-5 5" /></svg>
          </span>
        </div>
      </div>
      <figcaption className="flex justify-between gap-6 text-[13px] text-type-3">
        <span>Occam</span>
        <span className="text-right">The same numbers, in your slide tool</span>
      </figcaption>
    </figure>
  )
}

/* The presenter view (/presenter, opened with P while presenting): the slide the room sees, the next one, what to say
   over it, and the time. It is its own tab: it follows the deck as the editor publishes it and moves the slide with its
   own keys, whether or not the presentation tab is open (presenter-channel.ts). */
import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { contexts } from '@/engine/slides/render'
import { useLiveShow } from '@/app/presenter-channel'
import { SlideView } from './SlideView'

const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export function Presenter() {
  const { deck, index, go, atRef } = useLiveShow()
  const [started, setStarted] = useState(() => Date.now()), [now, setNow] = useState(() => Date.now())
  // When the slide shown last changed: the time on this slide is what a rehearsal watches.
  const [slideSince, setSlideSince] = useState(() => Date.now())
  const goRef = useRef(go), countRef = useRef(0)
  goRef.current = go
  countRef.current = deck?.slides.length ?? 0

  useEffect(() => { setSlideSince(Date.now()) }, [index])
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    document.title = 'Presenter · Occam'
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key, at = atRef.current
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') goRef.current(at + 1)
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') goRef.current(at - 1)
      else if (k === 'Home') goRef.current(0)
      else if (k === 'End') goRef.current(countRef.current - 1)
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [atRef])

  const ctx = useMemo(() => (deck ? contexts(deck) : []), [deck])
  if (!deck) {
    return (
      <div className="grid h-full place-content-center gap-2 bg-app-bg p-8 text-center text-ink">
        <p className="text-[17px] font-medium">Waiting for your deck…</p>
        <p className="text-ink-3">Open it in Occam and press Present, then P. This window follows the slides and moves them with its arrow keys.</p>
      </div>
    )
  }

  const slide = deck.slides[index], next = deck.slides[index + 1]
  const look = { style: deck.style, theme: deck.theme, accent: deck.accent ?? null }
  const talk = (slide?.talk ?? '').trim()
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-5 bg-app-bg p-6 text-ink">
      <header className="flex items-center gap-6 text-[14px]">
        <span className="font-medium">Slide {index + 1} <span className="text-ink-3">of {deck.slides.length}</span></span>
        <span className="ml-auto font-mono text-[15px] tabular-nums text-ink-2" aria-label="Time on this slide">this slide {clock(Math.max(0, now - slideSince))}</span>
        <span className="flex items-center gap-2 font-mono text-[22px] tabular-nums" aria-label="Time presenting">
          {clock(now - started)}
          <button type="button" aria-label="Restart the timer" onClick={() => { setStarted(Date.now()); setSlideSince(Date.now()); setNow(Date.now()) }} className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-panel hover:text-ink"><RotateCcw className="size-3.5" /></button>
        </span>
        <span className="font-mono text-[15px] tabular-nums text-ink-3" aria-label="Time of day">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </header>
      <main className="grid min-h-0 grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6">
        <section aria-label="Now showing" data-links className="min-w-0">
          {slide && <SlideView slide={slide} deck={look} ctx={ctx[index]} className="relative aspect-video w-full overflow-hidden rounded-lg shadow-[0_0_0_1px_theme(colors.line)]" />}
        </section>
        <aside className="grid min-h-0 grid-rows-[auto_auto_auto_1fr] gap-2">
          <h2 className="text-[12px] font-medium uppercase tracking-[.12em] text-ink-3">Next</h2>
          {next
            ? <SlideView slide={next} deck={look} ctx={ctx[index + 1]} className="relative aspect-video w-full overflow-hidden rounded-md opacity-80 shadow-[0_0_0_1px_theme(colors.line)]" />
            : <div className="grid aspect-video place-items-center rounded-md border border-dashed border-line-2 text-ink-3">End of the deck</div>}
          <h2 className="mt-3 text-[12px] font-medium uppercase tracking-[.12em] text-ink-3">Talk</h2>
          <div aria-label="Speaker notes" className="min-h-0 overflow-y-auto pr-1">
            {talk
              ? talk.split(/\n+/).map((p, i) => <p key={i} className="mb-3 text-[20px] leading-[1.5] text-ink">{p}</p>)
              : <p className="text-[15px] leading-[1.5] text-ink-3">No speaker notes on this slide. Ask in the chat: “Write speaker notes for every slide.”</p>}
          </div>
        </aside>
      </main>
    </div>
  )
}

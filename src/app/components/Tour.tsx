/* The tour: a spotlight on one part of the editor at a time and a card that says what it does, ending at Connect
   an agent. → or Enter for next, ← for back, Esc to close. Positions go through CSS variables (no inline styles). */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { place, TOUR } from '@/app/tour'
import { cn } from '@/app/lib/utils'
import { AgentKey } from './AgentKey'
import { Button } from './ui/button'

const PAD = 6

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0), [connecting, setConnecting] = useState(false), [lit, setLit] = useState(false)
  const spot = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null)
  const step = TOUR[i], last = i === TOUR.length - 1

  useLayoutEffect(() => {
    const layout = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`), s = spot.current, c = card.current
      if (!s || !c) return
      const r = el?.getBoundingClientRect(), box = r && r.width && r.height ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null
      setLit(!!box)
      if (box) for (const [k, v] of Object.entries({ '--x': box.left, '--y': box.top, '--w': box.width, '--h': box.height })) s.style.setProperty(k, `${v}px`)
      const p = place(box, { width: c.offsetWidth, height: c.offsetHeight }, { width: innerWidth, height: innerHeight })
      c.style.setProperty('--top', `${p.top}px`); c.style.setProperty('--left', `${p.left}px`)
    }
    document.querySelector(`[data-tour="${step.id}"]`)?.scrollIntoView({ block: 'nearest' })
    layout()
    addEventListener('resize', layout); addEventListener('scroll', layout, true)
    return () => { removeEventListener('resize', layout); removeEventListener('scroll', layout, true) }
  }, [step])

  useEffect(() => { card.current?.focus() }, [i])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (connecting) return
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if ((e.key === 'ArrowRight' || e.key === 'Enter') && !last) { e.preventDefault(); setI(i + 1) }
      if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); setI(i - 1) }
    }
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  }, [i, last, connecting, onClose])

  return (
    <>
      {/* Clicks on the page wait while the tour is open. It steps aside while Connect an agent is open. */}
      <div aria-hidden className={cn('fixed inset-0 z-[60]', !lit && 'bg-[rgba(5,5,6,.62)]', connecting && 'hidden')} />
      <div ref={spot} aria-hidden className={cn('pointer-events-none fixed left-[var(--x)] top-[var(--y)] z-[61] h-[var(--h)] w-[var(--w)] rounded-[12px] shadow-[0_0_0_1px_rgba(255,255,255,.18),0_0_0_9999px_rgba(5,5,6,.62)] transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none', (!lit || connecting) && 'hidden')} />
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1}
        className={cn('fixed left-[var(--left)] top-[var(--top)] z-[62] grid w-[340px] max-w-[calc(100vw-32px)] gap-3 rounded-[14px] border border-line-2 bg-raise p-5 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_48px_-16px_rgba(0,0,0,.8)] outline-none transition-[left,top] duration-300 ease-out motion-reduce:transition-none', connecting && 'hidden')}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase leading-none tracking-[.08em] text-ink-3">Step {i + 1} of {TOUR.length}</span>
          <button type="button" onClick={onClose} aria-label="Close the tour" className="-mr-1.5 -mt-1.5 grid size-7 cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <h2 id="tour-title" className="text-[16px] font-semibold tracking-[-.01em]">{step.title}</h2>
        <p id="tour-body" className="text-[13.5px] leading-[1.55] text-ink-2">{step.body}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div aria-hidden className="flex gap-1">
            {TOUR.map((t, k) => <i key={t.id} className={cn('size-1.5 rounded-full transition-colors', k === i ? 'bg-ink' : 'bg-line-2')} />)}
          </div>
          <div className="flex gap-2">
            {i > 0 && <Button size="sm" variant="ghost" onClick={() => setI(i - 1)}>Back</Button>}
            {last
              ? <><Button size="sm" variant="outline" onClick={onClose}>Done</Button><Button size="sm" onClick={() => setConnecting(true)}>Make a key</Button></>
              : <Button size="sm" onClick={() => setI(i + 1)}>Next</Button>}
          </div>
        </div>
      </div>
      <AgentKey open={connecting} onOpenChange={(o) => { setConnecting(o); if (!o) onClose() }} />
    </>
  )
}

/** After the first slide: one quiet offer of the tour, never again once taken or dismissed. */
export function TourNudge({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-raise py-1.5 pl-4 pr-1.5 text-[13px] text-ink-2 shadow-[0_0_0_1px_theme(colors.line-2),0_12px_32px_rgba(0,0,0,.5)] motion-safe:animate-reveal">
      Your first slide is in. See what else it does?
      <Button size="sm" onClick={onStart}>Take the 1-minute tour</Button>
      <button type="button" onClick={onDismiss} aria-label="Not now" className="grid size-7 cursor-pointer place-items-center rounded-full text-ink-3 transition-colors hover:bg-panel hover:text-ink">
        <X className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}

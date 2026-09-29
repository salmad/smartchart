import { useEffect, useState } from 'react'
import { cn } from '@/app/lib/utils'

const STAR = 'M10 0c.8 5.6 3.6 8.4 10 10-6.4 1.6-9.2 4.4-10 10-.8-5.6-3.6-8.4-10-10 6.4-1.6 9.2-4.4 10-10z'

/** A gold four-point star, the landing film's spark. */
function Star({ className }: { className?: string }) {
  return <svg aria-hidden viewBox="0 0 20 20" className={className}><path d={STAR} fill="currentColor" /></svg>
}

/** Beside the phase while a turn runs, in place of a spinner: a star turning and glowing. Still under reduced motion. */
export function Glint({ className }: { className?: string }) {
  return <Star className={cn('inline-block size-3.5 shrink-0 text-gold drop-shadow-[0_0_4px_rgba(232,185,74,.8)] motion-safe:animate-glint', className)} />
}

// Stars inside the frame, clear of the status pill: position (in % of the slide), size and a stagger, as literal classes.
const STARS = [
  'left-[9%] top-[14%] size-[1.8cqw] motion-safe:[animation-delay:0ms]', 'left-[31%] top-[8%] size-[1.1cqw] motion-safe:[animation-delay:900ms]',
  'left-[63%] top-[12%] size-[1.4cqw] motion-safe:[animation-delay:400ms]', 'left-[89%] top-[20%] size-[2cqw] motion-safe:[animation-delay:1500ms]',
  'left-[84%] top-[58%] size-[1.2cqw] motion-safe:[animation-delay:700ms]', 'left-[52%] top-[46%] size-[2.4cqw] motion-safe:[animation-delay:1200ms]',
  'left-[14%] top-[62%] size-[1.3cqw] motion-safe:[animation-delay:1900ms]', 'left-[36%] top-[74%] size-[1cqw] motion-safe:[animation-delay:300ms]',
]

/** Over the stage while a turn runs: gold stars fade in and out across the slide and a soft light passes over it.
    Nothing shows under reduced motion; the status line still says what is happening. */
export function Stars() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden [container-type:inline-size]">
      <i className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,244,214,.08),transparent)] opacity-0 motion-safe:animate-shimmer motion-safe:opacity-100" />
      {STARS.map((p) => (
        <Star key={p} className={cn('absolute text-gold opacity-0 drop-shadow-[0_0_.6cqw_rgba(232,185,74,.7)] motion-safe:animate-twinkle', p)} />
      ))}
    </div>
  )
}

const TURN_MS = 2200

/** What the turn is doing, one line at a time: the lines take turns, each rising into place, and start over when the step changes. */
export function Thinking({ lines }: { lines: string[] }) {
  const key = lines.join('|'), [at, setAt] = useState({ key, i: 0 })
  const i = at.key === key ? at.i : 0
  useEffect(() => {
    if (lines.length < 2) return
    const t = window.setInterval(() => setAt((a) => ({ key, i: a.key === key ? (a.i + 1) % lines.length : 1 })), TURN_MS)
    return () => clearInterval(t)
  }, [key, lines.length])
  return <span key={lines[i]} className="motion-safe:animate-rise">{lines[i]}</span>
}
